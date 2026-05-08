# Phase 5 - Cross-runtime attachment E2E, diagnostics, docs, and polish

## Summary

Goal: make the completed attachment system observable, testable, and understandable for users before release.

Chosen approach: **small live smoke harness + deterministic diagnostics + UI copy polish + documentation**, with no new runtime semantics.

🎯 8.8   🛡️ 8.7   🧠 5.4  
Estimated change size: `180-320` LOC plus tests/docs.

This phase should happen after Claude, Codex, and OpenCode adapters are implemented. It should not introduce new delivery behavior.

## Deliverables

- live attachment smoke script;
- reusable test fixture image generator;
- user-visible diagnostics for unsupported models and oversized images;
- docs for supported runtimes/models;
- release checklist.

## Live smoke harness

Create a script that generates a deterministic image and runs each supported runtime.

Suggested location:

```text
scripts/smoke/agent-attachments-smoke.mjs
```

Sketch:

```ts
const cases = [
  {
    id: 'claude-subscription-streaming',
    runtime: 'claude',
    model: 'claude-haiku-4-5',
    expected: /red/i,
  },
  {
    id: 'codex-native-gpt-5-4-mini',
    runtime: 'codex',
    model: 'gpt-5.4-mini',
    expected: /red/i,
  },
  {
    id: 'opencode-openai-gpt-5-4-mini',
    runtime: 'opencode',
    model: 'openai/gpt-5.4-mini',
    expected: /red/i,
  },
  {
    id: 'opencode-openrouter-kimi-k2-6',
    runtime: 'opencode',
    model: 'openrouter/moonshotai/kimi-k2.6',
    envRequired: ['OPENROUTER_API_KEY'],
    expected: /red/i,
  },
  {
    id: 'opencode-openrouter-glm-4-5v',
    runtime: 'opencode',
    model: 'openrouter/z-ai/glm-4.5v',
    envRequired: ['OPENROUTER_API_KEY'],
    expected: /red/i,
  },
  {
    id: 'opencode-openrouter-glm-5-1-negative',
    runtime: 'opencode',
    model: 'openrouter/z-ai/glm-5.1',
    envRequired: ['OPENROUTER_API_KEY'],
    expectedUnsupported: true,
  },
];
```

The harness must:

- redact keys;
- use timeouts;
- kill child processes on timeout;
- write structured JSON result;
- skip cases when required auth/env is missing;
- never print base64 image content.

## Deterministic fixture image

Do not depend on external image files.

Generate a small valid PNG with Node `zlib` and CRC32, like the prototype did.

```ts
export function writeRedCardPng(path: string): void {
  // 320x240 red card with white center marker.
}
```

This avoids flaky fixtures and keeps smoke tests self-contained.

## Diagnostics UX

Add compact diagnostics wherever attachments are shown or rejected.

Examples:

```text
Sent 1 optimized image: screenshot.jpg, 1920x1080, 612 KB.
```

```text
Images are not supported by openrouter/z-ai/glm-5.1. Choose GLM 4.5V, Kimi K2.6, GPT-5.4-mini, Claude, or Codex.
```

```text
Attachment payload is too large after optimization: 8.4 MB serialized. Limit is 7.5 MB.
```

```text
OpenRouter is not connected in OpenCode. Connect OpenRouter before using this model.
```

## Copy diagnostics

When user copies diagnostics for a failed send, include:

```text
Attachment summary:
- files: 2
- optimized bytes: 1.2 MB
- estimated serialized payload: 1.7 MB
- target runtime: opencode
- target model: openrouter/z-ai/glm-5.1
- capability decision: unsupported image input
```

Do not include:

- base64;
- full API keys;
- bearer tokens;
- raw data URLs.

## Documentation

Add docs under:

```text
docs/team-management/agent-attachments.md
```

Contents:

- supported runtimes;
- supported model examples;
- unsupported model examples;
- why images may be resized;
- why some models cannot receive screenshots;
- troubleshooting auth/provider issues;
- how to run smoke tests.

## Release checklist

Before release:

- text-only messages still work for Claude/Codex/OpenCode;
- oversized image blocked before send;
- Claude image send works;
- Codex image send works;
- OpenCode OpenAI image send works;
- OpenCode OpenRouter Kimi works if key configured;
- OpenCode GLM 5.1 image is blocked or clearly marked unsupported;
- no base64 appears in logs, copied diagnostics, or UI error text;
- retry with attachments reuses artifacts or fails loudly;
- removing attachments clears warnings;
- unsupported model warning updates when model changes.

## E2E scenarios

### Scenario 1 - Claude lead screenshot

```text
Create/launch Claude team -> send screenshot to lead -> lead answers about image.
```

Expected:

- no process crash;
- message visible;
- optimized attachment notice visible;
- lead response received.

### Scenario 2 - Codex lead screenshot

```text
Create/launch Codex team -> send screenshot -> Codex sees image via --image.
```

Expected:

- artifact file created;
- Codex args include `--image`;
- no base64 in prompt text;
- response received.

### Scenario 3 - OpenCode supported model

```text
OpenCode Kimi K2.6 secondary -> direct user message with screenshot.
```

Expected:

- file part delivered;
- delivery proof still required;
- response visible.

### Scenario 4 - OpenCode unsupported model

```text
OpenCode GLM 5.1 secondary -> attempt screenshot send.
```

Expected:

- send blocked before model call;
- message explains model does not support image input;
- no fake queued/pending delivery;
- text-only send still works.

### Scenario 5 - Oversized multi-image send

```text
Attach 5 large screenshots.
```

Expected:

- optimizer reduces where safe;
- if still too large, send blocked;
- no partial delivery.

## Test plan

Suggested focused checks:

```bash
pnpm vitest run src/features/agent-attachments/**/*.test.ts test/main/ipc/teams.test.ts test/renderer/components/team/messages/MessageComposer.test.tsx
pnpm vitest run test/main/services/team/TeamProvisioningService.test.ts test/main/services/team/OpenCodePromptDeliveryLedger.test.ts
pnpm typecheck --pretty false
```

Live smoke only when requested:

```bash
node scripts/smoke/agent-attachments-smoke.mjs --case claude-subscription-streaming
node scripts/smoke/agent-attachments-smoke.mjs --case codex-native-gpt-5-4-mini
OPENROUTER_API_KEY=... node scripts/smoke/agent-attachments-smoke.mjs --case opencode-openrouter-kimi-k2-6
```

## Safety checklist

- Smoke harness redacts secrets.
- Live tests have timeouts and cleanup.
- Docs clearly separate transport support from model vision support.
- No new runtime behavior is introduced in this phase.

## Deep implementation details

### Live smoke output contract

The smoke script should write machine-readable JSON and concise console output.

```ts
export interface AttachmentSmokeResult {
  id: string;
  runtime: 'claude' | 'codex' | 'opencode';
  model: string;
  status: 'passed' | 'failed' | 'skipped';
  reason?: string;
  responseText?: string;
  durationMs: number;
  diagnostics: string[];
}
```

Console output example:

```text
PASS claude-subscription-streaming -> red
PASS codex-native-gpt-5-4-mini -> red
SKIP opencode-openrouter-kimi-k2-6 -> OPENROUTER_API_KEY not set
FAIL opencode-openrouter-glm-5-1-negative -> expected unsupported but got red
```

Never print secrets.

### Timeout wrapper

```ts
async function runWithTimeout<T>(label: string, timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${label} timed out`)), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
```

For child processes, abort must kill process group when possible.

### Redaction helper

```ts
export function redactAttachmentSmokeLog(input: string): string {
  return input
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, 'sk-or-v1-[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, 'data:image/[REDACTED];base64,[REDACTED]');
}
```

### Docs structure

`docs/team-management/agent-attachments.md` should include:

```text
# Agent attachments

## Supported runtimes
## Supported image models
## Unsupported or unverified models
## Why screenshots are optimized
## Troubleshooting
## Running smoke tests
## Security and privacy notes
```

### UI polish details

Attachment preview should show:

```text
screenshot.jpg
1920x1080 - 612 KB - optimized
```

Unsupported model warning should include direct action:

```text
Change model
Remove image
```

Do not show internal provider ids only. Use friendly label when available:

```text
GLM 5.1 via OpenRouter
```

But copied diagnostics should include exact model id:

```text
modelId=openrouter/z-ai/glm-5.1
```

### More e2e cases

| Scenario | Expected |
|---|---|
| Text-only message after failed image send | succeeds normally |
| User removes unsupported image and sends text | no stale warning blocks send |
| User switches from GLM 5.1 to GLM 4.5V | warning clears and send allowed |
| User switches from OpenCode to Claude | OpenCode model warning disappears, Claude budget warning remains if oversized |
| OpenRouter key missing | OpenRouter smoke skipped, not failed |
| OpenRouter quota exhausted | smoke failed with provider quota diagnostic, no secret printed |
| Codex auth expired | Codex smoke failed with auth diagnostic, attachment system not blamed |
| Claude subscription over limit | Claude smoke failed with provider limit diagnostic, attachment system not blamed |

### Release readiness scoring

Before shipping, score each area:

| Area | Target score |
|---|---:|
| Text-only regression confidence | 9/10 |
| Oversized image protection | 9/10 |
| Claude image path | 8.5/10 |
| Codex image path | 8/10 |
| OpenCode OpenAI image path | 8/10 |
| OpenCode OpenRouter model gating | 7.5/10 |
| User-facing errors | 8.5/10 |

If any score is below target, do not release the whole attachment feature. Ship only earlier phases.

### Regression traps

- Smoke tests accidentally depend on local user secrets and fail in CI.
- UI says “image sent” when only optimization happened.
- Diagnostics copy includes data URL.
- Docs overpromise unknown OpenRouter models.
- Negative model smoke becomes flaky because provider upgrades model capability. If GLM 5.1 starts supporting images, update catalog and test expectation.

## File-by-file implementation plan

### Smoke script

Create:

```text
scripts/smoke/agent-attachments-smoke.mjs
```

Optional helper:

```text
scripts/smoke/lib/write-red-card-png.mjs
scripts/smoke/lib/redact-smoke-log.mjs
```

Do not put live smoke in normal test suite by default.

### Documentation

Create:

```text
docs/team-management/agent-attachments.md
```

Link it from:

```text
docs/team-management/debugging-agent-teams.md
```

only if it helps support/debugging.

### UI polish tests

Potential tests:

```text
test/renderer/components/team/messages/MessageComposer.test.tsx
test/renderer/utils/attachmentUtils.test.ts
src/features/agent-attachments/**/*.test.ts
```

## Smoke script behavior details

### CLI options

```bash
node scripts/smoke/agent-attachments-smoke.mjs --all
node scripts/smoke/agent-attachments-smoke.mjs --case codex-native-gpt-5-4-mini
node scripts/smoke/agent-attachments-smoke.mjs --json /tmp/attachment-smoke.json
```

### Skip logic

```ts
if (case.envRequired?.some(name => !process.env[name])) {
  return { status: 'skipped', reason: `${name} not set` };
}
```

Missing auth should be `failed` if the runtime is expected to be locally logged in, but OpenRouter env cases can be `skipped` if key absent.

### Child process cleanup

```ts
const child = spawn(command, args, { detached: true });
try {
  return await waitForResult(child, timeoutMs);
} finally {
  if (!child.killed) {
    try { process.kill(-child.pid!, 'SIGTERM'); } catch {}
  }
}
```

Be careful on macOS where process groups may differ. If not detached, kill child pid only.

## Docs examples

### Supported model section

```md
## Verified image-capable models

- Claude subscription via stream-json
- Codex native GPT-5.4-mini via `--image`
- OpenCode OpenAI GPT-5.4-mini
- OpenCode OpenRouter Kimi K2.6
- OpenCode OpenRouter GLM 4.5V
```

### Unsupported model section

```md
## Known unsupported or text-only models

- OpenCode OpenRouter GLM 5.1: accepts text but does not support image input in live smoke.
```

### Troubleshooting section

```md
If OpenCode says `Provider not found: openrouter`, connect OpenRouter in provider management or provide `OPENROUTER_API_KEY` for smoke tests.
```

## More polish edge cases

| Edge case | UI/docs behavior |
|---|---|
| User sees “not verified” for a model they know supports vision | docs explain conservative default and how to request/verify model |
| Live smoke passes for a previously unknown model | update capability catalog in separate commit |
| Provider changes model behavior | negative smoke catches mismatch, catalog updated deliberately |
| User reports model saw image but UI blocked | add override only after reproducing or provider metadata confirms |
| User reports image too blurry | adjust Phase 1 quality policy, not provider adapters |
| User reports process crashed with image | diagnostics should include payload bytes and runtime stderr tail, not base64 |

## Final release decision tree

```text
If Phase 1 is green but Phase 2 is risky -> ship safer budget validation only.
If Claude is green but Codex is flaky -> ship Claude only, keep Codex blocked.
If Codex is green but OpenCode model gate is incomplete -> ship Claude+Codex, keep OpenCode blocked.
If OpenCode OpenAI is green but OpenRouter is unstable -> allow OpenAI, block OpenRouter unknowns.
```

Do not hold safer early phases hostage to later dynamic OpenRouter model risk.

## Phase 5 exit criteria

Phase 5 is complete only when:

- smoke harness can run selected cases independently;
- smoke harness redacts secrets and data URLs;
- docs list verified and unsupported models separately;
- UI copy does not overpromise unknown models;
- copied diagnostics include enough metadata to debug without leaking payload;
- release checklist is green or explicitly scoped down.

## Smoke harness case definitions

```ts
const cases: AttachmentSmokeCase[] = [
  {
    id: 'claude-streaming-haiku',
    runtime: 'claude',
    command: 'node',
    args: ['scripts/smoke/runners/claude-sdk-image.mjs'],
    expected: /\bred\b/i,
    timeoutMs: 60_000,
  },
  {
    id: 'codex-native-gpt-5-4-mini',
    runtime: 'codex',
    command: 'codex',
    args: ['exec', '--json', '--skip-git-repo-check', '-C', '/tmp', '--model', 'gpt-5.4-mini', '--image', '$IMAGE', '-'],
    stdin: 'Look at the attached image. Reply with exactly one word: red, green, or blue.',
    expected: /\bred\b/i,
    timeoutMs: 90_000,
  },
  {
    id: 'opencode-openrouter-glm-5-1-negative',
    runtime: 'opencode',
    envRequired: ['OPENROUTER_API_KEY'],
    expectCapabilityBlocked: true,
  },
];
```

For negative cases after Phase 4, prefer testing the app capability gate rather than spending OpenRouter tokens calling known unsupported models.

## Diagnostics copy example

```text
Attachment delivery diagnostic
team: atlas-hq
recipient: jack
runtime: opencode
model: openrouter/z-ai/glm-5.1
attachments: 1 image
optimized bytes: 612 KB
estimated serialized bytes: 842 KB
capability: unsupported
reason: GLM 5.1 is text-only for image input in verified OpenCode/OpenRouter smoke.
```

No base64, no data URL, no API key.

## Documentation warnings

Docs must say:

```text
Verified model support can change. If a model starts or stops accepting images, update the capability catalog and smoke expectations in a separate commit.
```

Docs must not say:

```text
All OpenRouter models support screenshots.
```

## Final pre-release manual checklist

- Send text-only message to Claude lead.
- Send optimized image to Claude lead.
- Send text-only message to Codex lead.
- Send image to Codex lead.
- Send text-only direct message to OpenCode member.
- Send image to OpenCode OpenAI member.
- Send image to OpenCode Kimi K2.6 member if OpenRouter configured.
- Attempt image to OpenCode GLM 5.1 and confirm it blocks before send.
- Attempt oversized image and confirm it blocks before send.
- Copy diagnostics and confirm no data URL/base64/key.

## Phase 5 bug traps

| Trap | Prevention |
|---|---|
| live smoke consumes tokens in normal CI | not part of default test command |
| smoke fails due missing auth and blocks release | missing optional env is skipped, not failed |
| docs become stale | capability catalog references live smoke date |
| unsupported negative model changes behavior | update catalog/test explicitly |
| copied diagnostics leak image data | redaction unit tests |
