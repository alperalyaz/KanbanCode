# Phase 1 - Attachment normalization, image optimization, budgets, and UI warnings

## Summary

Goal: make attachment intake safe before changing provider delivery paths.

Chosen approach: **new agent-attachments feature skeleton + renderer pica optimizer + backend budget validator + capability warnings**, with current runtime delivery behavior preserved.

🎯 9.4   🛡️ 9.3   🧠 5.8  
Estimated change size: `260-420` LOC.

This phase is intentionally conservative. It reduces crash risk from oversized image payloads without changing Claude/Codex/OpenCode runtime launch or delivery semantics.

## Why this phase first

Current attachment handling stores images as base64 in renderer and validates decoded file size only. This misses the real risk:

```text
image bytes -> base64 expands by ~33% -> JSON wrapper -> stream-json stdin line
```

A 20MB decoded total can become a much larger single-line JSON payload and can destabilize a long-lived lead process.

Phase 1 creates the safety foundation:

- normalize attachments;
- optimize screenshots;
- calculate estimated serialized payload size;
- block too-large sends before stdin write;
- show clear UI warnings;
- do not change runtime adapter logic yet.

## Scope

In scope:

- new `src/features/agent-attachments` contracts/core shell;
- renderer image optimization using `pica@9.0.1`;
- new normalized attachment DTOs;
- backend validation for image dimensions, bytes, base64 size, and estimated serialized payload;
- UI warnings in composer;
- tests for optimizer decisions and validation.

Out of scope:

- Codex `--image` wiring;
- OpenCode file parts;
- model capability catalog beyond basic warnings;
- document/PDF optimization;
- live provider calls.

## Dependency decision

Add:

```bash
pnpm add pica@9.0.1
```

Rationale:

- pure browser-side high-quality resize;
- no native Electron packaging risk;
- good quality for screenshots and UI text;
- safer before release than `sharp` in Electron main.

Do not add:

- `sharp` in Electron main in this phase;
- `@squoosh/lib` due staleness/complexity;
- `jimp` due lower quality/performance for screenshots.

## New feature layout

```text
src/features/agent-attachments/
  contracts/
    api.ts
    dto.ts
    channels.ts
  core/
    domain/
      AttachmentBudget.ts
      AttachmentModel.ts
      AttachmentValidation.ts
    application/
      AttachmentIntakePolicy.ts
      AttachmentBudgetEstimator.ts
  main/
    composition/
      createAgentAttachmentsFeature.ts
    adapters/
      input/ipc/registerAgentAttachmentIpc.ts
    infrastructure/
      ServerAttachmentValidator.ts
  preload/
    createAgentAttachmentsBridge.ts
  renderer/
    hooks/useAttachmentPreparation.ts
    ui/AttachmentCapabilityNotice.tsx
    utils/picaImageOptimizer.ts
```

If this feels too much for phase 1, contracts/domain/application can be created first and IPC can be deferred. But the boundaries should be established now.

## Contract DTOs

```ts
export type AgentAttachmentKind = 'image' | 'document' | 'text' | 'unsupported';

export interface AgentAttachmentDraftDto {
  id: string;
  filename: string;
  mimeType: string;
  kind: AgentAttachmentKind;
  originalBytes: number;
  dataBase64: string;
  width?: number;
  height?: number;
  optimized?: AgentAttachmentOptimizedVariantDto;
  warnings: AgentAttachmentWarningDto[];
}

export interface AgentAttachmentOptimizedVariantDto {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  dataBase64: string;
  bytes: number;
  width: number;
  height: number;
  quality?: number;
  strategy: 'unchanged' | 'resized' | 'converted' | 'resized-and-converted';
}

export interface AgentAttachmentWarningDto {
  code:
    | 'image_resized'
    | 'image_quality_reduced'
    | 'image_too_large'
    | 'animated_gif_unchanged'
    | 'unsupported_mime_type'
    | 'serialized_payload_too_large';
  severity: 'info' | 'warning' | 'error';
  message: string;
}
```

## Budget constants

Start conservative. These can be tuned after e2e.

```ts
export const AGENT_ATTACHMENT_BUDGETS = {
  maxFiles: 5,
  maxOriginalFileBytes: 10 * 1024 * 1024,
  maxTotalOriginalBytes: 20 * 1024 * 1024,
  maxOptimizedImageBytes: 1_500_000,
  maxTotalOptimizedBytes: 4_000_000,
  maxEstimatedStreamJsonPayloadBytes: 7_500_000,
  maxDecodedMegapixels: 24,
  maxLongEdgePx: 2000,
  minJpegQuality: 0.72,
  initialJpegQuality: 0.88,
} as const;
```

Rationale:

- Claude Code docs mention 10MB stdin limit for headless input modes. Use `7.5MB` app budget to leave JSON/base64 overhead headroom.
- Multiple images need a total optimized budget, not only per-image limits.
- Screenshots need enough resolution to read text, so do not crush quality below `0.72` silently.

## Renderer optimizer policy

Use `pica` only for images where this is safe.

```ts
export async function optimizeImageForAgentAttachment(
  input: BrowserImageInput,
  policy = DEFAULT_IMAGE_OPTIMIZATION_POLICY,
): Promise<AgentAttachmentOptimizedVariantDto> {
  if (input.mimeType === 'image/gif') {
    return keepOriginalWithWarning('animated_gif_unchanged');
  }

  if (input.hasAlpha) {
    return resizePngPreservingAlpha(input, policy);
  }

  return resizeRgbScreenshotToJpeg(input, policy);
}
```

Rules:

- Preserve aspect ratio.
- Preserve alpha by staying PNG unless output exceeds budget and user must choose a lower-fidelity conversion explicitly later.
- Do not silently convert animated GIF to a still image.
- Prefer JPEG for large RGB screenshots.
- Try qualities in bounded steps: `0.88`, `0.82`, `0.76`, `0.72`.
- If still too large, show error instead of making unreadable images.

## Payload size estimator

Do not rely only on decoded bytes.

```ts
export function estimateStreamJsonPayloadBytes(input: {
  text: string;
  attachments: AgentAttachmentDraftDto[];
}): number {
  const contentBlocks = input.attachments.map(attachment => ({
    type: attachment.kind === 'image' ? 'image' : 'document',
    source: {
      type: 'base64',
      media_type: attachment.optimized?.mimeType ?? attachment.mimeType,
      data: attachment.optimized?.dataBase64 ?? attachment.dataBase64,
    },
  }));

  return Buffer.byteLength(JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'text', text: input.text }, ...contentBlocks],
    },
  }), 'utf8');
}
```

This estimator lives in shared/core if it avoids Node-only APIs, or duplicated as pure helper with `TextEncoder` for renderer and `Buffer.byteLength` for main. Prefer pure `TextEncoder` for cross-process reuse.

## Backend validation

The backend must revalidate everything because renderer optimization is not a security boundary.

```ts
export function validateAgentAttachmentsForSend(input: {
  text: string;
  attachments: AgentAttachmentDraftDto[];
  runtimeHint: RuntimeAttachmentHint;
}): ValidationResult {
  if (input.attachments.length > AGENT_ATTACHMENT_BUDGETS.maxFiles) {
    return error('Too many attachments.');
  }

  const estimatedBytes = estimateStreamJsonPayloadBytes(input);
  if (estimatedBytes > AGENT_ATTACHMENT_BUDGETS.maxEstimatedStreamJsonPayloadBytes) {
    return error(
      `Attachments are too large after optimization (${formatBytes(estimatedBytes)} serialized). ` +
      `Remove an image or reduce screenshot size.`,
    );
  }

  return ok();
}
```

For phase 1, wire this into existing `validateAttachments` before `sendMessageToTeam` accepts attachments.

## Composer UI behavior

Add a small notice near attachment previews.

Examples:

```text
Screenshot optimized to 1920x1080 JPEG, 612 KB.
```

```text
Attachments are too large after optimization. Remove one image or use a smaller screenshot.
```

```text
Animated GIFs are not optimized yet and may be too large for agent delivery.
```

Do not mention provider-specific capability in Phase 1 unless the target runtime is already known in composer state. The main blocker in Phase 1 is size/budget safety.

## Integration points

Existing code to adjust carefully:

```text
src/renderer/utils/attachmentUtils.ts
src/renderer/hooks/useComposerDraft.ts
src/main/ipc/teams.ts
src/main/services/team/TeamProvisioningService.ts
```

Do not move all logic at once. Add wrappers and leave current API shape compatible.

## Edge cases

### Multiple high-resolution screenshots

Expected behavior:

- optimize each image;
- if total serialized payload still too large, block send with clear error;
- do not partially send only some images.

### Transparent PNG

Expected behavior:

- preserve PNG/alpha;
- if too large, ask user to reduce or confirm future lossy conversion in a later phase;
- do not silently flatten transparency.

### Animated GIF

Expected behavior:

- keep original if within budget;
- otherwise block with clear message;
- do not silently first-frame it.

### Corrupt image

Expected behavior:

- show `Cannot read image file`;
- do not pass corrupt base64 to runtime.

### Old draft with base64-only attachment

Expected behavior:

- load draft;
- if no optimized variant exists, optimize on send;
- if optimization fails, block send.

### Unsupported file type

Expected behavior:

- existing path fallback for local files can remain;
- unsupported binary file is not converted to base64 attachment.

## Test plan

### Unit

- `estimateStreamJsonPayloadBytes` includes base64 and JSON overhead.
- RGB PNG screenshot converts/resizes to JPEG under budget.
- Small PNG remains unchanged if already safe.
- Alpha PNG does not become JPEG silently.
- Animated GIF is not converted silently.
- Corrupt image returns error.
- Total optimized bytes over budget blocks send.

### Renderer

- composer shows optimization notice;
- composer shows too-large error;
- removing an attachment clears budget error;
- old drafts trigger optimization before send.

### Main/IPС

- IPC rejects too many attachments;
- IPC rejects payload above serialized budget;
- IPC accepts safe optimized image;
- error messages are user-readable and do not include base64 data.

Suggested focused checks:

```bash
pnpm vitest run src/features/agent-attachments/**/*.test.ts test/main/ipc/teams.test.ts test/renderer/components/team/messages/MessageComposer.test.tsx
pnpm typecheck --pretty false
```

## Safety checklist

- No provider runtime path changed.
- No launch/provisioning path changed.
- Text-only messages still use old path.
- Attachments are blocked before send if unsafe.
- Backend validation cannot be bypassed by renderer state.
- No secrets or base64 blobs in diagnostics.

## Deep implementation details

### Step-by-step implementation sequence

1. Add feature contracts and pure budget estimator.
2. Add renderer-only `picaImageOptimizer` with no imports from main.
3. Add backend `ServerAttachmentValidator` that can validate legacy payloads.
4. Wire backend validator into existing IPC send path before `TeamProvisioningService.sendMessageToTeam()`.
5. Add composer warnings from renderer optimization state.
6. Add tests for estimator and validator.

This order avoids changing provider delivery until validation is proven.

### Pure byte estimator

Use a runtime-neutral helper so both renderer and main can compute comparable values.

```ts
export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function estimateBase64JsonStringBytes(base64: string): number {
  // JSON string escaping is normally small for base64, but include quotes.
  return utf8Bytes(JSON.stringify(base64));
}

export function estimateClaudeStreamJsonPayloadBytes(input: {
  text: string;
  attachments: Array<{ mimeType: string; base64: string; kind: 'image' | 'document' }>;
}): number {
  const payload = {
    type: 'user',
    message: {
      role: 'user',
      content: [
        { type: 'text', text: input.text },
        ...input.attachments.map(att => ({
          type: att.kind === 'image' ? 'image' : 'document',
          source: {
            type: 'base64',
            media_type: att.mimeType,
            data: att.base64,
          },
        })),
      ],
    },
  };
  return utf8Bytes(JSON.stringify(payload));
}
```

Avoid using `Buffer` in shared/renderer code.

### Renderer optimizer pseudo-code

```ts
export async function prepareImageAttachmentDraft(file: File): Promise<AgentAttachmentDraftDto> {
  const originalBase64 = await readFileAsBase64(file);
  const metadata = await readImageMetadata(file);

  if (metadata.megapixels > AGENT_ATTACHMENT_BUDGETS.maxDecodedMegapixels) {
    return errorDraft(file, 'Image resolution is too large to process safely.');
  }

  const optimized = await optimizeImageForAgent(file, metadata);
  const warnings = buildOptimizationWarnings(file, optimized);

  return {
    id: stableBrowserDraftId(file, originalBase64),
    filename: file.name,
    mimeType: file.type,
    kind: 'image',
    originalBytes: file.size,
    dataBase64: originalBase64,
    width: metadata.width,
    height: metadata.height,
    optimized,
    warnings,
  };
}
```

### Pica resize pseudo-code

```ts
async function resizeRgbToJpeg(input: ImageBitmap, policy: ImagePolicy) {
  const { width, height } = fitWithinLongEdge(input.width, input.height, policy.maxLongEdgePx);
  const canvas = new OffscreenCanvas(width, height);
  await pica().resize(input, canvas, {
    quality: 3,
    alpha: false,
    unsharpAmount: 80,
    unsharpRadius: 0.6,
    unsharpThreshold: 2,
  });

  for (const quality of [0.88, 0.82, 0.76, 0.72]) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    if (blob.size <= policy.maxOptimizedImageBytes) {
      return toVariant(blob, { width, height, quality, strategy: 'resized-and-converted' });
    }
  }

  throw new AttachmentTooLargeError('Image is still too large after resizing.');
}
```

Fallback if `OffscreenCanvas` is unavailable:

```ts
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
await pica().resize(sourceCanvasOrImage, canvas);
```

### Alpha detection

Do not decode full huge images on main thread just to check alpha. In renderer, after image bitmap decode and drawing to a small sampling canvas:

```ts
function likelyHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const sampleWidth = Math.min(width, 256);
  const sampleHeight = Math.min(height, 256);
  const data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) return true;
  }
  return false;
}
```

If uncertain, prefer PNG and warn rather than silently flattening.

### Backend legacy payload normalization

```ts
export function normalizeLegacyAttachmentPayload(input: {
  data: string;
  mimeType: string;
  filename?: string;
}): NormalizedLegacyAttachment {
  const decodedBytes = estimateDecodedBase64Bytes(input.data);
  const kind = classifyMimeType(input.mimeType);

  if (decodedBytes > AGENT_ATTACHMENT_BUDGETS.maxOriginalFileBytes) {
    throw new AttachmentValidationError({
      code: 'attachment_too_large_original',
      userMessage: `${input.filename ?? 'Attachment'} is too large.`,
    });
  }

  return {
    id: stableAttachmentId(input),
    filename: sanitizeAttachmentFilename(input.filename),
    mimeType: input.mimeType,
    kind,
    decodedBytes,
    base64: input.data,
  };
}
```

### Filename sanitization

Never use attachment filenames directly as filesystem paths.

```ts
export function sanitizeAttachmentFilename(name: string | undefined): string {
  const fallback = 'attachment';
  const base = (name ?? fallback)
    .replace(/[\\/\0\r\n\t]/g, '_')
    .replace(/^\.+$/, fallback)
    .slice(0, 120)
    .trim();
  return base || fallback;
}
```

### More edge cases

| Edge case | Expected behavior |
|---|---|
| Browser cannot decode HEIC pasted from iPhone | show unsupported image format, suggest PNG/JPEG screenshot |
| User attaches 5 images each individually under budget but combined over budget | block whole send, show combined payload size |
| Image has huge dimensions but tiny compressed bytes | block before decode if dimensions exceed safe megapixels |
| File extension says `.jpg` but MIME says PNG | trust detected MIME if available, otherwise validate magic bytes in backend later |
| Renderer optimization fails due memory pressure | keep draft but mark send-blocked with retry/remove action |
| User edits message text after optimization | do not recompress image, only recompute serialized payload estimate |
| User removes image | revoke object URLs and release ImageBitmap/canvas refs |
| User switches team while optimization running | cancel or ignore stale optimization result by draft id |
| SVG image | treat as unsupported in v1 unless converted explicitly later |
| WebP | allow if runtime supports, otherwise convert to JPEG/PNG if safe |

### Bug-prevention checklist

- All async optimizer results must check current draft id before writing state.
- Object URLs must be revoked on unmount/remove.
- Do not store huge base64 in React error messages.
- Do not include base64 in Zustand dev logs if avoidable.
- Do not throw raw DOMException to user.
- Backend validation must run even if renderer says optimized.
- Tests should include both `data.length` and decoded byte calculations.

## File-by-file implementation plan

### 1. Contracts

Create:

```text
src/features/agent-attachments/contracts/dto.ts
src/features/agent-attachments/contracts/api.ts
src/features/agent-attachments/contracts/index.ts
```

Keep contracts serializable. Do not expose classes or functions that require DOM/Node.

Example:

```ts
export interface AgentAttachmentBudgetDto {
  maxFiles: number;
  maxOriginalFileBytes: number;
  maxTotalOriginalBytes: number;
  maxOptimizedImageBytes: number;
  maxEstimatedSerializedBytes: number;
}
```

### 2. Core domain

Create:

```text
src/features/agent-attachments/core/domain/AttachmentBudget.ts
src/features/agent-attachments/core/domain/AttachmentMime.ts
src/features/agent-attachments/core/domain/AttachmentErrors.ts
```

This layer must be pure. No `fs`, no `Electron`, no `React`, no `Buffer` if it needs renderer reuse.

### 3. Renderer optimizer

Create:

```text
src/features/agent-attachments/renderer/utils/picaImageOptimizer.ts
```

This file may import `pica`, DOM APIs, and browser canvas APIs. It must not import main process modules.

### 4. Existing renderer integration

Update carefully:

```text
src/renderer/utils/attachmentUtils.ts
src/renderer/hooks/useComposerDraft.ts
```

Do not replace the whole draft flow. Add a narrow call:

```ts
const prepared = await prepareAgentAttachmentDraft(file);
```

### 5. Main validation

Create:

```text
src/features/agent-attachments/main/infrastructure/ServerAttachmentValidator.ts
```

Then call it from existing IPC validation. Do not move all IPC into the new feature in Phase 1 unless it is trivial.

### 6. UI warnings

Add small rendering components only if existing composer can consume warnings without a broad refactor.

Potential target:

```text
src/renderer/components/team/messages/MessageComposer.tsx
```

Keep UI changes minimal.

## Additional code examples

### Domain error class

```ts
export class AgentAttachmentError extends Error {
  constructor(readonly failure: AttachmentFailure) {
    super(failure.userMessage);
    this.name = 'AgentAttachmentError';
  }
}

export function isAgentAttachmentError(error: unknown): error is AgentAttachmentError {
  return error instanceof AgentAttachmentError;
}
```

### MIME classifier

```ts
export function classifyAttachmentMimeType(mimeType: string): AgentAttachmentKind {
  const normalized = mimeType.toLowerCase();
  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(normalized)) return 'image';
  if (normalized === 'application/pdf') return 'document';
  if (normalized.startsWith('text/')) return 'text';
  return 'unsupported';
}
```

### Base64 decoded byte estimator

```ts
export function estimateDecodedBase64Bytes(base64: string): number {
  const clean = base64.replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}
```

Do not decode huge base64 just to estimate size.

### Safe async draft update pattern

```ts
const generation = ++attachmentPreparationGenerationRef.current;
const result = await prepareAttachment(file);
if (generation !== attachmentPreparationGenerationRef.current) {
  return; // stale result after team/message switch
}
setDraftAttachments(prev => [...prev, result]);
```

## More detailed test cases

### Budget estimator table

| Input | Expected |
|---|---|
| no attachments, short text | under budget |
| one 1MB base64 image | serialized estimate greater than decoded bytes |
| five 1MB images | total serialized limit can fail |
| base64 with whitespace | decoded byte estimator handles it |
| empty base64 | invalid attachment error |

### Optimizer table

| Input | Expected |
|---|---|
| 320x240 PNG under budget | unchanged or tiny optimized variant |
| 6000x4000 screenshot | resized to max long edge |
| transparent PNG | stays PNG |
| animated GIF | not converted, warning |
| corrupt PNG | error draft |
| WebP | accepted if browser decodes, otherwise unsupported |

### UI state table

| Action | Expected |
|---|---|
| attach image then remove | warning disappears, object URL revoked |
| attach too-large image | send disabled with specific reason |
| edit text after attach | only serialized estimate recalculated |
| switch team during optimization | stale result ignored |
| attach unsupported binary | existing path/link fallback or blocked, no base64 blob |

## Extra risk controls

- Keep old constants temporarily and map them to new budget constants to avoid conflicting limits.
- If `pica` import increases renderer bundle unexpectedly, keep it lazy-loaded only when image attachment is selected.
- If optimization fails unexpectedly, fail closed for attachments but do not affect text-only sends.
- Add analytics/log event only with counts/bytes, never filenames if privacy-sensitive.

## Phase 1 exit criteria

Phase 1 is complete only when:

- text-only composer send is unchanged;
- image drafts show optimized size or clear error;
- backend rejects oversized serialized payloads;
- renderer and backend use consistent budget constants;
- no runtime provider delivery code is changed;
- old legacy payload shape still works;
- no base64/data URL appears in UI errors or logs.

## Migration seam from existing code

Existing code should be wrapped, not replaced wholesale.

Current likely call chain:

```text
MessageComposer -> useComposerDraft -> attachmentUtils.fileToAttachmentPayload -> teams IPC -> validateAttachments -> sendMessageToTeam
```

Phase 1 seam:

```text
attachmentUtils.fileToAttachmentPayload
  -> prepareAgentAttachmentDraft
  -> returns legacy-compatible payload plus metadata/warnings

main validateAttachments
  -> ServerAttachmentValidator.validateLegacyPayloads
```

Do not change `sendMessageToTeam` signature in Phase 1.

## More concrete backend validator

```ts
export interface ServerAttachmentValidationInput {
  messageText: string;
  attachments: Array<{ data: string; mimeType: string; filename?: string }>;
  budget?: Partial<AgentAttachmentBudget>;
}

export interface ServerAttachmentValidationOutput {
  ok: true;
  normalized: NormalizedLegacyAttachment[];
  estimatedSerializedBytes: number;
  warnings: AttachmentWarning[];
} | {
  ok: false;
  failure: AttachmentFailure;
};
```

Usage:

```ts
const validation = serverAttachmentValidator.validateLegacyPayloads({
  messageText,
  attachments,
});
if (!validation.ok) {
  throw new Error(validation.failure.userMessage);
}
```

### Validation order

Order matters for predictable user errors.

1. attachment count;
2. base64 validity;
3. decoded bytes per file;
4. total decoded bytes;
5. MIME support;
6. estimated serialized payload bytes;
7. warning collection.

Do not compute JSON payload with unbounded decoded buffers.

## Renderer optimizer cancellation

```ts
export interface AttachmentPreparationJob {
  id: string;
  cancel(): void;
  promise: Promise<AgentAttachmentDraftDto>;
}
```

If using AbortController:

```ts
const controller = new AbortController();
const promise = prepareAgentAttachmentDraft(file, { signal: controller.signal });
return { id, cancel: () => controller.abort(), promise };
```

If pica cannot fully abort, still ignore stale results by generation id.

## Memory safety

Large images can pressure renderer memory. Keep rules strict.

- Reject dimensions above max megapixels before full resize when possible.
- Release `ImageBitmap` with `imageBitmap.close()` after resize.
- Revoke object URLs.
- Avoid storing duplicate base64 strings if optimized variant replaces original for send.
- Do not put raw base64 in React component props beyond draft state if avoidable.

## Phase 1 bug traps and prevention

| Trap | Prevention |
|---|---|
| Backend accepts unsafe payload because renderer already warned | backend validator is mandatory |
| UI warning says optimized but send uses original huge base64 | send path chooses optimized variant or blocks |
| GIF silently becomes static image | explicit GIF policy, test it |
| transparent PNG becomes white/black JPEG | alpha test and PNG preservation |
| stale optimization adds attachment to wrong team draft | generation id check |
| file name path traversal appears in future artifact path | sanitize filenames now |
| tests rely on browser-only APIs in Node | keep optimizer tests in jsdom/browser-compatible environment or mock pica |

## Extra test skeletons

```ts
describe('ServerAttachmentValidator', () => {
  it('rejects payload by serialized size even when decoded bytes are under old limit', () => {
    const image = makeBase64OfSize(6_000_000);
    const result = validator.validateLegacyPayloads({
      messageText: 'x',
      attachments: [{ data: image, mimeType: 'image/png', filename: 'large.png' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('attachment_serialized_payload_too_large');
  });
});
```

```ts
describe('picaImageOptimizer', () => {
  it('does not flatten transparent PNG to JPEG', async () => {
    const result = await optimizeImageForAgentAttachment(transparentPngFile);
    expect(result.mimeType).toBe('image/png');
  });
});
```
