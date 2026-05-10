# Quickstart

This guide gets you from a fresh install to a running team in a few minutes.

## 1. Install Agent Teams

Download the latest release for your platform from the <a href="/download/" target="_self">download page</a> or [GitHub releases](https://github.com/777genius/agent-teams-ai/releases).

::: tip
The app is free and open source. The agent runtime you choose may still require provider access — see [Installation](/guide/installation) for details.
:::

## 2. Open or create a project

Launch the app and select the project directory you want agents to work in. Agent Teams reads local project files and runtime/session state so the UI can show tasks, logs, diffs, and teammate activity.

::: tip
Pick a Git-tracked project for the best experience. Worktree isolation and diff-based review both rely on Git.
:::

## 3. Choose a runtime path

The setup flow auto-detects installed runtimes on your machine. A common first setup is:

| Runtime  | Good for                                        |
| -------- | ----------------------------------------------- |
| Claude   | Claude Code users and existing Anthropic access |
| Codex    | Codex-native workflows and OpenAI access        |
| OpenCode | Multi-model teams and many provider backends    |

::: info
Gemini support is in development and will appear in the runtime list when available.
:::

See [Runtime setup](/guide/runtime-setup) for detailed configuration per provider.

## 4. Create your first team

Create a team with a lead and one or more specialists. Keep the first team small: one lead, one implementation agent, and one review-oriented agent is enough to validate the workflow.

See [Create a team](/guide/create-team) for the recommended structure and tips.

## 5. Give the lead a concrete goal

Write the goal like you would brief an engineering lead:

```text
Improve the onboarding flow. Split the work into tasks, keep changes small, and ask for review before broad refactors.
```

The lead creates tasks, assigns work, and coordinates teammates. You can watch progress on the kanban board and intervene with comments or direct messages at any time.

## 6. Review results

Open completed or review-ready tasks, inspect the diff, and accept, reject, or comment on individual changes. Use task logs when you need to understand why an agent made a choice.

See [Code review](/guide/code-review) for the full review workflow.

## Next steps

- [Create a team](/guide/create-team) — recommended team shapes and brief writing
- [Runtime setup](/guide/runtime-setup) — provider auth and model selection
- [Code review](/guide/code-review) — review, approve, or request changes
