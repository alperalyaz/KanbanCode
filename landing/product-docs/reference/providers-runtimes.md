# Providers and Runtimes

Agent Teams separates orchestration from model access. The app manages teams, tasks, messages, launch state, and review UI; the selected runtime/provider path performs the actual model work.

## What the app provides

Agent Teams provides:

- team and task orchestration
- kanban board UI
- teammate messaging
- task logs
- review UI
- local project integration
- runtime detection and capability checks
- local logs and diagnostics

## What the runtime provides

The runtime provides:

- model execution
- provider authentication
- tool execution behavior
- model-specific rate limits and capabilities
- runtime-specific transcripts and delivery evidence

## Supported runtime paths

| Runtime path | Provider/model path | Best fit | Notes |
| --- | --- |
| Claude Code | Anthropic / Claude models | Claude Code users and Anthropic-backed workflows | Default local-first path for Claude teams. Requires the runtime and account access to be available locally. |
| Codex | Codex / OpenAI-backed models | Codex-native workflows | Uses Codex runtime integration and Codex auth/account state where available. Some diagnostics are different from Claude transcripts. |
| OpenCode | OpenCode-managed model routing | Multi-provider teams and broad model coverage | OpenCode can route through many model providers. Agent Teams treats OpenCode lanes as runtime-specific evidence and avoids guessing when lane identity is ambiguous. |

## Provider ids

The app currently recognizes these provider ids in team/runtime configuration:

| Provider id | Display intent |
| --- | --- |
| `anthropic` | Anthropic / Claude Code path |
| `codex` | Codex path |
| `gemini` | Gemini provider path when exposed by the runtime |
| `opencode` | OpenCode path, including OpenCode-managed provider routing |

Do not read this table as a guarantee that every provider is authenticated, installed, or available for every model on every machine. The runtime status and capability checks are the source of truth for a given launch.

## Multi-provider strategy

Agent Teams keeps orchestration provider-aware but not provider-owned:

- teams, tasks, inboxes, comments, review state, and launch diagnostics stay in local Agent Teams storage
- each member can carry provider/model settings through team launch metadata
- model availability, auth, rate limits, and tool behavior remain runtime/provider responsibilities
- OpenCode is the broadest routing path when you want one team to use multiple provider/model lanes

## Provider costs

Agent Teams is free and open source. Provider usage is governed by the runtime/provider you select: subscription limits, API keys, account auth, rate limits, and provider policies all remain external to the app.

## Capability checks

During setup, the app may perform access and capability checks. This helps detect missing runtime auth before a team launch fails halfway through provisioning.

Capability checks can report that a provider exists but is not authenticated, that a model list is unavailable, that a runtime path is missing, or that a specific extension capability is unsupported. Treat those results as setup diagnostics, not task failures.

## Limits to expect

- Runtime support does not mean equal feature parity across Claude Code, Codex, and OpenCode.
- Log and transcript coverage differs by runtime.
- OpenCode lanes need stable lane/session evidence before the app can attribute runtime logs safely.
- Provider model names and availability can change outside the app.
- A team prompt cannot fix missing auth, missing PATH entries, provider outages, or exhausted rate limits.
