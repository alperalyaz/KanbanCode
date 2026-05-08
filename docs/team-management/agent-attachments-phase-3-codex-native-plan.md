# Phase 3 - Codex native image attachment delivery

## Summary

Goal: support image attachments for Codex native teammates by using Codex CLI's supported `--image <FILE>` transport rather than embedding base64 in prompt text.

Chosen approach: **optimized image artifact files + Codex native exec args extension + text-only fallback errors for unsupported attachment kinds**.

🎯 8.6   🛡️ 8.4   🧠 6.6  
Estimated change size: `260-440` LOC across two repos.

Repos:

- `/Users/belief/dev/projects/claude/claude_team`
- `/Users/belief/dev/projects/claude/agent_teams_orchestrator`

## Live proof

Validated manually:

```bash
printf '%s\n' 'Look at the attached image. Reply with exactly one word: red, green, or blue.' \
  | codex exec --json --skip-git-repo-check -C /tmp \
      --model gpt-5.4-mini \
      --image /tmp/agent-attachment-prototypes/red-card-valid.png \
      --output-last-message /tmp/agent-attachment-prototypes/codex-last.txt \
      -
```

Result:

```text
red
```

Therefore Codex adapter should pass file paths.

## Current blocker

`agent_teams_orchestrator` currently rejects non-text prompts in Codex native:

```text
Codex native phase 0 only supports text-only prompts. Images, documents, and structured input are not wired yet.
```

Likely locations:

```text
agent_teams_orchestrator/src/services/codexNative/turnExecutor.ts
agent_teams_orchestrator/src/services/codexNative/execRunner.ts
```

Do not remove this guard globally. Replace it with structured extraction for supported image content only.

## Data contract

Add a Codex native input shape that can represent text plus image files.

```ts
export interface CodexNativeTurnInput {
  promptText: string;
  imagePaths: string[];
}
```

If the current internal API only accepts text, introduce a narrow overload or adapter:

```ts
export type CodexNativePromptInput =
  | { kind: 'text'; text: string }
  | { kind: 'text-with-images'; text: string; imagePaths: string[] };
```

Do not pass base64 into Codex prompt text.

## Claude-team side adapter

`CodexNativeAttachmentAdapter` should prepare image artifacts.

```ts
export class CodexNativeAttachmentAdapter implements AttachmentDeliveryAdapter {
  readonly runtimeKind = 'codex-native' as const;

  canDeliver(ctx: AttachmentRuntimeContext, attachment: NormalizedAgentAttachment) {
    if (attachment.kind !== 'image') {
      return block('Codex native currently supports image attachments only.');
    }
    return allowIfMime(attachment, ['image/png', 'image/jpeg', 'image/webp']);
  }

  async prepare(ctx: AttachmentRuntimeContext, attachment: NormalizedAgentAttachment) {
    const variant = selectCodexImageFileVariant(attachment);
    const path = await this.artifactStore.materializeFileVariant(variant, {
      teamName: ctx.teamName,
      runtime: 'codex-native',
    });

    return {
      runtimeKind: this.runtimeKind,
      attachmentId: attachment.id,
      part: { kind: 'codex-image-arg', path },
      diagnostics: [`prepared image file for Codex native: ${formatBytes(variant.byteSize)}`],
    };
  }
}
```

Artifact directory should be app-owned and not user-editable:

```text
~/.claude/teams/<team>/attachments/<message-id>/<attachment-id>/<variant-id>.<ext>
```

If existing team data conventions prefer another base path, use that. The key is deterministic metadata and cleanup safety.

## Orchestrator changes

### Extract Codex image paths from content blocks

```ts
export function toCodexNativeTurnInput(input: string | ContentBlockParam[]): CodexNativeTurnInput {
  if (typeof input === 'string') {
    return { promptText: input, imagePaths: [] };
  }

  const textParts: string[] = [];
  const imagePaths: string[] = [];

  for (const block of input) {
    if (block.type === 'text') {
      textParts.push(block.text);
      continue;
    }

    if (block.type === 'image') {
      const path = materializeCodexImageBlockToTempFile(block);
      imagePaths.push(path);
      continue;
    }

    throw new Error(`Codex native does not support ${block.type} attachments yet.`);
  }

  return {
    promptText: textParts.join('\n\n').trim(),
    imagePaths,
  };
}
```

Preferred path: desktop already materializes artifacts and passes paths, so orchestrator should not need to decode base64 except for compatibility with direct SDK/fork calls.

### Extend exec args

```ts
export function buildCodexNativeExecArgs(options: CodexNativeExecOptions): string[] {
  return [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '-C', options.cwd,
    ...options.imagePaths.flatMap(path => ['--image', path]),
    '-',
  ];
}
```

### Preserve stdin prompt behavior

Keep:

```ts
child.stdin.end(options.prompt);
```

Do not switch to putting the prompt in argv if it can be long.

## Edge cases

### Image file path missing before Codex starts

Expected behavior:

- fail before spawn with a clear error;
- do not start Codex with missing `--image` path.

### Multiple images

Codex CLI supports repeatable `--image <FILE>`. Pass one arg pair per image.

### Unsupported document/PDF

Expected behavior:

```text
Codex native does not support PDF attachments yet. Send text or images only.
```

Do not silently convert PDF to text in this phase.

### OpenAI account/session issue

Attachment code must not mask auth errors. If Codex says login required, show Codex auth error unchanged.

### Artifact cleanup

Do not delete image files immediately after spawn. Codex may read after process start. Keep artifacts with message/team data and clean with team cleanup or retention policy.

### Project path sandbox

Codex gets `--image` absolute paths outside project. Confirm current Codex CLI accepts this. Live test used `/tmp`, so it does. If future sandbox blocks, copy artifacts into an app-owned allowed directory.

## Test plan

### Orchestrator unit

- text-only input produces no `--image` args;
- text plus one image produces one `--image` arg;
- multiple images produce repeated args in order;
- unsupported document block throws clear error;
- missing image path throws before spawn;
- prompt still goes to stdin.

### Desktop unit/service

- Codex adapter chooses file variant;
- artifact materialization writes expected file;
- planner blocks PDF for Codex;
- error messages do not include base64.

### Live e2e

Only when explicitly requested:

```bash
codex exec --json --skip-git-repo-check -C /tmp --model gpt-5.4-mini --image red-card-valid.png -
```

Expected final message:

```text
red
```

Suggested focused checks:

```bash
# claude_team
pnpm vitest run src/features/agent-attachments/**/*.test.ts test/main/services/team/TeamProvisioningService.test.ts
pnpm typecheck --pretty false

# agent_teams_orchestrator
bun test src/services/codexNative/*.test.ts
```

## Safety checklist

- Text-only Codex path unchanged.
- Auth/session errors preserved.
- No base64 in prompt text.
- No immediate cleanup of image files after spawn.
- Unsupported files fail before model call.

## Deep implementation details

### Two-repo boundary

Desktop should decide and materialize attachment artifacts. Orchestrator should execute Codex with prepared input.

```text
claude_team:
  normalize/optimize/store image
  decide Codex supports image
  pass prepared prompt + image artifact refs into runtime handoff

agent_teams_orchestrator:
  accept text + imagePaths
  validate files exist/readable
  append --image args
  keep prompt on stdin
```

Avoid making orchestrator depend on desktop feature internals.

### Minimal orchestrator type extension

```ts
export interface CodexNativeExecOptions {
  cwd: string;
  prompt: string;
  model?: string;
  imagePaths?: string[];
  env?: NodeJS.ProcessEnv;
}
```

Default `imagePaths = []` preserves existing callers.

### Args builder exact behavior

```ts
export function buildCodexNativeExecArgs(options: CodexNativeExecOptions): string[] {
  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '-C',
    options.cwd,
  ];

  if (options.model) {
    args.push('--model', options.model);
  }

  for (const imagePath of options.imagePaths ?? []) {
    args.push('--image', imagePath);
  }

  args.push('-');
  return args;
}
```

Order matters. Keep `-` last so stdin is prompt.

### File validation before spawn

```ts
async function assertCodexImageFilesReady(paths: string[]): Promise<void> {
  for (const imagePath of paths) {
    const stat = await fs.promises.stat(imagePath).catch(() => null);
    if (!stat?.isFile()) {
      throw new Error(`Codex image attachment is missing: ${path.basename(imagePath)}`);
    }
    if (stat.size <= 0) {
      throw new Error(`Codex image attachment is empty: ${path.basename(imagePath)}`);
    }
    if (stat.size > CODEX_IMAGE_FILE_MAX_BYTES) {
      throw new Error(`Codex image attachment is too large: ${path.basename(imagePath)}`);
    }
  }
}
```

Do not include full absolute paths in user messages unless copied diagnostics need them and they are redacted/safe.

### Desktop artifact store contract

```ts
export interface AttachmentArtifactStore {
  materializeVariantFile(input: {
    teamName: string;
    messageId: string;
    attachmentId: string;
    variantId: string;
    filename: string;
    base64: string;
    expectedSha256: string;
  }): Promise<{ path: string; bytes: number; sha256: string }>;
}
```

Validation:

- directory created with recursive mkdir;
- filename sanitized;
- write to temp file then rename;
- sha256 verified after write;
- if existing file has same sha256, reuse;
- if existing file mismatch, rewrite from original.

### Artifact write pattern

```ts
const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
await fs.promises.writeFile(tmp, bytes, { flag: 'wx' }).catch(async error => {
  if (error.code === 'EEXIST') {
    await fs.promises.rm(tmp, { force: true });
    await fs.promises.writeFile(tmp, bytes, { flag: 'wx' });
    return;
  }
  throw error;
});
await fs.promises.rename(tmp, target);
```

Prefer a shared atomic write helper if one already exists.

### More edge cases

| Edge case | Expected behavior |
|---|---|
| Codex login expires | Codex auth error shown unchanged |
| Image path contains spaces | args array handles it, no shell quoting needed |
| Artifact deleted between validation and spawn | Codex may fail; surface exact stderr, but pre-spawn validation reduces probability |
| Multiple Codex members use same attachment | artifact store can reuse same variant path by hash |
| User sends image to Codex lead while lead busy | existing lead busy/message delivery semantics remain unchanged |
| Codex model selected is text-only in future | capability gate should block when catalog knows; otherwise live model may error, preserve exact error |
| Image is WebP | if Codex accepts through `--image`, allow; otherwise convert to PNG/JPEG in Phase 1/adapter policy |
| PDF attached to Codex | block in v1 with clear message |

### Test additions in orchestrator

```ts
test('adds repeated --image args before stdin marker', () => {
  expect(buildCodexNativeExecArgs({ cwd: '/tmp', prompt: 'x', imagePaths: ['/a.png', '/b.jpg'] }))
    .toContainSequence(['--image', '/a.png', '--image', '/b.jpg', '-']);
});
```

```ts
test('keeps text-only args unchanged', () => {
  expect(buildCodexNativeExecArgs({ cwd: '/tmp', prompt: 'x' }))
    .not.toContain('--image');
});
```

### Regression traps

- Passing prompt as argv and accidentally truncating/escaping long prompts.
- Deleting artifact file in finally before Codex has read it.
- Allowing arbitrary renderer-supplied paths into `--image`.
- Hiding Codex auth errors behind `Attachment failed`.
- Treating Codex CLI `turn.completed` as image-understood proof without response content.

## File-by-file implementation plan

### claude_team

Potential files:

```text
src/features/agent-attachments/main/adapters/output/CodexNativeAttachmentAdapter.ts
src/features/agent-attachments/main/infrastructure/AttachmentArtifactStore.ts
src/main/services/team/TeamProvisioningService.ts
src/main/ipc/teams.ts
```

Keep the desktop side responsible for app-owned artifact paths.

### agent_teams_orchestrator

Potential files:

```text
src/services/codexNative/turnExecutor.ts
src/services/codexNative/execRunner.ts
src/services/codexNative/*.test.ts
```

Make the orchestrator change backward compatible by defaulting `imagePaths` to `[]`.

## Integration contract between repos

If the desktop already invokes orchestrator through a structured prompt, add image paths explicitly rather than hiding them in text.

Preferred:

```ts
interface NativeRuntimePromptEnvelope {
  text: string;
  attachments?: Array<{
    kind: 'image-file';
    path: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    sha256: string;
  }>;
}
```

Avoid:

```text
Here is an image: /tmp/foo.png
```

unless the runtime explicitly cannot accept images and user chose a textual fallback.

## Artifact security rules

- Renderer never supplies final file path.
- Backend chooses artifact path under app-owned directory.
- Path traversal in filename is sanitized.
- Artifact path passed to Codex is absolute.
- Artifact checksum is verified after write.
- Artifact metadata does not include API keys or user prompt text.

## More detailed edge cases

| Edge case | Expected behavior |
|---|---|
| Codex process starts but exits before reading image | surface exact Codex stderr/exit code |
| Artifact file exists but unreadable due permissions | fail before spawn if detectable |
| Two sends with same image and same message id | reuse same artifact variant |
| Two sends with same image but different message id | allow separate metadata, optionally same content-addressed blob |
| Image path has non-ASCII filename | store sanitized ASCII filename plus metadata originalName |
| User cancels send during artifact write | abort write if supported, cleanup temp file |
| Codex CLI changes `--image` flag | tests fail at args builder/live smoke before release |

## Test code skeleton

```ts
describe('CodexNativeAttachmentAdapter', () => {
  it('materializes image variant and returns codex image arg', async () => {
    const adapter = new CodexNativeAttachmentAdapter(fakeArtifactStore);
    const part = await adapter.prepare(ctx, imageAttachment);
    expect(part.part).toEqual({ kind: 'codex-image-arg', path: '/tmp/app/att/red.png' });
  });

  it('blocks PDF attachments', () => {
    const decision = adapter.canDeliver(ctx, pdfAttachment);
    expect(decision.allowed).toBe(false);
    expect(decision.blockers[0].code).toBe('attachment_runtime_unsupported');
  });
});
```

```ts
describe('buildCodexNativeExecArgs', () => {
  it('keeps stdin marker last with image args before it', () => {
    expect(buildCodexNativeExecArgs({ cwd: '/tmp', prompt: 'x', imagePaths: ['/a.png'] }))
      .toEqual(expect.arrayContaining(['--image', '/a.png', '-']));
  });
});
```

## Review checklist

- Existing text-only Codex tests still pass.
- `imagePaths` default is empty.
- No shell string command building for image paths.
- Missing image file fails before spawn where possible.
- Auth errors are not converted to attachment errors.
- The feature works with Codex subscription auth, not only API key.

## Phase 3 exit criteria

Phase 3 is complete only when:

- text-only Codex native still uses the same exec path;
- Codex image send uses `--image <path>` and stdin prompt;
- image paths come only from app-owned artifacts;
- missing artifact fails before spawn;
- unsupported PDFs/documents are blocked before Codex call;
- Codex auth errors remain exact;
- no OpenCode/Claude code changes are included except shared interfaces.

## Cross-repo sequencing

Recommended order:

1. Orchestrator: add optional `imagePaths` to Codex exec runner with tests.
2. Orchestrator: keep turn executor text-only behavior unless image paths are explicitly supplied.
3. Desktop: add Codex adapter that materializes image files.
4. Desktop: wire Codex adapter only for Codex native send path.
5. Live smoke Codex with `gpt-5.4-mini`.

Do not wire desktop before orchestrator can safely accept `imagePaths`.

## Backward compatibility in orchestrator

```ts
function normalizeExecOptions(options: CodexNativeExecOptions): Required<Pick<CodexNativeExecOptions, 'imagePaths'>> {
  return {
    imagePaths: options.imagePaths ?? [],
  };
}
```

Existing tests should not need imagePaths.

## Handling structured content blocks

If orchestrator receives Anthropic-style content blocks, only support image blocks when they already point to app-owned artifacts or can be materialized safely.

V1 preference:

```text
Desktop passes file paths, not base64 blocks, to Codex native.
```

If a direct orchestrator caller passes base64 image blocks, fail with clear TODO unless implementing materialization there too.

```ts
throw new Error('Codex native image blocks must be materialized to file paths before execution.');
```

This prevents duplicate artifact stores across repos.

## Codex path validation nuance

Do not require image file to be inside project cwd. Live test showed `/tmp` works. Requiring cwd-only would break app-owned artifact store. Instead require:

- absolute path;
- file exists;
- file extension/MIME allowed;
- size under budget;
- path was produced by trusted desktop adapter or trusted test input.

## More Codex tests

```ts
it('rejects relative image paths', async () => {
  await expect(runCodexNativeExec({ prompt: 'x', imagePaths: ['foo.png'] }))
    .rejects.toThrow(/absolute/i);
});
```

```ts
it('does not include image path in prompt stdin', async () => {
  const child = fakeCodexChild();
  await runner.run({ prompt: 'describe', imagePaths: ['/tmp/a.png'] });
  expect(child.stdin.end).toHaveBeenCalledWith('describe');
});
```

## More Codex bug traps

| Trap | Prevention |
|---|---|
| prompt accidentally becomes argv | assert `-` remains final arg |
| image path included twice | test exact args |
| artifact path deleted too early | keep artifacts with message retention |
| base64 path from renderer | backend-only artifact store |
| Codex auth failure hidden | do not catch provider errors as attachment errors |
| unsupported PDF converted to prompt text silently | block explicitly |
