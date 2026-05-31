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
  const encodedParts: string[] = [];
  for (const part of parts) {
    pushEncodedCachePart(encodedParts, part);
  }
  return encodedParts.join('|');
}

export function taskRefsCacheSignature(taskRefs?: readonly TaskRef[]): string {
  if (!taskRefs || taskRefs.length === 0) return '';
  const encodedParts: string[] = [];
  for (const ref of taskRefs) {
    pushEncodedCachePart(encodedParts, ref.taskId);
    pushEncodedCachePart(encodedParts, ref.displayId);
    pushEncodedCachePart(encodedParts, ref.teamName ?? '');
  }
  return encodedParts.join('|');
}

export function stringArrayCacheSignature(values?: readonly string[]): string {
  if (!values || values.length === 0) return '';
  return encodeCacheParts(values);
}

export function stringMapCacheSignature(map?: ReadonlyMap<string, string>): string {
  if (!map || map.size === 0) return '';
  const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  const encodedParts: string[] = [];
  for (const [key, value] of entries) {
    pushEncodedCachePart(encodedParts, key);
    pushEncodedCachePart(encodedParts, value);
  }
  return encodedParts.join('|');
}

function pushEncodedCachePart(encodedParts: string[], part: string): void {
  encodedParts.push(`${part.length}:${part}`);
}

const markdownPlainTextCache: StringCache = new Map();

export function extractMarkdownPlainTextCached(markdown: string): string {
  if (!markdown) return '';
  return getCachedString(markdownPlainTextCache, markdown, () =>
    extractMarkdownPlainText(markdown)
  );
}
