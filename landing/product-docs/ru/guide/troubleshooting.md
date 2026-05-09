# Диагностика

Большинство проблем команды попадает в четыре группы: runtime setup, launch confirmation, task parsing или provider limits.

## Команда не запускается

Проверьте:

- Выбранный runtime установлен или авторизован
- Runtime доступен в environment `PATH`
- У провайдера есть доступ к нужной модели
- Project path существует и читается

::: tip
Запустите бинарник рантайма в терминале, чтобы проверить PATH и авторизацию. Например: `claude --version` или `opencode --version`.
:::

### OpenCode: bootstrap не подтверждён

Если OpenCode показывает `registered`, но bootstrap не подтверждён:

1. Откройте launch logs в UI.
2. Проверьте `~/.claude/teams/<team>/launch-state.json` — состояние member.
3. Посмотрите `~/.claude/teams/<team>/.opencode-runtime/lanes/<lane-id>/manifest.json` на наличие evidence.
4. Не меняйте team prompts, пока не убедитесь, что lane стартовал, но не смог закоммитить evidence.

::: warning
Отсутствие OpenCode inbox во время primary launch — норма. Secondary lanes стартуют после готовности primary filesystem. Не считайте primary hang багом OpenCode, пока UI явно не показывает, что `Y` членов ждёт и `Y` некорректно включает OpenCode lanes.
:::

## Не видны ответы агента

Откройте task logs и teammate messages. Пропавшие replies часто связаны с:

- Runtime delivery gaps
- Parsing или task filtering issues
- Агент всё ещё обрабатывает (большие задачи могут занимать минуты)

Не считайте, что модель проигнорировала сообщение, пока это не подтверждено логами.

::: tip
Для OpenCode teammates проверьте, что вызван `agent-teams_message_send` с правильными `from`, `to` и `taskRefs`. Ответы OpenCode должны отправляться через MCP tools, а не обычным текстом.
:::

## Changes не связаны с tasks

Используйте task-specific logs и code review links. Если diff выглядит detached:

- Проверьте, был ли task id или task reference в output агента.
- Убедитесь, что агент вызвал `task_add_comment` перед правками.
- Убедитесь, что агент вызвал `task_start`, чтобы доска знала о начале работы.

## Rate limits

Если провайдер сообщает reset time, Agent Teams может подтолкнуть lead продолжить после cooldown. Если reset time неизвестен, подождите или смените provider/runtime path.

## Распространённые состояния member

| Состояние | Значение |
|-----------|---------|
| `confirmed_alive` + `bootstrapConfirmed` | Здоров и готов к работе |
| `registered` / `runtime_pending_bootstrap` | Процесс или lane существует, но bootstrap proof ещё не закоммичен |
| `failed_to_start` + `runtime_process` | Процесс есть, но launch gate не прошёл. Смотрите diagnostics |
| `failed_to_start` + `stale_metadata` | Сохранённый pid/session устарел или мёртв |

::: warning
`member_briefing` сам по себе НЕ является runtime evidence. Для OpenCode авторитетным доказательством служит committed runtime evidence, такая как `opencode-sessions.json` и запись в manifest.
:::

## Режим отладки рантайма

Для локальной отладки можно принудительно запускать teammates в tmux-панелях:

```bash
# Запуск из терминала
CLAUDE_TEAM_TEAMMATE_MODE=tmux pnpm dev

# Или добавьте в custom CLI args
--teammate-mode tmux
```

Используйте это для инспекции интерактивного поведения CLI. Не считайте поведение полностью эквивалентным process backend.

## CLI auth diagnostic

Каждый запуск `CliInstallerService.getStatus()` дописывает одну строку в `claude-cli-auth-diag.ndjson` в папке логов Electron (обычно `~/Library/Logs/<product-name>/` на macOS). Если файл превышает **512 KiB**, он обнуляется перед следующей записью.

Проверьте этот файл, если видите «Not logged in» или ошибки авторизации в упакованном приложении.

## Безопасная очистка

При очистке stale processes:

1. Определите pid и убедитесь, что он принадлежит текущей команде/lane.
2. Останавливайте только процессы, явно принадлежащие smoke test или отлаживаемому launch.
3. **Не убивайте** все процессы OpenCode или shared hosts в качестве shortcut.

## Какие данные собрать

Соберите:

- task id
- team name
- runtime path
- launch log excerpt
- provider/model
- точный time window

Этого обычно хватает для диагностики launch и task lifecycle issues.

::: tip
Если проблема не устраняется, откройте persisted files команды под `~/.claude/teams/<teamName>/` и сопоставьте UI diagnostics с live process state, прежде чем менять код.
:::
