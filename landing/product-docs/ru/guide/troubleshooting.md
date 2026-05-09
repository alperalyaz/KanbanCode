# Диагностика

Большинство проблем команды попадает в пять групп: runtime setup, launch confirmation, task parsing, provider limits и review state gaps.

## Команда не запускается

Проверьте по порядку:

1. **Runtime доступен** — выбранный CLI (`claude`, `codex`, `opencode`) установлен
2. **PATH reachable** — binary доступен в environment `PATH`
3. **Доступ к модели** — у провайдера есть доступ к запрошенной строке модели (особенно для OpenCode точные имена провайдера/модели важны)
4. **Путь к проекту** — директория проекта существует и доступна для чтения
5. **Network / VPN** — некоторые провайдеры режут трафик при активном VPN

### OpenCode: registered, но bootstrap не подтверждён

Если OpenCode показывает `registered`, но bootstrap не подтверждён, сначала смотрите артефакты, а не меняйте team prompts.

Посмотрите на свежий artifact неудачного запуска:

```bash
~/.claude/teams/<team>/launch-failure-artifacts/latest.json
```

Манифест внутри включает:

- `classification` — почему запуск считался неудачным
- `bootstrapTransportBreadcrumb` — использованный путь доставки
- Статусы spawn members
- Редактированные логи и traces

Также проверьте lane manifest:

```bash
jq '.lanes' ~/.claude/teams/<team>/.opencode-runtime/lanes.json
jq '.activeRunId, .entries' ~/.claude/teams/<team>/.opencode-runtime/lanes/<lane>/manifest.json
```

::: tip Не гадайте по UI
Всегда коррелируйте UI-диагностику с persisted файлами (`launch-state.json`, `bootstrap-journal.jsonl`) и runtime-specific evidence.
:::

## Не видны ответы агента

Откройте task logs и teammate messages. Пропавшие replies часто связаны с:

- **Runtime delivery retry** — агент мог ответить, но сообщение не было доставлено в приложение. Проверьте delivery ledger.
- **Parsing или filtering** — вывод агента не содержал ожидаемых маркеров или task references.
- **Task attribution** — работа выполнялась в сессии, но не была привязана к задаче, так как в выводе отсутствовал корректный task id.

::: warning Не считайте молчание игнорированием
Не считайте, что модель проигнорировала сообщение, пока это не подтверждено логами.
:::

## Changes не связаны с tasks

Используйте task-specific logs и code review links. Если diff выглядит detached, проверьте, был ли task id или task reference в output агента.

Для OpenCode teammates авторитетным доказательством принадлежности сессии задаче является `opencode-sessions.json` и запись в lane manifest, а не только UI message stream.

## Rate limits

Если провайдер сообщает reset time, Agent Teams может подтолкнуть lead продолжить после cooldown. Если reset time неизвестен, подождите или смените provider/runtime path.

| Поведение провайдера | Рекомендуемое действие |
| --- | --- |
| Показан known reset time | Дождитесь cooldown и продолжите |
| Reset time неизвестен | Смените провайдера или runtime path |
| Повторяющиеся 429 | Снизьте concurrency или используйте другой model lane |

## Проблемы CLI auth

### `claude login` не сохраняется

Если CLI авторизован в одном терминале, но приложение говорит, что нет — проверьте, что auth сохранён в ожидаемый config path и что процесс приложения видит тот же `$HOME`.

### OpenCode provider key отклонён

- Дважды проверьте, что имя провайдера в `config.json` совпадает с префиксом в строке модели
- Убедитесь, что ключ не истёк и не отозван в dashboard провайдера

## Lane bootstrap завис

Для OpenCode secondary lanes:

- Отсутствие `inboxes/<member>.json` — не автоматически баг. OpenCode lanes не обязаны быть primary-inbox-created перед стартом.
- Если UI показывает, что команда всё ещё запускается, а primary members уже usable, "all teammates joined" ждёт secondary lanes.
- Если `Prepared communication channels for X/Y members` зависло, проверьте, что `Y` некорректно включает secondary OpenCode members.

### Пустые entries в lane manifest

Если bridge говорит, что bootstrap успешен, но `manifest.json` показывает `entries: []`, проблема в **evidence commit**, а не в поведении модели. Member не должен считаться deliverable до тех пор, пока не существуют `opencode-sessions.json` и его запись в manifest.

## Какие данные собрать

Прежде чем обращаться за помощью, соберите:

- Task id (короткий или полный)
- Team name
- Runtime path (`claude`, `codex` или `opencode`)
- Excerpt launch logs (из `latest.json` или `bootstrap-journal.jsonl`)
- Provider / model string
- Точный time window, когда произошла проблема

Этих данных обычно достаточно для диагностики launch и task lifecycle issues.
