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
  let signature = '';
  for (const part of parts) {
    signature = appendEncodedCachePart(signature, part);
  }
  return signature;
}

export function taskRefsCacheSignature(taskRefs?: readonly TaskRef[]): string {
  if (!taskRefs || taskRefs.length === 0) return '';
  let signature = '';
  for (const ref of taskRefs) {
    signature = appendEncodedCachePart(signature, ref.taskId);
    signature = appendEncodedCachePart(signature, ref.displayId);
    signature = appendEncodedCachePart(signature, ref.teamName ?? '');
  }
  return signature;
}

export function stringArrayCacheSignature(values?: readonly string[]): string {
  if (!values || values.length === 0) return '';
  return encodeCacheParts(values);
}

export function stringMapCacheSignature(map?: ReadonlyMap<string, string>): string {
  if (!map || map.size === 0) return '';
  const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  let signature = '';
  for (const [key, value] of entries) {
    signature = appendEncodedCachePart(signature, key);
    signature = appendEncodedCachePart(signature, value);
  }
  return signature;
}

function appendEncodedCachePart(signature: string, part: string): string {
  const encodedPart = `${part.length}:${part}`;
  return signature ? `${signature}|${encodedPart}` : encodedPart;
}

const markdownPlainTextCache: StringCache = new Map();

export function extractMarkdownPlainTextCached(markdown: string): string {
  if (!markdown) return '';
  return getCachedString(markdownPlainTextCache, markdown, () =>
    extractMarkdownPlainText(markdown)
  );
}
