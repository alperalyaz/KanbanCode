# FAQ

## Agent Teams бесплатный?

Да. Приложение бесплатное и open source. Provider или runtime access может стоить денег в зависимости от выбранного пути.

## Agent Teams включает доступ к моделям?

Нет. Agent Teams - локальный orchestration и UI layer. Model access приходит через выбранный runtime/provider path, например Claude Code, Codex или OpenCode.

## Какие runtimes поддерживаются?

Поддерживаемые runtime paths: Claude Code, Codex и OpenCode. App также отслеживает provider ids вроде Anthropic, Codex, Gemini и OpenCode, когда runtime их отдаёт.

## Нужно ли заранее ставить Claude Code или Codex?

Не всегда. Приложение ведёт runtime detection и setup через UI. Некоторые пути всё равно требуют внешнюю авторизацию runtime.

OpenCode setup отделён от Claude Code и Codex setup. Если launch fails, сначала проверьте runtime status и provider auth, а не меняйте team prompt.

## Приложение загружает мой код на серверы Agent Teams?

Нет. Agent Teams не является cloud code-sync сервисом. Но provider-backed model calls могут получать prompt context в зависимости от выбранного runtime.

## Где хранятся team files?

Team coordination data хранится локально в `~/.claude/teams/<team>/`, task files - в `~/.claude/tasks/<team>/`, а project session data - в `~/.claude/projects/<encoded-project>/`, когда она доступна.

## Что может выйти с моей машины?

Prompt context, selected file contents, tool results, command output, task text, comments и attachments могут уйти через runtime/provider path, когда агент использует provider-backed model. Точное поведение зависит от runtime и provider.

## Агенты могут общаться друг с другом?

Да. Агенты могут писать teammates, комментировать tasks, координироваться между teams и использовать task references, чтобы разговор оставался привязанным к работе.

## Можно ревьюить код перед принятием?

Да. Review flow построен вокруг task-scoped diffs и hunk-level decisions.

## Что такое Agent Block?

Agent Block - скрытый agent-only text в маркерах вроде `<info_for_agent>...</info_for_agent>`. App убирает его из обычного user-facing display, но сохраняет для agent coordination.

## Что такое solo mode?

Solo mode - команда из одного агента. Подходит для небольших задач и меньшего coordination overhead.

## Могут ли разные teammates использовать разных providers?

Да, provider/model settings могут задаваться per team member, если выбранный runtime path это поддерживает. OpenCode - основной путь для широкой multi-provider routing.

## Почему task может быть review или approved отдельно от done?

Work state и review state связаны, но не идентичны. Task может быть done с точки зрения агента, а затем пройти review и approval в kanban UI.

## Что делать, если launch завис?

Откройте troubleshooting, соберите launch diagnostics, проверьте `~/.claude/teams/<team>/` и runtime/provider auth до изменения prompts.

Для OpenCode проверьте lane/session evidence, прежде чем считать, что teammate online, но игнорирует messages.

## Почему logs отличаются между runtimes?

Claude Code, Codex и OpenCode отдают разные transcript formats и runtime evidence. Agent Teams нормализует то, что может, но log completeness и attribution могут отличаться по runtime.
