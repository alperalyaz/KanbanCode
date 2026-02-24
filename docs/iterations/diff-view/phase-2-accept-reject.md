# Phase 2: Accept/Reject Per Hunk

## Цель
Заменить Phase 1 простой HTML-дифф на полноценный `@codemirror/merge` viewer с accept/reject кнопками на каждом hunk. При reject — откат изменений через `jsdiff.applyPatch()`. При конфликтах — three-way merge через `node-diff3`.

## Зависимости (npm)
```bash
pnpm add @codemirror/merge @codemirror/state @codemirror/view
pnpm add @codemirror/lang-javascript @codemirror/lang-python @codemirror/lang-json
pnpm add @codemirror/lang-css @codemirror/lang-html @codemirror/lang-xml
pnpm add @codemirror/theme-one-dark
pnpm add diff           # jsdiff v8 — structuredPatch, applyPatch (НЕТ reversePatch!)
pnpm add node-diff3     # Three-way merge для конфликтов (diff3Merge)
```

**Примечание**: `react-codemirror-merge` НЕ используем — пишем свой React wrapper для полного контроля над lifecycle и event handling.

---

## Backend

### 1. Типы: `src/shared/types/review.ts` (MODIFY — дополнения к Phase 1)

```typescript
/** Результат проверки конфликтов */
export interface ConflictCheckResult {
  hasConflict: boolean;
  /** null если нет конфликта */
  conflictContent: string | null;
  /** Текущее содержимое файла на диске */
  currentContent: string;
  /** Содержимое до изменений агента (из backup или snippet chain) */
  originalContent: string;
}

/** Результат операции reject */
export interface RejectResult {
  success: boolean;
  /** Новое содержимое файла после reject */
  newContent: string;
  /** Были ли конфликты при merge */
  hadConflicts: boolean;
  /** Описание конфликтов (если есть) */
  conflictDescription?: string;
}

/** Решение по hunk */
export type HunkDecision = 'accepted' | 'rejected' | 'pending';

/** Решение по файлу */
export interface FileReviewDecision {
  filePath: string;
  /** Общее решение по файлу (shortcut для "все hunks одинаково") */
  fileDecision: HunkDecision;
  /** Per-hunk решения, ключ = hunkIndex */
  hunkDecisions: Record<number, HunkDecision>;
}

/** Запрос на применение review */
export interface ApplyReviewRequest {
  teamName: string;
  taskId?: string;
  memberName?: string;
  decisions: FileReviewDecision[];
}

/** Результат применения review */
export interface ApplyReviewResult {
  applied: number;
  skipped: number;
  conflicts: number;
  errors: Array<{ filePath: string; error: string }>;
}

/** Полный file content для CodeMirror (расширение FileChangeSummary) */
export interface FileChangeWithContent extends FileChangeSummary {
  /** Полное содержимое файла ДО изменений (для CodeMirror original) */
  originalFullContent: string | null;
  /** Полное содержимое файла ПОСЛЕ изменений (для CodeMirror modified) */
  modifiedFullContent: string | null;
  /** Источник original content */
  contentSource: 'file-history' | 'snippet-reconstruction' | 'disk-current' | 'git-fallback' | 'unavailable';
  // 'git-fallback' добавлен для Phase 4 Git Fallback feature
}
```

### 2. Сервис: `src/main/services/team/FileContentResolver.ts` (NEW)

**Задача**: Получить полное содержимое файла "до" и "после" для CodeMirror. Phase 1 имеет только snippet-level диффы (old_string/new_string) — этого недостаточно для полноценного diff view.

**Паттерн**: Аналогичен `MemberStatsComputer` — стримит JSONL, кеширует результаты.

```typescript
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import * as readline from 'readline';
import { TeamMemberLogsFinder } from './TeamMemberLogsFinder';

export class FileContentResolver {
  private cache = new Map<string, { data: Map<string, FileVersions>; expiresAt: number }>();
  private readonly CACHE_TTL = 3 * 60 * 1000;

  constructor(private logsFinder: TeamMemberLogsFinder) {}

  /**
   * Восстанавливает полное содержимое файла до/после изменений агента.
   *
   * Стратегия (приоритеты):
   * 1. file-history-snapshot backup — полный файл до первого изменения (~85% кейсов)
   * 2. Snippet chain reconstruction — применяем все Edit snippets последовательно
   * 3. Текущий файл на диске — fallback (может быть уже изменён)
   */
  async resolveFileContent(
    teamName: string,
    memberName: string,
    filePath: string
  ): Promise<{
    original: string | null;
    modified: string | null;
    source: 'file-history' | 'snippet-reconstruction' | 'disk-current' | 'git-fallback' | 'unavailable';
  }>;

  /**
   * Batch resolve для всех файлов в changeSet.
   * Оптимизация: один проход по JSONL для всех файлов.
   */
  async resolveAllFileContents(
    teamName: string,
    memberName: string,
    filePaths: string[]
  ): Promise<Map<string, FileChangeWithContent>>;
}
```

**Ключевые нюансы file-history-snapshot:**

1. **Расположение backup файлов**: `~/.claude/file-history/{sessionId}/{backupFileName}`
2. **backupFileName формат**: `{hash}@v{version}` (например `4eb3109b11712282@v2`)
3. **Парсинг snapshot entry** из JSONL:
   ```json
   {
     "type": "file-history-snapshot",
     "snapshot": {
       "trackedFileBackups": {
         "/absolute/path/to/file.ts": {
           "backupFileName": "4eb3109b11712282@v2",
           "version": 2,
           "backupTime": "2024-01-15T10:30:00Z"
         }
       }
     }
   }
   ```
4. **Нужная версия**: Последний snapshot ПЕРЕД первым tool_use для данного файла
5. **Если snapshot отсутствует**: Fallback на snippet reconstruction

**Snippet chain reconstruction:**

1. Собрать все Edit tool_use для файла в хронологическом порядке
2. Начать с `original = ''` (или текущий файл, если есть)
3. Для каждого Edit: `content = content.replace(old_string, new_string)`
4. `modified` = финальный результат, `original` = начальное состояние
5. **Проблема**: Нет гарантии что chain полный (Write без old нарушает цепочку)

### 3. Сервис: `src/main/services/team/ReviewApplierService.ts` (NEW)

**Задача**: Применение reject решений — откат выбранных hunks через inverse patching.

```typescript
import * as Diff from 'diff';
import * as diff3 from 'node-diff3';
import { readFile, writeFile } from 'fs/promises';

export class ReviewApplierService {
  /**
   * Проверяет конфликты: файл изменён после работы агента?
   *
   * Сравнивает ожидаемое "after" содержимое (из JSONL) с текущим файлом на диске.
   * Если не совпадает — конфликт (файл был изменён пользователем или другим агентом).
   */
  async checkConflict(
    filePath: string,
    expectedModified: string
  ): Promise<ConflictCheckResult>;

  /**
   * Reject конкретных hunks в файле.
   *
   * Алгоритм:
   * 1. Прочитать текущий файл с диска
   * 2. Сравнить с expectedModified (конфликт-check)
   * 3. Если совпадает:
   *    - Вычислить unified patch через jsdiff.structuredPatch()
   *    - Выбрать только rejected hunks
   *    - Применить reverse patch через jsdiff.applyPatch() с reversed: true
   * 4. Если НЕ совпадает:
   *    - Three-way merge: base=original, ours=currentDisk, theirs=originalForRejectedHunks
   *    - При конфликте — вернуть маркеры
   * 5. Записать результат на диск
   */
  async rejectHunks(
    filePath: string,
    original: string,
    modified: string,
    hunkIndicesToReject: number[]
  ): Promise<RejectResult>;

  /**
   * Reject всего файла — восстановить original content.
   */
  async rejectFile(
    filePath: string,
    original: string,
    modified: string
  ): Promise<RejectResult>;

  /**
   * Preview reject без записи на диск.
   * Принимает snippets для consistency с rejectHunks (иначе preview и actual reject дадут разные результаты).
   */
  async previewReject(
    filePath: string,
    original: string,
    modified: string,
    hunkIndicesToReject: number[],
    snippets: SnippetDiff[]
  ): Promise<{ preview: string; hasConflicts: boolean }>;

  /**
   * Batch apply — все решения из review session.
   */
  async applyReviewDecisions(
    request: ApplyReviewRequest,
    fileContents: Map<string, FileChangeWithContent>
  ): Promise<ApplyReviewResult>;
}
```

**Reject algorithm детально:**

У нас есть два подхода. **PRIMARY** — snippet-level replace (простой и надёжный). **FALLBACK** — hunk-level inverse patch (для случаев когда snippet-chain неполный).

**PRIMARY: Snippet-level replace (рекомендуемый)**

```typescript
// Простейший подход: у нас уже есть snippets с (oldString, newString)
// Reject = заменить newString обратно на oldString
async rejectHunks(
  filePath: string,
  original: string,
  modified: string,
  hunkIndicesToReject: number[],
  snippets: SnippetDiff[]
): Promise<RejectResult> {
  // 1. Прочитать текущий файл с диска
  let content = await readFile(filePath, 'utf8');

  // 2. Проверить: файл не изменён с момента agent changes?
  if (content !== modified) {
    // Конфликт — файл был модифицирован
    return this.resolveWithThreeWayMerge(original, content, modified, hunkIndicesToReject, snippets);
  }

  // 3. Применить snippet-level replace для rejected hunks
  //
  // R2 FIX: Используем ПОЗИЦИОННЫЙ reverse (не хронологический!):
  // - Сначала находим ВСЕ позиции через indexOf
  // - Сортируем по позиции УБЫВАНИЯ (от конца файла к началу)
  // - Применяем замены — каждая не сдвигает позиции предыдущих
  //
  // Также: если newString встречается в файле несколько раз,
  // используем позицию ближайшую к ожидаемой (на основе snippet order).

  const rejectedSnippets = hunkIndicesToReject
    .map(idx => snippets[idx])
    .filter(Boolean);

  // Найти позиции ПЕРЕД заменами
  const positioned: Array<{ snippet: SnippetDiff; offset: number }> = [];
  for (const snippet of rejectedSnippets) {
    if (snippet.type === 'write-new') continue; // Обрабатывается через rejectFile()

    // Guard: пустой newString (delete operation) — indexOf('') вернёт 0, сломает файл
    if (!snippet.newString) {
      // Delete reject = вставить oldString обратно. Требует позиционный контекст.
      // Fallback на hunk-level для таких случаев.
      return this.rejectHunksFallback(filePath, original, modified, hunkIndicesToReject);
    }

    // replaceAll: true — все вхождения были заменены, нужно откатить все
    if (snippet.replaceAll) {
      content = content.replaceAll(snippet.newString, snippet.oldString);
      continue; // Не добавляем в positioned — уже обработано
    }

    const offset = content.indexOf(snippet.newString);
    if (offset === -1) {
      // Snippet не найден — fallback на hunk-level
      return this.rejectHunksFallback(filePath, original, modified, hunkIndicesToReject);
    }

    // Проверка уникальности: если есть второе вхождение, это опасно
    const secondOccurrence = content.indexOf(snippet.newString, offset + 1);
    if (secondOccurrence !== -1 && snippet.newString.length < 20) {
      // Короткий неуникальный snippet — fallback (безопаснее)
      return this.rejectHunksFallback(filePath, original, modified, hunkIndicesToReject);
    }

    positioned.push({ snippet, offset });
  }

  // Сортировка по позиции УБЫВАНИЯ (от конца к началу)
  positioned.sort((a, b) => b.offset - a.offset);

  for (const { snippet, offset } of positioned) {
    content = content.slice(0, offset) + snippet.oldString + content.slice(offset + snippet.newString.length);
  }

  // 4. Записать результат
  await writeFile(filePath, content, 'utf8');
  return { success: true, newContent: content, hadConflicts: false };
}
```

**FALLBACK: Hunk-level inverse patch (когда snippets неполные)**

```typescript
// Используется когда snippet.newString не найден в файле (файл изменён после agent)
private async rejectHunksFallback(
  filePath: string,
  original: string,
  modified: string,
  hunkIndicesToReject: number[]
): Promise<RejectResult> {
  // Шаг 1: Вычислить structured patch
  const patch = Diff.structuredPatch('file', 'file', original, modified);

  // Шаг 2: Отфильтровать только rejected hunks
  const rejectedPatch = {
    ...patch,
    hunks: patch.hunks.filter((_, idx) => hunkIndicesToReject.includes(idx))
  };

  // Шаг 3: Инвертировать patch вручную (jsdiff НЕ имеет reversed option!)
  const inversePatch = invertPatch(rejectedPatch);

  // Шаг 4: Применить к modified content
  const result = Diff.applyPatch(modified, inversePatch);
  if (result === false) {
    // Patch не применился — three-way merge
    const currentDisk = await readFile(filePath, 'utf8');
    return this.resolveWithThreeWayMerge(original, currentDisk, modified, hunkIndicesToReject, []);
  }

  await writeFile(filePath, result, 'utf8');
  return { success: true, newContent: result, hadConflicts: false };
}
```

**Инвертирование patch (verified jsdiff API):**

```typescript
function invertPatch(patch: Diff.ParsedDiff): Diff.ParsedDiff {
  return {
    ...patch,
    oldFileName: patch.newFileName,
    newFileName: patch.oldFileName,
    oldHeader: patch.newHeader ?? '',
    newHeader: patch.oldHeader ?? '',
    hunks: patch.hunks.map(hunk => ({
      oldStart: hunk.newStart,
      oldLines: hunk.newLines,
      newStart: hunk.oldStart,
      newLines: hunk.oldLines,
      lines: hunk.lines.map(line => {
        if (line.startsWith('+')) return '-' + line.slice(1);
        if (line.startsWith('-')) return '+' + line.slice(1);
        return line; // context lines (prefix ' ') — без изменений
      })
    }))
  };
}
```

**Three-way merge (при конфликтах) — verified node-diff3 API:**

```typescript
import { diff3Merge } from 'node-diff3';

// VERIFIED API: diff3Merge(a, o, b, options?)
// a = "ours" (changed version A)
// o = "original" (base)
// b = "theirs" (changed version B)
// Принимает string[] (массив строк) ИЛИ строки
// Возвращает: Array<{ ok: string[] } | { conflict: { a: string[], o: string[], b: string[] } }>

function threeWayMerge(
  base: string,      // Original content before agent changes
  ours: string,      // Current file on disk (user's version)
  theirs: string     // What we want after reject
): { content: string; hasConflicts: boolean } {
  const result = diff3Merge(
    ours.split('\n'),     // a = current disk
    base.split('\n'),     // o = original (base)
    theirs.split('\n')    // b = target after reject
  );

  let hasConflicts = false;
  const lines: string[] = [];

  for (const part of result) {
    if ('ok' in part) {
      lines.push(...part.ok);
    } else if ('conflict' in part) {
      hasConflicts = true;
      lines.push('<<<<<<< Current (yours)');
      lines.push(...(part.conflict.a ?? []));
      lines.push('||||||| Original');
      lines.push(...(part.conflict.o ?? []));   // node-diff3 также возвращает .o (original)
      lines.push('=======');
      lines.push(...(part.conflict.b ?? []));
      lines.push('>>>>>>> Reverted (rejected changes)');
    }
  }

  return { content: lines.join('\n'), hasConflicts };
}
```

### 4. IPC каналы: `src/preload/constants/ipcChannels.ts` (MODIFY)

```typescript
// Phase 2 additions
export const REVIEW_CHECK_CONFLICT = 'review:checkConflict';
export const REVIEW_REJECT_HUNKS = 'review:rejectHunks';
export const REVIEW_REJECT_FILE = 'review:rejectFile';
export const REVIEW_PREVIEW_REJECT = 'review:previewReject';
export const REVIEW_APPLY_DECISIONS = 'review:applyDecisions';
export const REVIEW_GET_FILE_CONTENT = 'review:getFileContent';
```

### 5. IPC хендлеры: `src/main/ipc/review.ts` (MODIFY — расширение Phase 1)

**Регистрация**: В `src/main/index.ts` `initializeServices()` создать новые сервисы:
```typescript
const fileContentResolver = new FileContentResolver(teamMemberLogsFinder);
const reviewApplier = new ReviewApplierService();
```

Обновить вызов `initializeReviewHandlers()` — Phase 1 использует объект-конфиг `ReviewHandlerDeps`, Phase 2 добавляет optional fields:
```typescript
// index.ts — Phase 2 расширение (вместо только { extractor: changeExtractor }):
initializeReviewHandlers({
  extractor: changeExtractor,
  applier: reviewApplier,
  contentResolver: fileContentResolver,
});
```
`registerReviewHandlers()` и `removeReviewHandlers()` уже зарегистрированы в Phase 1.

**ВАЖНО**: `removeReviewHandlers()` нужно обновить — добавить Phase 2 каналы:
```typescript
export function removeReviewHandlers(ipcMain: IpcMain): void {
  // Phase 1
  ipcMain.removeHandler(REVIEW_GET_AGENT_CHANGES);
  ipcMain.removeHandler(REVIEW_GET_TASK_CHANGES);
  ipcMain.removeHandler(REVIEW_GET_CHANGE_STATS);
  // Phase 2
  ipcMain.removeHandler(REVIEW_CHECK_CONFLICT);
  ipcMain.removeHandler(REVIEW_REJECT_HUNKS);
  ipcMain.removeHandler(REVIEW_REJECT_FILE);
  ipcMain.removeHandler(REVIEW_PREVIEW_REJECT);
  ipcMain.removeHandler(REVIEW_APPLY_DECISIONS);
  ipcMain.removeHandler(REVIEW_GET_FILE_CONTENT);
}
```

**ВАЖНО**: Обновить `ReviewAPI` в `src/shared/types/api.ts` — добавить Phase 2 методы:
```typescript
export interface ReviewAPI {
  // Phase 1
  getAgentChanges: (...) => Promise<AgentChangeSet>;
  getTaskChanges: (...) => Promise<TaskChangeSet>;
  getChangeStats: (...) => Promise<ChangeStats>;
  // Phase 2
  checkConflict: (filePath: string, expectedModified: string) => Promise<ConflictCheckResult>;
  rejectHunks: (teamName: string, filePath: string, original: string, modified: string, hunkIndices: number[], snippets: SnippetDiff[]) => Promise<RejectResult>;
  rejectFile: (teamName: string, filePath: string, original: string, modified: string) => Promise<RejectResult>;
  previewReject: (filePath: string, original: string, modified: string, hunkIndices: number[], snippets: SnippetDiff[]) => Promise<{ preview: string; hasConflicts: boolean }>;
  applyDecisions: (request: ApplyReviewRequest) => Promise<ApplyReviewResult>;
  getFileContent: (teamName: string, memberName: string, filePath: string) => Promise<FileChangeWithContent>;
}
```

Также обновить `HttpAPIClient` — добавить стубы для Phase 2 методов.

```typescript
// Расширяем Phase 1 хендлеры

let reviewApplier: ReviewApplierService | null = null;
let fileContentResolver: FileContentResolver | null = null;

// Phase 2: Расширяем ReviewHandlerDeps из Phase 1 (объект-конфиг — forward compatible)
// Phase 1 определил: interface ReviewHandlerDeps { extractor: ChangeExtractorService; ... }
// Phase 2 добавляет optional fields (НЕ ломает Phase 1 вызов):
interface ReviewHandlerDeps {
  extractor: ChangeExtractorService;
  applier?: ReviewApplierService;
  contentResolver?: FileContentResolver;
  // Phase 4 добавит: gitFallback?: GitDiffFallback;
}

export function initializeReviewHandlers(deps: ReviewHandlerDeps): void {
  changeExtractor = deps.extractor;
  reviewApplier = deps.applier ?? null;
  fileContentResolver = deps.contentResolver ?? null;
}

// Guard helpers
function getApplier(): ReviewApplierService {
  if (!reviewApplier) throw new Error('ReviewApplierService not initialized (Phase 2 required)');
  return reviewApplier;
}
function getContentResolver(): FileContentResolver {
  if (!fileContentResolver) throw new Error('FileContentResolver not initialized (Phase 2 required)');
  return fileContentResolver;
}

// Регистрация Phase 2 хендлеров
export function registerReviewHandlers(ipcMain: IpcMain): void {
  // Phase 1
  ipcMain.handle(REVIEW_GET_AGENT_CHANGES, handleGetAgentChanges);
  ipcMain.handle(REVIEW_GET_TASK_CHANGES, handleGetTaskChanges);
  ipcMain.handle(REVIEW_GET_CHANGE_STATS, handleGetChangeStats);

  // Phase 2
  ipcMain.handle(REVIEW_CHECK_CONFLICT, handleCheckConflict);
  ipcMain.handle(REVIEW_REJECT_HUNKS, handleRejectHunks);
  ipcMain.handle(REVIEW_REJECT_FILE, handleRejectFile);
  ipcMain.handle(REVIEW_PREVIEW_REJECT, handlePreviewReject);
  ipcMain.handle(REVIEW_APPLY_DECISIONS, handleApplyDecisions);
  ipcMain.handle(REVIEW_GET_FILE_CONTENT, handleGetFileContent);
}

async function handleGetFileContent(
  _event: IpcMainInvokeEvent,
  teamName: string,
  memberName: string,
  filePath: string
): Promise<IpcResult<FileChangeWithContent>> {
  return wrapReviewHandler('review:getFileContent', async () => {
    const resolver = getContentResolver();
    const resolved = await resolver.resolveFileContent(teamName, memberName, filePath);

    // ВАЖНО: resolver возвращает { original, modified, source },
    // но ReviewAPI.getFileContent обещает FileChangeWithContent.
    // Нужно маппить в полный тип:
    const extractor = getChangeExtractor();
    const changeSet = await extractor.getAgentChanges(teamName, memberName);
    const fileSummary = changeSet.files.find(f => f.filePath === filePath);

    return {
      filePath,
      relativePath: fileSummary?.relativePath ?? filePath.split('/').pop() ?? filePath,
      snippets: fileSummary?.snippets ?? [],
      linesAdded: fileSummary?.linesAdded ?? 0,
      linesRemoved: fileSummary?.linesRemoved ?? 0,
      isNewFile: fileSummary?.isNewFile ?? false,
      originalFullContent: resolved.original,
      modifiedFullContent: resolved.modified,
      contentSource: resolved.source,
    };
  });
}

async function handleRejectHunks(
  _event: IpcMainInvokeEvent,
  teamName: string,  // для path traversal validation
  filePath: string,
  original: string,
  modified: string,
  hunkIndices: number[],
  snippets: SnippetDiff[]  // R1 fix: renderer MUST передать snippets
): Promise<IpcResult<RejectResult>> {
  return wrapReviewHandler('review:rejectHunks', async () => {
    // Security: path traversal protection — ОБЯЗАТЕЛЬНО перед writeFile!
    // Получаем projectPath из team config через TeamDataService
    const teamData = getTeamDataService(); // добавить в ReviewHandlerDeps
    const team = await teamData.getTeam(teamName); // teamName из IPC args
    if (team?.projectPath) {
      const resolved = require('path').resolve(filePath);
      if (!resolved.startsWith(team.projectPath)) {
        throw new Error('File path outside project directory');
      }
    }
    const applier = getApplier();
    return await applier.rejectHunks(filePath, original, modified, hunkIndices, snippets);
  });
}

async function handleApplyDecisions(
  _event: IpcMainInvokeEvent,
  request: ApplyReviewRequest
): Promise<IpcResult<ApplyReviewResult>> {
  return wrapReviewHandler('review:applyDecisions', async () => {
    // Validation: хотя бы один из taskId/memberName обязателен
    if (!request.taskId && !request.memberName) {
      throw new Error('Either taskId or memberName must be provided');
    }

    const applier = getApplier();
    const resolver = getContentResolver();

    // Resolve all file contents first
    const filePaths = request.decisions.map(d => d.filePath);

    // В task mode memberName может быть undefined — resolver должен определить
    // member из task scope. В agent mode memberName обязательно задан.
    const memberName = request.memberName ?? '';
    const contents = await resolver.resolveAllFileContents(
      request.teamName,
      memberName,
      filePaths
    );

    // Dry-run: сначала previewReject для всех файлов, чтобы обнаружить ошибки ДО записи
    const rejectedDecisions = request.decisions.filter(d =>
      Object.values(d.hunkDecisions).some(v => v === 'rejected')
    );
    for (const decision of rejectedDecisions) {
      const fc = contents.get(decision.filePath);
      if (!fc?.originalFullContent || !fc?.modifiedFullContent) continue;
      const preview = await applier.previewReject(
        decision.filePath, fc.originalFullContent, fc.modifiedFullContent,
        Object.entries(decision.hunkDecisions)
          .filter(([, v]) => v === 'rejected')
          .map(([k]) => Number(k))
      );
      if (preview.hasConflicts) {
        throw new Error(`Conflict detected in ${decision.filePath}. Resolve before applying.`);
      }
    }

    return await applier.applyReviewDecisions(request, contents);
  });
}
```

### 6. Preload bridge: `src/preload/index.ts` (MODIFY — расширение Phase 1)

```typescript
review: {
  // Phase 1
  getAgentChanges: (teamName: string, memberName: string) =>
    invokeIpcWithResult<AgentChangeSet>(REVIEW_GET_AGENT_CHANGES, teamName, memberName),
  getTaskChanges: (teamName: string, taskId: string) =>
    invokeIpcWithResult<TaskChangeSet>(REVIEW_GET_TASK_CHANGES, teamName, taskId),
  getChangeStats: (teamName: string, memberName: string) =>
    invokeIpcWithResult<ChangeStats>(REVIEW_GET_CHANGE_STATS, teamName, memberName),

  // Phase 2
  checkConflict: (filePath: string, expectedModified: string) =>
    invokeIpcWithResult<ConflictCheckResult>(REVIEW_CHECK_CONFLICT, filePath, expectedModified),
  rejectHunks: (filePath: string, original: string, modified: string, hunkIndices: number[], snippets: SnippetDiff[]) =>
    invokeIpcWithResult<RejectResult>(REVIEW_REJECT_HUNKS, filePath, original, modified, hunkIndices, snippets),
  rejectFile: (filePath: string, original: string, modified: string) =>
    invokeIpcWithResult<RejectResult>(REVIEW_REJECT_FILE, filePath, original, modified),
  previewReject: (filePath: string, original: string, modified: string, hunkIndices: number[], snippets: SnippetDiff[]) =>
    invokeIpcWithResult<{ preview: string; hasConflicts: boolean }>(
      REVIEW_PREVIEW_REJECT, filePath, original, modified, hunkIndices, snippets
    ),
  applyDecisions: (request: ApplyReviewRequest) =>
    invokeIpcWithResult<ApplyReviewResult>(REVIEW_APPLY_DECISIONS, request),
  getFileContent: (teamName: string, memberName: string, filePath: string) =>
    invokeIpcWithResult<FileChangeWithContent>(REVIEW_GET_FILE_CONTENT, teamName, memberName, filePath),
},
```

---

## Frontend

### 7. Zustand slice: `src/renderer/store/slices/changeReviewSlice.ts` (MODIFY — расширение Phase 1)

```typescript
export interface ChangeReviewSlice {
  // Phase 1 state
  activeChangeSet: AgentChangeSet | TaskChangeSet | null;
  changeSetLoading: boolean;
  changeSetError: string | null;
  selectedReviewFilePath: string | null;
  changeStatsCache: Record<string, ChangeStats>;

  // Phase 2 additions
  /** Per-hunk решения. Ключ = "filePath:hunkIndex" */
  hunkDecisions: Record<string, HunkDecision>;
  /** Per-file решения */
  fileDecisions: Record<string, HunkDecision>;
  /** Resolved file contents для CodeMirror (original + modified) */
  fileContents: Record<string, FileChangeWithContent>;
  fileContentsLoading: Record<string, boolean>;
  /** Режим отображения */
  diffViewMode: 'unified' | 'split';
  /** Показывать ли unchanged строки */
  collapseUnchanged: boolean;
  /** Ошибка apply */
  applyError: string | null;
  /** В процессе apply */
  applying: boolean;

  // Phase 1 actions (MUST be included — Phase 2 interface is full superset)
  fetchAgentChanges: (teamName: string, memberName: string) => Promise<void>;
  fetchTaskChanges: (teamName: string, taskId: string) => Promise<void>;
  selectReviewFile: (filePath: string | null) => void;
  fetchChangeStats: (teamName: string, memberName: string) => Promise<void>;

  // Phase 2 actions
  setHunkDecision: (filePath: string, hunkIndex: number, decision: HunkDecision) => void;
  setFileDecision: (filePath: string, decision: HunkDecision) => void;
  acceptAllFile: (filePath: string) => void;
  rejectAllFile: (filePath: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  setDiffViewMode: (mode: 'unified' | 'split') => void;
  setCollapseUnchanged: (collapse: boolean) => void;
  /** memberName optional — в task mode определяется из changeSet */
  fetchFileContent: (teamName: string, memberName: string | undefined, filePath: string) => Promise<void>;
  previewReject: (filePath: string) => Promise<{ preview: string; hasConflicts: boolean }>;
  applyReview: (teamName: string, taskId?: string, memberName?: string) => Promise<void>;
  clearChangeReview: () => void;
  /** Инвалидировать changeStatsCache при team data refresh */
  invalidateChangeStats: (teamName: string) => void;
}
```

**Ключевая логика:**

```typescript
setHunkDecision: (filePath, hunkIndex, decision) => {
  const key = `${filePath}:${hunkIndex}`;
  set(state => ({
    hunkDecisions: { ...state.hunkDecisions, [key]: decision }
  }));
},

acceptAllFile: (filePath) => {
  const changeSet = get().activeChangeSet;
  if (!changeSet) return;
  const file = changeSet.files.find(f => f.filePath === filePath);
  if (!file) return;

  const newDecisions = { ...get().hunkDecisions };
  // Количество hunks = количество snippets (Phase 1 mapping)
  for (let i = 0; i < file.snippets.length; i++) {
    newDecisions[`${filePath}:${i}`] = 'accepted';
  }
  set({
    hunkDecisions: newDecisions,
    fileDecisions: { ...get().fileDecisions, [filePath]: 'accepted' }
  });
},

applyReview: async (teamName, taskId, memberName) => {
  set({ applying: true, applyError: null });
  try {
    const { hunkDecisions, fileDecisions, activeChangeSet } = get();
    if (!activeChangeSet) throw new Error('No active change set');

    // Stale check: пересчитать computedAt и сравнить с текущим
    // Если не совпадает — данные устарели (file watcher мог обновить между review и apply)
    const freshSet = taskId
      ? await api.review.getTaskChanges(teamName, taskId)
      : await api.review.getAgentChanges(teamName, memberName!);
    if (freshSet.computedAt !== activeChangeSet.computedAt) {
      set({
        applying: false,
        applyError: 'Changes have been updated since you started reviewing. Please review again.',
        activeChangeSet: freshSet, // обновляем данные
        hunkDecisions: {},         // сбрасываем decisions
        fileDecisions: {},
      });
      return;
    }

    // Собрать decisions
    const decisions: FileReviewDecision[] = activeChangeSet.files.map(file => {
      const perHunk: Record<number, HunkDecision> = {};
      for (let i = 0; i < file.snippets.length; i++) {
        const key = `${file.filePath}:${i}`;
        perHunk[i] = hunkDecisions[key] ?? 'pending';
      }
      return {
        filePath: file.filePath,
        fileDecision: fileDecisions[file.filePath] ?? 'pending',
        hunkDecisions: perHunk,
      };
    });

    // Отправить только файлы с rejected hunks
    const withRejections = decisions.filter(d =>
      Object.values(d.hunkDecisions).some(v => v === 'rejected')
    );

    if (withRejections.length === 0) {
      set({ applying: false });
      return; // Ничего reject'ить не нужно
    }

    const result = await api.review.applyDecisions({
      teamName,
      taskId,
      memberName,
      decisions: withRejections,
    });

    if (result.errors.length > 0) {
      set({ applyError: `${result.errors.length} file(s) failed` });
    }

    set({ applying: false });
  } catch (error) {
    set({
      applying: false,
      applyError: mapReviewError(error),
    });
  }
},
```

**Error mapping:**

```typescript
function mapReviewError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error);
  if (message.includes('conflict')) {
    return 'File has been modified since agent changes. Manual resolution required.';
  }
  if (message.includes('ENOENT')) {
    return 'File no longer exists on disk.';
  }
  if (message.includes('EACCES') || message.includes('Permission')) {
    return 'Permission denied. Check file permissions.';
  }
  return message || 'Failed to apply review changes';
}
```

### 8. Компоненты

#### `src/renderer/components/team/review/CodeMirrorDiffView.tsx` (NEW)

**Главный компонент** — обёртка над `@codemirror/merge`.

```typescript
import { useRef, useEffect, useMemo } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';
import { unifiedMergeView, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { xml } from '@codemirror/lang-xml';
// НЕ используем @codemirror/theme-one-dark — вместо этого CSS variables

interface CodeMirrorDiffViewProps {
  /** Полное содержимое файла ДО изменений */
  original: string;
  /** Полное содержимое файла ПОСЛЕ изменений */
  modified: string;
  /** Имя файла (для language detection) */
  fileName: string;
  /** Максимальная высота контейнера */
  maxHeight?: string;
  /** Read-only режим (Phase 1: true, Phase 2: false для accept/reject) */
  readOnly?: boolean;
  /** Показывать accept/reject кнопки на каждом hunk */
  showMergeControls?: boolean;
  /** Сворачивать unchanged строки */
  collapseUnchanged?: boolean;
  /** Margin для collapsed секций (количество видимых строк вокруг изменений) */
  collapseMargin?: number;
  /** Callback: пользователь нажал Accept на hunk */
  onHunkAccepted?: (hunkIndex: number) => void;
  /** Callback: пользователь нажал Reject на hunk */
  onHunkRejected?: (hunkIndex: number) => void;
}

export function CodeMirrorDiffView({
  original,
  modified,
  fileName,
  maxHeight = '600px',
  readOnly = true,
  showMergeControls = false,
  collapseUnchanged = true,
  collapseMargin = 3,
  onHunkAccepted,
  onHunkRejected,
}: CodeMirrorDiffViewProps): JSX.Element;
```

**Ключевые нюансы реализации:**

1. **useRef для EditorView** — нужен cleanup при unmount:
   ```typescript
   const containerRef = useRef<HTMLDivElement>(null);
   const editorRef = useRef<EditorView | null>(null);

   useEffect(() => {
     if (!containerRef.current) return;

     const view = new EditorView({
       doc: modified,
       extensions,
       parent: containerRef.current,
     });
     editorRef.current = view;

     return () => {
       view.destroy();
       editorRef.current = null;
     };
   }, [original, modified, fileName]); // Recreate on content change
   ```

2. **Language detection** (по расширению файла):
   ```typescript
   function getLanguageExtension(fileName: string) {
     const ext = fileName.split('.').pop()?.toLowerCase();
     switch (ext) {
       case 'ts': case 'tsx': case 'js': case 'jsx': case 'mjs': case 'cjs':
         return javascript({ typescript: ext.startsWith('t'), jsx: ext.endsWith('x') });
       case 'py': return python();
       case 'json': return json();
       case 'css': case 'scss': case 'less': return css();
       case 'html': case 'htm': return html();
       case 'xml': case 'svg': return xml();
       default: return []; // Plain text
     }
   }
   ```

3. **Merge controls (accept/reject кнопки) — VERIFIED API:**

   ```typescript
   // VERIFIED: mergeControls сигнатура:
   // (type: "reject" | "accept", action: (e: MouseEvent) => void) => HTMLElement
   //
   // ВАЖНО: action — это callback с MouseEvent параметром!
   // Кнопки должны использовать onmousedown (не onclick) — это паттерн CM.

   mergeControls: showMergeControls
     ? (type: 'reject' | 'accept', action: (e: MouseEvent) => void) => {
         const btn = document.createElement('button');
         btn.className = type === 'accept'
           ? 'cm-merge-accept-btn'
           : 'cm-merge-reject-btn';
         btn.textContent = type === 'accept' ? 'Accept' : 'Reject';
         btn.title = type === 'accept'
           ? 'Keep this change'
           : 'Revert this change';
         btn.onmousedown = action; // ВАЖНО: onmousedown, НЕ onclick!
         return btn;
       }
     : undefined,
   ```

4. **Event tracking для accept/reject — через mergeControls callback (НЕ Transaction аннотации!):**

   **ВАЖНО**: `Transaction.userEvent` значения `"accept"`/`"revert"` — это internal implementation detail
   `@codemirror/merge`, **не документированные публично**. Могут измениться без предупреждения.
   Вместо перехвата аннотаций — используем `mergeControls` callback:

   ```typescript
   // mergeControls callback уже вызывается при клике accept/reject.
   // Вычисляем hunk index ВНУТРИ callback через getChunks():
   import { getChunks } from '@codemirror/merge';

   mergeControls: showMergeControls
     ? (type: 'reject' | 'accept', action: (e: MouseEvent) => void) => {
         const btn = document.createElement('button');
         btn.className = type === 'accept' ? 'cm-merge-accept-btn' : 'cm-merge-reject-btn';
         btn.textContent = type === 'accept' ? 'Accept' : 'Reject';
         btn.onmousedown = (e) => {
           // 1. Вычисляем hunk index ДО action (action изменит state)
           const view = editorRef.current;
           if (view) {
             const pos = view.state.selection.main.head;
             const hunkIndex = computeHunkIndexAtPos(view.state, pos);
             // 2. Выполняем оригинальное CM action
             action(e);
             // 3. Callback в React
             if (type === 'accept') onHunkAccepted?.(hunkIndex);
             else onHunkRejected?.(hunkIndex);
           } else {
             action(e);
           }
         };
         return btn;
       }
     : undefined,
   ```

   Для **keyboard shortcuts** (Phase 4) — используем `acceptChunk(view, pos)` / `rejectChunk(view, pos)` программно и вызываем callback напрямую.

   **Chunk positions через `getChunks()` — PUBLIC API:**

   `@codemirror/merge` экспортирует `getChunks(state)` для получения позиций chunks.
   **НЕ используем jsdiff** для вычисления hunk позиций — jsdiff и CM используют РАЗНЫЕ diff алгоритмы, границы hunks могут не совпадать!

   ```typescript
   import { getChunks, acceptChunk, rejectChunk } from '@codemirror/merge';

   function computeHunkIndexAtPos(state: EditorState, pos: number): number {
     const result = getChunks(state);
     if (!result) return -1;
     const { chunks } = result;
     const line = state.doc.lineAt(pos).number;
     return chunks.findIndex(c => line >= c.fromB && line < c.toB);
   }

   // Программный accept/reject по позиции (вместо перехвата Transaction аннотаций):
   function acceptHunkAtPos(view: EditorView, pos: number): boolean {
     return acceptChunk(view, pos);
   }
   function rejectHunkAtPos(view: EditorView, pos: number): boolean {
     return rejectChunk(view, pos);
   }
   ```

   **ВАЖНО**: `acceptChunk`/`rejectChunk` — публичные функции из `@codemirror/merge`.
   Принимают `(view: EditorView, pos?: number)`, возвращают `boolean`.
   Если `pos` не указан — работают с chunk под курсором.

5. **Keyboard navigation — прямой вызов (НЕ .run()):**

   ```typescript
   // goToNextChunk и goToPreviousChunk — это функции (Command type).
   // Используются через keymap ИЛИ прямой вызов:

   keymap.of([
     { key: 'Ctrl-Alt-ArrowDown', run: goToNextChunk },
     { key: 'Ctrl-Alt-ArrowUp', run: goToPreviousChunk },
   ]),

   // Программный вызов (прямой, НЕ через .run()!):
   // goToNextChunk(editorRef.current!) // returns boolean
   ```

6. **Unified vs Split — РАЗНЫЕ классы!**

   Toggle unified ↔ split требует **полного пересоздания**:
   - **Unified**: `new EditorView({ extensions: [unifiedMergeView({...})] })`
   - **Split**: `new MergeView({ a: {...}, b: {...}, parent, revertControls: 'a-to-b' })`

   Это разные DOM-структуры и разные lifecycle. При переключении — `destroy()` старый + создать новый.
   В split mode: `MergeView` имеет `.a` и `.b` EditorView, accept/reject через `revertControls` (не `mergeControls`).

   ```typescript
   // Ref должен быть union:
   const viewRef = useRef<EditorView | MergeView | null>(null);

   // Helper для получения активного EditorView:
   function getActiveEditorView(): EditorView | null {
     const ref = viewRef.current;
     if (!ref) return null;
     if ('b' in ref) return ref.b; // MergeView → use "modified" side
     return ref; // EditorView (unified)
   }
   ```

5. **Тема (CSS variables integration)**:
   ```typescript
   const customTheme = EditorView.theme({
     '&': {
       backgroundColor: 'var(--color-surface)',
       color: 'var(--color-text)',
       fontFamily: 'var(--font-mono, ui-monospace, monospace)',
       fontSize: '13px',
     },
     '.cm-gutters': {
       backgroundColor: 'var(--color-surface)',
       borderRight: '1px solid var(--color-border)',
       color: 'var(--code-line-number)',
     },
     '.cm-changedLine': {
       backgroundColor: 'var(--diff-added-bg) !important',
     },
     '.cm-deletedChunk': {
       backgroundColor: 'var(--diff-removed-bg) !important',
     },
     '.cm-changedText': {
       backgroundColor: 'var(--diff-added-bg)',
       borderBottom: '1px solid var(--diff-added-border)',
     },
     '.cm-deletedText': {
       backgroundColor: 'var(--diff-removed-bg)',
       borderBottom: '1px solid var(--diff-removed-border)',
     },
     // Accept/Reject button styles
     '.cm-merge-accept-btn': {
       padding: '1px 8px',
       borderRadius: '3px',
       fontSize: '11px',
       cursor: 'pointer',
       backgroundColor: 'rgba(34, 197, 94, 0.2)',
       color: 'var(--diff-added-text)',
       border: '1px solid var(--diff-added-border)',
       marginRight: '4px',
     },
     '.cm-merge-accept-btn:hover': {
       backgroundColor: 'rgba(34, 197, 94, 0.35)',
     },
     '.cm-merge-reject-btn': {
       padding: '1px 8px',
       borderRadius: '3px',
       fontSize: '11px',
       cursor: 'pointer',
       backgroundColor: 'rgba(239, 68, 68, 0.2)',
       color: 'var(--diff-removed-text)',
       border: '1px solid var(--diff-removed-border)',
     },
     '.cm-merge-reject-btn:hover': {
       backgroundColor: 'rgba(239, 68, 68, 0.35)',
     },
   }); // БЕЗ { dark: true } — CSS variables адаптируются к теме автоматически
   ```

6. **Extensions assembly — VERIFIED unifiedMergeView config:**
   ```typescript
   // VERIFIED: полная сигнатура unifiedMergeView config:
   // {
   //   original: Text | string,                    // Required
   //   highlightChanges?: boolean,                  // Default: true
   //   gutter?: boolean,                            // Default: true
   //   syntaxHighlightDeletions?: boolean,           // Default: true
   //   mergeControls?: boolean | ((type, action) => HTMLElement),
   //   diffConfig?: DiffConfig,
   //   collapseUnchanged?: { margin?: number, minSize?: number },
   // }

   const extensions = useMemo(() => [
     readOnly ? EditorState.readOnly.of(true) : [],
     readOnly ? EditorView.editable.of(false) : [],
     getLanguageExtension(fileName),
     customTheme,
     keymap.of([
       { key: 'Ctrl-Alt-ArrowDown', run: goToNextChunk },
       { key: 'Ctrl-Alt-ArrowUp', run: goToPreviousChunk },
     ]),
     unifiedMergeView({
       original,
       mergeControls: showMergeControls ? mergeControlsFactory : undefined,
       highlightChanges: true,
       gutter: true,
       syntaxHighlightDeletions: true,
       collapseUnchanged: collapseUnchanged
         ? { margin: collapseMargin, minSize: 4 }
         : undefined,
     }),
     updateListener,
   ].flat(), [original, modified, fileName, showMergeControls, collapseUnchanged]);
   ```

#### `src/renderer/components/team/review/ReviewToolbar.tsx` (NEW)

```typescript
interface ReviewToolbarProps {
  /** Количество pending / accepted / rejected */
  stats: { pending: number; accepted: number; rejected: number };
  /** Общая статистика изменений */
  changeStats: ChangeStats;
  diffViewMode: 'unified' | 'split';
  collapseUnchanged: boolean;
  applying: boolean;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onApply: () => void;
  onDiffViewModeChange: (mode: 'unified' | 'split') => void;
  onCollapseUnchangedChange: (collapse: boolean) => void;
}
```

**Содержимое:**
- Кнопки: "Accept All" (зелёная), "Reject All" (красная), "Apply Changes" (primary, disabled если нет rejected)
- Toggle: Unified ↔ Split view
- Toggle: Collapse unchanged
- Badge: `3 pending · 5 accepted · 2 rejected`
- Badge: `+142 -38 across 7 files`

#### `src/renderer/components/team/review/ConflictDialog.tsx` (NEW)

```typescript
interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  conflictContent: string;
  onResolveKeepCurrent: () => void;
  onResolveUseOriginal: () => void;
  onResolveManual: (content: string) => void;
}
```

**Содержимое:**
- Предупреждение: "This file has been modified since the agent's changes"
- Показ conflict markers (<<<<<<< / ======= / >>>>>>>)
- Три кнопки:
  1. "Keep Current" — оставить как есть на диске
  2. "Use Agent's Original" — восстановить до-агентное состояние
  3. "Edit Manually" — открыть CodeMirror для ручного редактирования

### 9. Модификация существующих компонентов

#### `ChangeReviewDialog.tsx` (MODIFY — замена Phase 1 ReviewDiffContent)

Phase 1 использовал простой HTML-рендер. Phase 2 заменяет на `CodeMirrorDiffView`:

```typescript
// Phase 1 (удалить)
<ReviewDiffContent snippets={selectedFile.snippets} />

// Phase 2 (заменить на)
<CodeMirrorDiffView
  original={fileContent?.originalFullContent ?? ''}
  modified={fileContent?.modifiedFullContent ?? ''}
  fileName={selectedFile.relativePath}
  showMergeControls={true}
  collapseUnchanged={collapseUnchanged}
  onHunkAccepted={(idx) => setHunkDecision(selectedFile.filePath, idx, 'accepted')}
  onHunkRejected={(idx) => setHunkDecision(selectedFile.filePath, idx, 'rejected')}
/>
```

**Lazy loading file content:**
```typescript
// При выборе файла — загрузить полное содержимое (если ещё не загружено)
const handleFileSelect = async (filePath: string) => {
  selectReviewFile(filePath);
  if (!fileContents[filePath]) {
    await fetchFileContent(teamName, memberName, filePath);
  }
};
```

#### `ReviewFileTree.tsx` (MODIFY — добавить decision icons)

К каждому файлу добавить иконку состояния:
- Pending: серый кружок
- Partially reviewed: жёлтый кружок (часть hunks решена)
- All accepted: зелёная галочка
- All rejected: красный крестик
- Has conflicts: оранжевый треугольник

```typescript
function getFileStatusIcon(filePath: string, hunkDecisions: Record<string, HunkDecision>, snippetCount: number) {
  const decisions: HunkDecision[] = [];
  for (let i = 0; i < snippetCount; i++) {
    decisions.push(hunkDecisions[`${filePath}:${i}`] ?? 'pending');
  }

  const accepted = decisions.filter(d => d === 'accepted').length;
  const rejected = decisions.filter(d => d === 'rejected').length;
  const pending = decisions.filter(d => d === 'pending').length;

  if (pending === decisions.length) return 'pending';        // All pending
  if (accepted === decisions.length) return 'all-accepted';  // All accepted
  if (rejected === decisions.length) return 'all-rejected';  // All rejected
  return 'partial';                                           // Mixed
}
```

---

## Файлы

| Файл | Тип | ~LOC |
|------|-----|---:|
| `src/shared/types/review.ts` | MODIFY | +120 |
| `src/main/services/team/FileContentResolver.ts` | NEW | 300 |
| `src/main/services/team/ReviewApplierService.ts` | NEW | 400 |
| `src/main/ipc/review.ts` | MODIFY | +120 |
| `src/main/services/team/index.ts` | MODIFY | +2 |
| `src/main/index.ts` | MODIFY | +15 |
| `src/preload/constants/ipcChannels.ts` | MODIFY | +6 |
| `src/preload/index.ts` | MODIFY | +30 |
| `src/renderer/store/slices/changeReviewSlice.ts` | MODIFY | +200 |
| `src/renderer/components/team/review/CodeMirrorDiffView.tsx` | NEW | 350 |
| `src/renderer/components/team/review/ReviewToolbar.tsx` | NEW | 150 |
| `src/renderer/components/team/review/ConflictDialog.tsx` | NEW | 180 |
| `src/renderer/components/team/review/ChangeReviewDialog.tsx` | MODIFY | +60 |
| `src/renderer/components/team/review/ReviewFileTree.tsx` | MODIFY | +40 |
| **Итого** | 4 NEW + 10 MODIFY | ~1,970 |

---

## Edge Cases

1. **Файл удалён с диска** — при reject показываем ошибку "File no longer exists", предлагаем "Recreate from original"
2. **Файл изменён другим агентом** — three-way merge через node-diff3, показ ConflictDialog
3. **Binary файлы** — пропускаем, кнопка "View Changes" не показывается
4. **Очень большие файлы (>10K строк)** — CodeMirror справляется нативно, но добавляем warning badge
5. **Пустой original content** — Write (create) файл. Показываем как "New file" без reject возможности (нет чего откатывать, кроме удаления файла целиком)
6. **Все hunks accepted** — кнопка "Apply" disabled (нечего reject'ить)
7. **Network/IPC error при apply** — показываем toast с ошибкой, не очищаем decisions (можно retry)
8. **Multiple agents edited same file** — каждый agent показывается отдельно, reject применяется к конкретному agent's changes
9. **Content source = 'unavailable'** — показываем snippet-only view (Phase 1 fallback) с warning: "Full file content unavailable. Showing snippet diffs only."
10. **Accept без Apply** — decisions хранятся в Zustand (in-memory), пропадают при закрытии dialog. Это by design: accept = "я посмотрел и ОК", reject + Apply = "откатить изменения"
11. **App restart между view и apply** — `ApplyReviewRequest` не содержит original/modified content. Если app перезагрузить → `FileContentResolver` переобчислит content из JSONL (кешируется на 3 мин). Worst case: file-history backup + snippet chain дадут тот же результат. Если файл на диске изменился → conflict detection сработает корректно

## Тестирование

- Unit test для `ReviewApplierService.rejectHunks()` с различными patch configurations
- Unit test для `invertPatch()` — корректная инверсия +/- строк
- Unit test для three-way merge сценариев (конфликт / авто-merge / clean)
- Unit test для `FileContentResolver` — file-history, snippet-reconstruction, disk fallback
- Unit test для `changeReviewSlice` — hunk decisions, accept/reject all, apply flow
- Unit test для `CodeMirrorDiffView` — mount/unmount lifecycle, event handling
- Integration test: полный flow от "View Changes" → accept/reject → apply → verify file on disk
- Manual test с реальными team sessions из `~/.claude/projects/`
