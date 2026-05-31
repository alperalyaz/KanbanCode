import { extractMarkdownPlainText } from '@shared/utils/markdownTextSearch';

import type { TaskRef } from '@shared/types';

const MAX_ACTIVITY_RENDER_CACHE_ENTRIES = 500;

type StringCache = Map<string, string>;

export function getCachedString(cache: StringCache, key: string, buildValue: () => string): string {
  const cached = cache.get(key);
  if (cached !== undefined || cache.has(key)) return cached ?? '';

  const value = buildValue();
  if (cache.size >= MAX_ACTIVITY_RENDER_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
  return value;
}

export function encodeCacheParts(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join('|');
}

export function taskRefsCacheSignature(taskRefs?: readonly TaskRef[]): string {
  if (!taskRefs || taskRefs.length === 0) return '';
  return encodeCacheParts(
    taskRefs.flatMap((ref) => [ref.taskId, ref.displayId, ref.teamName ?? ''])
  );
}

export function stringArrayCacheSignature(values?: readonly string[]): string {
  if (!values || values.length === 0) return '';
  return encodeCacheParts(values);
}

export function stringMapCacheSignature(map?: ReadonlyMap<string, string>): string {
  if (!map || map.size === 0) return '';
  const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  return encodeCacheParts(entries.flatMap(([key, value]) => [key, value]));
}

const markdownPlainTextCache: StringCache = new Map();

export function extractMarkdownPlainTextCached(markdown: string): string {
  if (!markdown) return '';
  return getCachedString(markdownPlainTextCache, markdown, () =>
    extractMarkdownPlainText(markdown)
  );
}
