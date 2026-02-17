# Research: Подходы к отправке сообщений тиммейтам

## Сравнение 3 подходов

| Критерий | Inbox-файлы | Agent SDK | CLI subprocess |
|----------|:-----------:|:---------:|:--------------:|
| Скорость | ~5ms | ~12с | 10-15с |
| Стоимость | $0 | $0.01-0.08/msg | токены |
| Работает с запущенными | **YES** | NO | NO |
| Прерывает mid-turn | NO | NO | NO |
| Требует API ключ | NO | YES | NO |
| Расход памяти | 0 | 0 | 100-320MB |

---

## 1. Inbox-файлы (ВЫБРАНО)

### Как работает

Прямая запись JSON в файл `~/.claude/teams/{team}/inboxes/{member}.json`. Claude Code мониторит эти файлы через fs.watch и доставляет сообщения агентам между turns.

### Плюсы

- **Мгновенная запись** (~5ms)
- **$0** — никаких API вызовов
- **Единственный** способ общаться с запущенными тиммейтами
- Работает с idle и active агентами (но доставка между turns)

### Минусы

- Race condition при одновременной записи (см. [research-inbox.md](./research-inbox.md))
- Формат недокументирован (internal API)
- Доставка между turns, не real-time
- from: "user" может не работать

### Формат сообщения

```json
{
  "from": "user",
  "text": "Не трогай файл auth.ts, я его сам изменю",
  "timestamp": "2026-02-17T15:30:00.000Z",
  "read": false,
  "summary": "Do not modify auth.ts",
  "messageId": "uuid-for-retry-check"
}
```

---

## 2. Agent SDK (ОТВЕРГНУТ)

### Как работает

```typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();
const response = await client.messages.create({
  model: 'claude-opus-4-6',
  messages: [{ role: 'user', content: 'Send message to teammate...' }],
  tools: [/* SendMessage, TaskUpdate, etc. */]
});
```

### Почему отвергнут

1. **Создаёт НОВУЮ сессию** — не подключается к работающему тиммейту. SendMessage и TaskCreate — это инструменты модели, не программные вызовы
2. **~12 секунд** на каждый вызов (полный API round-trip)
3. **Стоит токены** — $0.01-0.08 за сообщение
4. **Нужен API ключ** — отдельная оплата, а не подписка Claude

### Когда может пригодиться

- Создание новых команд программно
- Автоматизация workflow (вне real-time UI)

---

## 3. CLI subprocess (ОТВЕРГНУТ)

### Как работает

```bash
claude --message "Send message to teammate-1: stop working on X"
```

### Почему отвергнут

1. **Новый процесс** — не инжектится в работающего тиммейта
2. **10-15 секунд** холодный старт
3. **100-320MB памяти** на процесс
4. Каждый вызов стоит токены

---

## Доставка: Timing и ограничения

### Цикл тиммейта

```
Turn N:
  1. Читает inbox → видит новые (read: false)
  2. Обрабатывает сообщения/задачи
  3. Вызывает инструменты
  4. Reasoning
  5. Output
  → idle_notification → IDLE

... ожидание ...

Turn N+1:
  1. Пробуждение (новое сообщение в inbox / назначение задачи)
  2. Читает inbox → видит новые
  ...
```

### Задержка

- **Idle agent**: получит при следующем пробуждении (доли секунды если inbox-change triggers)
- **Active agent (mid-turn)**: получит только после завершения текущего turn (1-30 секунд)

### Нельзя прервать

Если агент уже вызвал Edit/Bash — инструмент выполнится. Наше сообщение придёт ПОСЛЕ.

**Пример**:
```
17:12:30 — Agent начинает Edit на auth.ts
17:12:31 — Мы шлём "Не трогай auth.ts"
17:12:32 — Agent завершает Edit (auth.ts изменён)
17:12:33 — Agent читает inbox, видит наше сообщение
→ Поздно, файл уже изменён
```

### Hard Interrupt (будущее)

Возможные подходы:
1. **kill -SIGINT** процесса тиммейта (жёсткое прерывание, потеря контекста)
2. **Файловый flag** `.interrupt-{member}` (нужна поддержка в Claude Code)
3. **API от Anthropic** (если появится)

Текущее решение: задержка приемлема, hard interrupt — в будущем.

---

## Финальное решение (после 3 раундов ревью)

### Поле from

- Используем `from: "user"` — интуитивно и описывает источник
- Fallback `from: "team-lead"` если агент не реагирует (team-lead всегда есть в config.json members)
- Практический тест необходим при первой реализации (см. [research-inbox.md](./research-inbox.md))

### messageId — обязателен в каждом сообщении

Каждое исходящее сообщение включает `messageId: crypto.randomUUID()`:

```json
{
  "from": "user",
  "text": "Please review task #12",
  "timestamp": "2026-02-17T15:30:00.000Z",
  "read": false,
  "summary": "Review request for task #12",
  "messageId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Verify: проверка сразу после записи

- После atomic write читаем inbox и ищем наш `messageId`
- Если не найден — потеря обнаружена → warning в UI (не silent fail)
- Не автоматический retry на MVP

### 3 состояния offline-участника

| Состояние | Условие | Отображение |
|-----------|---------|-------------|
| `ACTIVE` | idle < 5 минут | Зелёный dot |
| `IDLE` | idle > 5 минут | Жёлтый dot |
| `TERMINATED` | Получен `shutdown_response` с `approve: true` | Серый dot, "Завершён" |

Определение состояния по timestamp последнего события в inbox (idle_notification, любое сообщение). TERMINATED — исключительно по явному `shutdown_response`.

### Что не входит в MVP

- Автоматический retry при потере сообщения
- `from: "user"` validation через config.json members (проверяем практически)
- Hard Interrupt (kill -SIGINT, файловый flag) — Phase 2
