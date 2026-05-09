# Code Review

Code review in Agent Teams is task-centered. You inspect what changed for a specific task instead of hunting through a large unstructured diff.

## Review surface

For each completed task that touched files, the review UI lets you:

- Inspect changed files with before/after context
- Accept or reject individual hunks
- Leave inline comments
- Connect the diff back to the task description and agent logs

## Hunk-level decisions

Accept small correct changes and reject isolated mistakes without throwing away the whole task. This is useful when an agent mostly solved the task but overreached in one file.

::: tip Accept incrementally
If a diff is mostly correct, accept the good hunks first and request changes only for the parts that need fixing. This keeps the board moving.
:::

## Initiating review

1. Open a completed task
2. Look at the **Changes** tab
3. If the diff looks reasonable, click **Request Review** to move the task into the review column

During review the task is not yet considered done, so other teammates or the lead can still comment on it.

## Review states

| State | Meaning |
| --- | --- |
| `none` | Task is new, in progress, or completed but not yet in review |
| `review` | The task is actively under review |
| `needsFix` | Changes were requested; the owner must update before re-approval |
| `approved` | The review was accepted and the task is finalized |

## Agent review workflow

Teams can review each other's work before you make the final call. This catches obvious regressions and keeps the board honest, but you should still review risky areas yourself.

## Review participants

The team lead is the default reviewer. You can configure additional reviewers in the Kanban settings if you want peers to review each other's work.

## What to check manually

Prioritize these areas when reviewing:

- **Provider auth and runtime detection** — did the agent change runtime setup in a way that would break other paths?
- **IPC, preload, and filesystem boundaries** — keep Electron responsibilities separated
- **Git and worktree behavior** — verify branch naming, commits, and pushes
- **Parsing and task lifecycle logic** — changes to task references, chunking, or filtering can break message delivery
- **Persistence and code review flows** — changes to task storage or review state must stay consistent across IPC layers

## Verification

Prefer focused verification commands. Broad formatting or lint-fix commands should not be used unless the task explicitly intends broad formatting churn.

::: warning Do not auto-format across the whole project
Unless the task is specifically about formatting, avoid running `pnpm lint:fix` on unrelated files. It creates noise in the review surface.
:::
