# Runtime Setup

Agent Teams is a coordination layer. The actual model work runs through supported local runtimes and providers.

## Supported paths

| Path | Use when |
|------|----------|
| Claude | You already use Claude Code or Anthropic-backed workflows |
| Codex | You want Codex-native runtime integration |
| OpenCode | You want multimodel routing and broad provider coverage |

The app detects supported runtimes and guides setup from the UI when possible.

## Provider access

Agent Teams has no paid tier of its own. You bring the provider access you already have: subscriptions, local runtime auth, or API keys depending on the path you choose.

::: tip
If you are new to Claude Code, the app includes a built-in installer and authentication helper. Look for the "Install Claude Code" button in the runtime settings.
:::

## Multimodel mode

Multimodel mode can route work through many provider backends via OpenCode-compatible configuration. Use it when you need provider flexibility or want teammates to use different model lanes.

Example `~/.opencode/config.json`:
```json
{
  "providers": {
    "anthropic": { "apiKey": "<your-key>" },
    "openai": { "apiKey": "<your-key>" }
  }
}
```

## Pre-flight checklist

Before creating your first team:

- [ ] The chosen runtime is installed and available in your shell `PATH`.
- [ ] You have authenticated with the provider (Claude Code `claude login`, OpenCode `opencode auth`, etc.).
- [ ] The provider has access to the model you plan to assign.
- [ ] The project path exists and is readable.

::: warning
Do not add many providers or multimodel lanes until you have confirmed that a single teammate can launch successfully. Keep the first setup minimal.
:::

## Operational advice

- Keep the first runtime setup simple.
- Confirm one team can launch before adding many providers.
- Treat auth, provider model names, and runtime PATH issues as setup problems, not team-prompt problems.
- If launch hangs, check the [Troubleshooting](./troubleshooting.md) page before changing team prompts.

## When to switch runtime paths

Switch when the current path is blocked by model availability, rate limits, provider capabilities, or team role needs. Keep the same project and team workflow, but validate one small task after switching.

::: tip
You can mix paths in the same team: for example, assign the lead to Claude while secondary teammates run in OpenCode lanes for multimodel flexibility.
:::
