# Runtime Setup

Agent Teams is a coordination layer. The actual model work runs through supported local runtimes and providers.

## Prerequisites

Before launching a team, make sure:

- The runtime binary is installed and on your `PATH`.
- Your provider account has active access to the model you intend to use.
- The project path exists and is readable.

::: tip
Start with a single teammate and one provider. Confirm one launch works before adding multimodel lanes.
:::

## Supported paths

| Path | Default CLI | Typical providers | Use when |
| --- | --- | --- | --- |
| Claude | `claude` | Anthropic | You already use Claude Code or Anthropic-backed workflows |
| Codex | `codex` | OpenAI | You want Codex-native runtime integration |
| OpenCode | `opencode` | OpenRouter and many backends | You want multimodel routing and broad provider coverage |

The app detects supported runtimes and guides setup from the UI when possible.

## Provider access

Agent Teams has no paid tier of its own. You bring the provider access you already have: subscriptions, local runtime auth, or API keys depending on the path you choose.

- **Claude** and **Codex** paths rely on their respective CLI auth tools.
- **OpenCode** needs provider-specific API keys in a config file (e.g., `openrouter`, `openai`, `anthropic`).

## Auth configuration

### Claude Code

Run the standard auth flow in a terminal:

```bash
claude login
```

Then verify the CLI is reachable:

```bash
claude --version
```

### Codex

Install and authenticate via OpenAI's CLI flow:

```bash
codex login
```

### OpenCode

Create or edit `~/.opencode/config.json` (or the equivalent path on your platform) with the provider key you want:

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-..."
    }
  }
}
```

Use the exact provider name that OpenCode expects. If you set a custom provider name, double-check it against the provider ID you use in the model string (for example `openrouter/moonshotai/kimi-k2.6` would use the `openrouter` block).

## Multimodel mode

Multimodel mode can route work through many provider backends via OpenCode-compatible configuration. Use it when you need provider flexibility or want teammates to use different model lanes.

::: info Model lanes
Each teammate can use a different `providerId` + `model` pair. In the team edit UI, expand member options to override the global defaults.
:::

## Prelaunch checklist

Before launching a team:

1. The selected runtime is installed
2. The runtime binary is in the environment `PATH`
3. Provider auth is configured for the chosen backend
4. The provider has access to the exact model string you specify
5. The project path exists and is readable

## When to switch runtime paths

Switch when the current path is blocked by model availability, rate limits, provider capabilities, or team role needs. Keep the same project and team workflow, but validate one small task after switching.

::: warning Treat setup errors as setup problems
If auth fails, a model name is rejected, or the runtime binary cannot be found, fix the setup first. Do not change team prompts or project code to work around a runtime configuration issue.
:::
