# Privacy and Local Data

Agent Teams is local-first, but the selected runtime/provider path still matters. This page describes what the desktop app stores locally and what may leave your machine when agents call provider-backed models.

## What stays local

The desktop app runs on your machine and reads local project/runtime data to power the UI. Typical local data includes:

- project files
- team configuration and member metadata
- task metadata, task comments, and task references
- inbox messages
- runtime/session logs
- launch state and bootstrap diagnostics
- review state
- local app settings

Important local locations include:

| Location | Purpose |
| --- | --- |
| `~/.claude/teams/<team>/` | Team config, member metadata, inboxes, launch state, bootstrap evidence, runtime diagnostics, sent-message records, kanban state, and review-related team files. |
| `~/.claude/tasks/<team>/` | Durable task JSON files for the team board. |
| `~/.claude/projects/<encoded-project>/` | Claude/Codex-style project session files used for session history, context analysis, and transcript-backed UI. |

Exact files can vary by runtime and app version. For launch debugging, the newest evidence is usually under the relevant `~/.claude/teams/<team>/` folder.

## What can leave your machine

Agent Teams itself is not a cloud code-sync service for your repository. It does not need to upload your whole project to an Agent Teams server to show the board, inbox, logs, or review UI.

However, when an agent asks a provider-backed model to work, prompt context, selected file contents, task text, comments, tool results, command output, and other runtime-provided context may be sent through the selected runtime/provider path. What is sent depends on the runtime, model, tool calls, prompt, and provider configuration.

Provider authentication, provider-side retention, training, logging, regional processing, and billing are governed by the provider/runtime you choose. Review those policies for sensitive projects.

## What the app does not guarantee

- It cannot guarantee that provider-backed model calls never receive private code.
- It cannot override provider retention or billing policies.
- It cannot make a remote provider behave like a fully local model.
- It cannot protect secrets that an agent is instructed to paste into prompts, task comments, files, or commands.
- It cannot make every runtime expose the same transcript or audit detail.

## Practical guidance

- Do not attach secrets to tasks, comments, or direct messages.
- Review provider policies for sensitive projects.
- Use lower autonomy for risky repositories.
- Keep task scope narrow when working with private code.
- Prefer local evidence and logs when debugging.
- Check generated prompts, task descriptions, and attached files before asking agents to work on confidential material.
- Use provider/model paths that match your privacy requirements.

## Open source model

The app itself is open source and free. You can inspect how local orchestration, task tracking, inboxes, runtime diagnostics, and review flows work in the repository.
