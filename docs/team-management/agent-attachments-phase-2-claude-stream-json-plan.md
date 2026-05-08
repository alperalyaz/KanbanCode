# Phase 2 - Claude stream-json attachment delivery adapter

## Summary

Goal: route existing Claude lead attachment delivery through the new attachment planner, preserving current stream-json content block behavior while adding deterministic budgets and diagnostics.

Chosen approach: **extract current Claude serialization into `ClaudeStreamJsonAttachmentAdapter` and call it from `TeamProvisioningService.sendMessageToRun()`**.

🎯 9.0   🛡️ 8.8   🧠 5.8  
Estimated change size: `180-320` LOC.

This phase should not change launch, bootstrap, provider auth, or teammate liveness. It only replaces ad-hoc attachment block assembly with a tested adapter.

## Current behavior to preserve

Current path in `TeamProvisioningService.sendMessageToRun()` builds content blocks:

```ts
const contentBlocks: Record<string, unknown>[] = [{ type: 'text', text: message }];

if (att.mimeType === 'application/pdf') {
  contentBlocks.push({
    type: 'document',
    source: {
      type: 'base64',
      media_type: 'application/pdf',
      data: att.data,
    },
    title: att.filename,
  });
} else if (att.mimeType === 'text/plain') {
  // text or base64 document
} else {
  contentBlocks.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: att.mimeType,
      data: att.data,
    },
  });
}
```

Keep the same Claude content block shape.

## Why use adapter

`TeamProvisioningService` should not know image optimization or provider-specific attachment serialization details. Its responsibility is team lifecycle and message routing.

The adapter gives:

- unit-testable serialization;
- budget diagnostics before stdin write;
- future support for variant selection;
- less risk when adding Codex/OpenCode adapters.

## New adapter sketch

```ts
export class ClaudeStreamJsonAttachmentAdapter implements AttachmentDeliveryAdapter {
  readonly runtimeKind = 'claude-stream-json' as const;

  canDeliver(
    ctx: AttachmentRuntimeContext,
    attachment: NormalizedAgentAttachment,
  ): AttachmentCapabilityDecision {
    if (attachment.kind === 'image') {
      return allowIfMime(attachment, ['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
    }

    if (attachment.kind === 'document' || attachment.kind === 'text') {
      return allow();
    }

    return block('This attachment type is not supported by Claude.');
  }

  async prepare(
    ctx: AttachmentRuntimeContext,
    attachment: NormalizedAgentAttachment,
  ): Promise<PreparedAttachmentPart> {
    const variant = selectClaudeVariant(attachment);
    return {
      runtimeKind: this.runtimeKind,
      attachmentId: attachment.id,
      part: {
        kind: 'claude-content-block',
        value: toClaudeContentBlock(attachment, variant),
      },
      diagnostics: [`prepared ${attachment.kind} for Claude stream-json`],
    };
  }
}
```

## Serialization helpers

```ts
function toClaudeContentBlock(
  attachment: NormalizedAgentAttachment,
  variant: AgentAttachmentVariant,
): Record<string, unknown> {
  if (attachment.kind === 'image') {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: variant.mimeType,
        data: readBase64Variant(variant),
      },
    };
  }

  if (attachment.kind === 'text') {
    return {
      type: 'document',
      source: {
        type: 'text',
        media_type: 'text/plain',
        data: readTextVariant(variant),
      },
      title: attachment.originalName,
    };
  }

  return {
    type: 'document',
    source: {
      type: 'base64',
      media_type: attachment.mimeType,
      data: readBase64Variant(variant),
    },
    title: attachment.originalName,
  };
}
```

## `sendMessageToRun` target shape

Before:

```ts
const contentBlocks = buildInlineInService(message, attachments);
```

After:

```ts
const contentBlocks: Record<string, unknown>[] = [{ type: 'text', text: message }];

if (attachments?.length) {
  const prepared = await this.attachmentDeliveryPlanner.prepareAll(
    {
      teamName: run.teamName,
      providerId: run.providerId,
      modelId: run.model,
      runtimeKind: 'claude-stream-json',
      deliveryTarget: 'lead',
    },
    await this.attachmentNormalizer.normalizeLegacyPayloads(attachments),
  );

  for (const part of prepared) {
    if (part.part.kind !== 'claude-content-block') {
      throw new Error('Internal attachment planner returned non-Claude part for Claude runtime');
    }
    contentBlocks.push(part.part.value);
  }
}
```

## Payload write safety

Before writing stdin:

```ts
const payload = JSON.stringify({
  type: 'user',
  message: {
    role: 'user',
    content: contentBlocks,
  },
});

this.attachmentBudgetValidator.assertSerializedPayloadWithinBudget(payload);
```

If blocked, return actionable error:

```text
Attachments are too large for Claude stream-json input after optimization. Remove one image or send a smaller screenshot.
```

## Edge cases

### Existing text-only sends

No change. If `attachments` is empty, the planner is not called.

### Existing PDF support

Keep current content block shape. Do not optimize PDFs in this phase.

### Non-UTF text files

Keep current behavior: try UTF-8, fallback to base64 document if replacement characters appear.

### Runtime process exits after send

Do not attribute exit to attachment unless the error path can prove stdin write/payload size failure. This phase should only make pre-send failures visible.

### Claude image support in wrong mode

Team lead is long-lived stream-json, so supported. Do not use `claude -p` as e2e validation for this path.

### Multiple images

Send all if under budget. If over budget, send none.

## Diagnostics

Add bounded diagnostics only:

```text
Prepared 2 attachments for Claude stream-json: image/jpeg 612KB, image/png 124KB.
```

Never log:

- base64 content;
- full file paths unless already user-selected and safe;
- API keys;
- raw JSON payload.

## Test plan

### Unit

- image attachment serializes to Claude `image` block;
- PDF serializes to Claude `document` block;
- UTF-8 text serializes to `document` text source;
- non-UTF text falls back to base64 document;
- planner rejects unsupported mime;
- serialized payload over budget rejects before stdin write.

### Service tests

- text-only `sendMessageToRun` does not call planner;
- safe image calls planner and writes stream-json with image block;
- over-budget image throws user-visible error and does not write stdin;
- failure does not mark team offline by itself.

Suggested focused checks:

```bash
pnpm vitest run src/features/agent-attachments/**/*.test.ts test/main/services/team/TeamProvisioningService.test.ts test/main/ipc/teams.test.ts
pnpm typecheck --pretty false
```

## Safety checklist

- Current Claude content block schema preserved.
- No Codex/OpenCode paths touched.
- No launch/provisioning path touched.
- No live provider calls in unit tests.
- Existing UI attachment workflow remains compatible.

## Deep implementation details

### Refactor target

The desired refactor is small and reversible.

Before:

```ts
private async sendMessageToRun(run, message, attachments) {
  const contentBlocks = [{ type: 'text', text: message }];
  // inline attachment serialization here
  stdin.write(JSON.stringify({ ...contentBlocks }) + '\n');
}
```

After:

```ts
private async sendMessageToRun(run, message, attachments) {
  const contentBlocks = await this.buildClaudeLeadContentBlocks(run, message, attachments);
  const payload = this.buildClaudeStreamJsonUserPayload(contentBlocks);
  this.agentAttachments.assertPayloadBudget(payload, { runtime: 'claude-stream-json' });
  await this.writeToLeadStdin(run, payload);
}
```

This keeps `sendMessageToRun()` readable and moves serialization into testable helpers.

### Helper extraction plan

```ts
private async buildClaudeLeadContentBlocks(
  run: ProvisioningRun,
  message: string,
  attachments?: LegacyAttachmentPayload[],
): Promise<Record<string, unknown>[]> {
  const blocks: Record<string, unknown>[] = [{ type: 'text', text: message }];
  if (!attachments?.length) return blocks;

  const prepared = await this.agentAttachments.prepareForRuntime({
    teamName: run.teamName,
    providerId: run.providerId,
    modelId: run.model,
    runtimeKind: 'claude-stream-json',
    deliveryTarget: 'lead',
  }, attachments);

  for (const item of prepared) {
    assertPreparedPartKind(item, 'claude-content-block');
    blocks.push(item.part.value);
  }
  return blocks;
}
```

### Content block compatibility tests

Snapshot the exact old shape.

```ts
expect(toClaudeContentBlock(imageAttachment)).toEqual({
  type: 'image',
  source: {
    type: 'base64',
    media_type: 'image/png',
    data: '...',
  },
});
```

For text:

```ts
expect(toClaudeContentBlock(textAttachment)).toEqual({
  type: 'document',
  source: {
    type: 'text',
    media_type: 'text/plain',
    data: 'hello',
  },
  title: 'notes.txt',
});
```

### Error handling

Use typed attachment errors and convert at IPC boundary.

```ts
try {
  await service.sendMessageToTeam(teamName, message, attachments);
} catch (error) {
  if (isAttachmentValidationError(error)) {
    throw new Error(error.userMessage);
  }
  throw error;
}
```

Do not catch and convert provider/runtime errors here.

### More edge cases

| Edge case | Expected behavior |
|---|---|
| Claude lead is alive but stdin not writable | existing `process stdin is not writable` error wins |
| Payload over budget | no stdin write, no message marked delivered |
| Attachment adapter throws unsupported mime | user-visible attachment error, team remains alive |
| Claude process exits after successful stdin write | existing runtime process close handling owns it |
| PDF title contains slash/newline | sanitized title in content block |
| Text file is empty | send empty text document or block? Prefer send with warning `empty text file` |
| Message text empty but image present | allow if composer supports image-only send; text block can be empty or omitted consistently |
| Multiple attachments include one invalid | block all, do not partial-send |
| Optimized variant missing | rebuild from legacy base64 or block with retryable local error |

### Why not change delivery proof

Claude lead message delivery currently depends on process stdin write and subsequent assistant stream/result. This phase does not add proof. It only makes payload construction safe.

Do not add new notifications like “image delivered” because it would imply semantic understanding.

### Regression traps

- Accidentally using optimized JPEG for transparent PNG without user-visible warning.
- Forgetting to include `title` for documents.
- Throwing generic `Internal attachment planner returned...` to user instead of diagnostics.
- Double-validating text-only messages and blocking them due missing attachment metadata.
- Logging full stream-json payload in debug output.

## File-by-file implementation plan

### 1. Add adapter

Create:

```text
src/features/agent-attachments/main/adapters/output/ClaudeStreamJsonAttachmentAdapter.ts
```

This file should depend only on feature contracts/core and small shared helpers.

### 2. Add facade method

In feature composition, expose:

```ts
prepareClaudeStreamJsonContentBlocks(input): Promise<Record<string, unknown>[]>
```

or a generic:

```ts
prepareForRuntime(ctx, attachments): Promise<PreparedAttachmentPart[]>
```

Prefer generic if Phase 3/4 will reuse it soon. Prefer Claude-specific if generic abstraction becomes too abstract too early. The plan's recommendation remains generic, but keep the public facade small.

### 3. Update TeamProvisioningService

Change only the attachment serialization part of `sendMessageToRun()`.

Do not change:

- run tracking;
- process liveness checks;
- stdin writable checks;
- lead activity updates;
- close/error handling.

### 4. Add focused tests

Update existing `TeamProvisioningService.test.ts` only around send message attachment cases. Add adapter unit tests under feature tests.

## Compatibility shim

Because Phase 1 may still use legacy payloads, adapter should accept normalized attachments from a shim.

```ts
async function normalizeForClaudeAdapter(
  legacy: LegacyTeamMessageAttachment[],
): Promise<NormalizedAgentAttachment[]> {
  return this.normalizer.normalizeLegacyPayloads(legacy, {
    preferredRuntime: 'claude-stream-json',
  });
}
```

## Detailed failure cases and expected messages

| Failure | User message | Internal diagnostic |
|---|---|---|
| payload over serialized budget | `Attachments are too large for Claude input after optimization.` | include estimated bytes and limit |
| unsupported MIME | `This attachment type is not supported by Claude.` | include MIME and filename sanitized |
| corrupt image missed by renderer | `Cannot send image because it could not be decoded.` | include attachment id only |
| stdin not writable | existing `Team process stdin is not writable` | not attachment diagnostic |
| Claude API says image invalid | preserve provider error | not rewritten as optimizer error |

## Review checklist

- Adapter output equals previous content block shape for same input.
- Payload budget check happens before `stdin.write`.
- Error handling does not mark team offline.
- No base64 in thrown error message.
- No tests require Claude live auth.
- Text-only send test still passes without creating feature attachments.

## More examples

### Image block

```ts
const block = adapter.toClaudeContentBlock(imageAttachment);
expect(block).toMatchObject({
  type: 'image',
  source: {
    type: 'base64',
    media_type: 'image/jpeg',
  },
});
expect(String((block.source as any).data)).toHaveLength(imageBase64.length);
```

### Full payload budget assertion

```ts
const payload = buildClaudeStreamJsonPayload([{ type: 'text', text }, imageBlock]);
expect(() => validator.assertWithinBudget(payload)).not.toThrow();
```

### Negative payload budget assertion

```ts
const huge = makeFakeBase64(8_000_000);
expect(() => buildAndValidatePayload(huge)).toThrowAgentAttachmentError(
  'attachment_serialized_payload_too_large',
);
```

## Phase 2 exit criteria

Phase 2 is complete only when:

- old Claude image/PDF/text content block shapes are preserved;
- text-only sends bypass attachment adapter;
- oversized attachment blocks before stdin write;
- adapter errors do not mark team offline;
- copied diagnostics include attachment summary but no base64;
- no Codex/OpenCode path changes are included.

## Migration seam

Replace only this concern in `TeamProvisioningService`:

```text
legacy attachments -> Claude content blocks
```

Do not touch:

```text
run selection
stdin lifecycle
process close handling
lead activity state
message persistence
```

## Claude adapter detailed API

```ts
export interface ClaudeContentBlockBuildInput {
  messageText: string;
  attachments: NormalizedAgentAttachment[];
  budget: AgentAttachmentBudget;
}

export interface ClaudeContentBlockBuildOutput {
  contentBlocks: Record<string, unknown>[];
  estimatedSerializedBytes: number;
  diagnostics: string[];
}
```

This allows tests to assert payload size without writing to stdin.

## Safe payload builder

```ts
export function buildClaudeStreamJsonUserPayload(
  contentBlocks: Record<string, unknown>[],
): string {
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: contentBlocks,
    },
  });
}
```

Keep this helper tiny and deterministic.

## Stdin write failure handling

Attachment errors happen before write. Stdin write errors are runtime errors.

```ts
try {
  const payload = buildClaudeStreamJsonUserPayload(blocks);
  this.agentAttachments.assertPayloadBudget(payload);
  await writeLine(stdin, payload);
} catch (error) {
  if (isAgentAttachmentError(error)) throw error;
  throw new Error(`Team "${run.teamName}" process stdin is not writable`);
}
```

Do not wrap provider/runtime errors as attachment errors.

## More Claude-specific edge cases

| Edge case | Expected behavior |
|---|---|
| `image/webp` sent to Claude | allow only if current existing path allowed it; otherwise block consistently |
| `image/gif` animated | preserve existing behavior if under budget, but warn in Phase 1 |
| empty message with image | allow only if current composer allows it; otherwise composer-level validation |
| PDF over budget | block with attachment size message |
| text file with invalid UTF-8 | fallback base64 document as current code did |
| Claude returns `Could not process image` | show provider error, do not blame optimizer unless image validation failed locally |
| CLI output includes image processing error | include bounded stderr tail in diagnostics through existing runtime mechanisms |

## Test skeleton for no stdin write on budget failure

```ts
it('does not write to stdin when attachment payload exceeds Claude budget', async () => {
  const stdin = fakeWritable();
  await expect(service.sendMessageToRun(runWithStdin(stdin), 'x', [hugeImage]))
    .rejects.toThrow(/too large/i);
  expect(stdin.write).not.toHaveBeenCalled();
});
```

## Code review notes

If the diff shows a new `if (mimeType)` ladder inside `TeamProvisioningService`, the refactor failed. That logic belongs in adapter/helper tests.
