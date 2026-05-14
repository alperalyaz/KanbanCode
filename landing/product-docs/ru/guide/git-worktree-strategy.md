---
title: Git and Worktree Strategy - Agent Teams Docs
description: Как выбирать main worktree, feature branches или OpenCode worktree isolation для parallel agent work.
---

# Git and Worktree Strategy

Git даёт Agent Teams самый сильный review path: narrow diffs, branch visibility, task-scoped changes и более безопасную parallel work.

## Choose a strategy

| Strategy | Когда использовать | Tradeoff |
| --- | --- | --- |
| Main worktree | Solo work, docs-only edits или один teammate за раз | Просто, но parallel edits могут конфликтовать |
| Feature branch | Одна team работает над одним coherent change | Чистый review target, но teammates всё ещё делят files |
| Worktree isolation | Несколько OpenCode teammates могут параллельно менять один repo | Лучше isolation, но merge/review требует дисциплины |

Начинайте просто. Включайте worktree isolation, когда parallel edits вероятны, а не потому что каждому task нужен отдельный checkout.

## When to enable worktree isolation

Включайте для OpenCode teammates, когда:

- два или больше teammates могут менять один repository одновременно
- task может запускать formatters, code generators или broad tests
- нужно держать branch и diff каждого teammate отдельно
- lead workspace dirty и не должен получать прямые edits

Оставляйте выключенным, когда:

- task read-only
- один teammate владеет всеми edits
- repo не Git-tracked
- нужен runtime path, который не поддерживает этот isolation mode

::: warning
Worktree isolation сейчас применяется к OpenCode members и требует Git-tracked project.
:::

## Branch hygiene

Перед parallel work:

```bash
git status --short
git branch --show-current
```

По возможности используйте clean branch. Если main worktree уже содержит user changes, скажите agents не revert unrelated files и держать task scope узким.

Рекомендуемый branch style:

```text
agent/<team-or-task>/<short-purpose>
```

Примеры:

```text
agent/docs/mcp-guide
agent/review/task-log-filtering
agent/ui/code-review-polish
```

## Review flow

Для isolated worktrees проверяйте diff teammate до merge или apply в main workspace.

1. Убедитесь, что task result comment называет changed scope и verification.
2. Проверьте task diff в review UI.
3. Запросите changes в task, если diff трогает unrelated files.
4. Approve только когда tests или manual checks соответствуют risk.
5. Merge или apply changes осознанно.

Не auto-merge worktree output только потому, что task complete. Completion значит, что agent считает работу ready for review.

## Conflict policy

| Situation | Action |
| --- | --- |
| Два teammates меняют один file | Pause one task или назначьте одного owner для integration |
| Generated files changed broadly | Требуйте comment с generator и command |
| Main worktree имеет unrelated changes | Preserve them и review только task-owned changes |
| Worktree branch diverges | Rebase или merge manually после review, не внутри vague agent task |

## Task prompt example

```text
Implement the settings validation fix in your assigned worktree. Keep edits inside src/features/settings and focused tests. Do not touch provider auth or task storage. Post the test command and result before completing the task.
```

Этот prompt работает, потому что называет allowed area, sensitive boundaries и completion evidence.

## Related guides

- [Создание команды](/ru/guide/create-team)
- [Код-ревью](/ru/guide/code-review)
- [Team brief examples](/ru/guide/team-brief-examples)
