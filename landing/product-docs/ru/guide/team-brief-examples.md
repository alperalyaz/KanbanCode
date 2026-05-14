---
title: Team Brief Examples - Agent Teams Docs
description: Практические шаблоны team brief для small fixes, docs work, implementation tasks, review и risky areas.
---

# Team Brief Examples

Хороший team brief даёт lead достаточно структуры, чтобы создать small tasks, но не требует заранее расписать каждую деталь реализации.

Используйте форму:

```text
Outcome:
Scope:
Boundaries:
Coordination:
Verification:
Review:
```

## Minimal brief

Для маленькой low-risk работы.

```text
Outcome: Improve the quickstart so a new user can launch one team successfully.
Scope: Keep edits inside landing/product-docs.
Boundaries: Do not rewrite the whole docs structure.
Coordination: Create one or two tasks, keep comments on the task.
Verification: Run the docs build.
Review: Summarize changed pages and any remaining gaps.
```

## Implementation brief

Для code changes внутри одной feature area.

```text
Outcome: Add a focused improvement to task comment filtering.
Scope: Work inside the task/comment feature files unless a shared helper is clearly needed.
Boundaries: Do not change task storage format or review state semantics.
Coordination: Split parser, UI, and tests into separate tasks if they can be reviewed independently.
Verification: Run the focused unit tests first, then the feature typecheck if touched.
Review: Call out parsing edge cases and any behavior that affects existing task comments.
```

## Docs brief

Для documentation и guide work.

```text
Outcome: Draft practical workflow guides from the docs audit.
Scope: Add concise VitePress pages under landing/product-docs/guide.
Boundaries: Avoid moving existing navigation hubs owned by other tasks.
Coordination: Check related docs tasks before editing nav.
Verification: Run the VitePress docs build.
Review: Include links added to sidebar and any pages intentionally left as drafts.
```

## Review-heavy brief

Для risky areas: IPC, provider auth, persistence, Git или task lifecycle logic.

```text
Outcome: Fix the launch failure without changing successful launch behavior.
Scope: Start from the newest launch-failure artifact and the affected runtime adapter.
Boundaries: Do not change provider prompts until setup and runtime evidence are inspected.
Coordination: Make one diagnostic task and one fix task if the cause is confirmed.
Verification: Run focused tests and one desktop smoke check when practical.
Review: Lead must inspect the diff before approval.
```

## Mixed provider brief

Когда teammates работают на разных provider/model lanes.

```text
Outcome: Implement and review a small feature using separate builder and reviewer lanes.
Scope: Builder edits the feature. Reviewer inspects only the task diff and tests.
Boundaries: Do not switch model ids mid-task unless launch fails before work begins.
Coordination: Builder posts result comment first. Reviewer posts findings as task comments.
Verification: Builder runs focused tests. Reviewer checks failure output and changed scope.
Review: Lead approves only after reviewer comments are resolved.
```

## What to avoid

| Weak brief | Better replacement |
| --- | --- |
| "Improve the app" | Назовите workflow, files и success check |
| "Fix all docs" | Выберите одну guide group и build command |
| "Use the best model" | Назовите provider/model choices или оставьте app defaults |
| "Refactor as needed" | Укажите modules, которые можно менять |
| "Make it production ready" | Определите review, tests и rollout checks |

## Before launch

Проверьте перед стартом:

1. Brief называет concrete outcome.
2. Risk boundaries explicit.
3. Lead может разделить работу на reviewable tasks.
4. Verification commands указаны, если известны.
5. Sensitive areas требуют review before approval.

Если brief всё ещё широкий, запустите solo или small team и попросите сначала task plan, а не implementation.

## Related guides

- [Создание команды](/ru/guide/create-team)
- [MCP integration](/ru/guide/mcp-integration)
- [Git and worktree strategy](/ru/guide/git-worktree-strategy)
