import type { ProviderPrepareDiagnosticsModelResult } from './providerPrepareDiagnostics';
import type { TeamProviderId } from '@shared/types';

const OPENCODE_DEEP_VERIFY_SUCCESS_CACHE_TTL_MS = 45_000;
const OPENCODE_MODEL_ISSUE_CACHE_TTL_MS = 90_000;

interface ShortLivedProviderPrepareCacheEntry {
  expiresAt: number;
  modelResultsById: Record<string, ProviderPrepareDiagnosticsModelResult>;
}

const shortLivedProviderPrepareCache = new Map<string, ShortLivedProviderPrepareCacheEntry>();
const shortLivedProviderPrepareIssueCache = new Map<string, ShortLivedProviderPrepareCacheEntry>();

function pruneExpiredEntries(
  cache: Map<string, ShortLivedProviderPrepareCacheEntry>,
  now: number
): void {
  for (const [cacheKey, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(cacheKey);
    }
  }
}

function getIssueReason(result: ProviderPrepareDiagnosticsModelResult): string | null {
  const line = result.line.trim();
  if (!line) {
    return result.warningLine?.trim() || null;
  }

  // "GPT-5.4 - unavailable - auth failed" / "model - check failed - timed out"
  const blockingMatch = /\s-\s(?:unavailable|check failed)(?:\s-\s(.+))?$/i.exec(line);
  if (blockingMatch) {
    return blockingMatch[1]?.trim() || result.warningLine?.trim() || line;
  }

  // "deepseek-v4-pro - compatible, deep verification pending..." / "model - ping not confirmed"
  // Strip the model label so UI rows do not repeat "modelId - modelId - status".
  const advisoryMatch = /^.+?\s-\s(.+)$/.exec(line);
  if (advisoryMatch?.[1]?.trim()) {
    return advisoryMatch[1].trim().replace(/\.\.\.$/, '');
  }

  return result.warningLine?.trim() || line;
}

export function getShortLivedProviderPrepareModelResults({
  providerId,
  cacheKey,
}: {
  providerId: TeamProviderId;
  cacheKey: string;
}): Record<string, ProviderPrepareDiagnosticsModelResult> {
  if (providerId !== 'opencode') {
    return {};
  }

  const now = Date.now();
  pruneExpiredEntries(shortLivedProviderPrepareCache, now);
  const entry = shortLivedProviderPrepareCache.get(cacheKey);
  if (!entry) {
    return {};
  }

  return { ...entry.modelResultsById };
}

export function getShortLivedProviderPrepareModelIssueReasons({
  providerId,
  cacheKey,
}: {
  providerId: TeamProviderId;
  cacheKey: string;
}): {
  modelAdvisoryReasonByValue: Record<string, string>;
  modelIssueReasonByValue: Record<string, string>;
  modelUnavailableReasonByValue: Record<string, string>;
} {
  if (providerId !== 'opencode') {
    return {
      modelAdvisoryReasonByValue: {},
      modelIssueReasonByValue: {},
      modelUnavailableReasonByValue: {},
    };
  }

  const now = Date.now();
  pruneExpiredEntries(shortLivedProviderPrepareIssueCache, now);
  const entry = shortLivedProviderPrepareIssueCache.get(cacheKey);
  if (!entry) {
    return {
      modelAdvisoryReasonByValue: {},
      modelIssueReasonByValue: {},
      modelUnavailableReasonByValue: {},
    };
  }

  const modelAdvisoryReasonByValue: Record<string, string> = {};
  const modelIssueReasonByValue: Record<string, string> = {};
  const modelUnavailableReasonByValue: Record<string, string> = {};
  for (const [modelId, result] of Object.entries(entry.modelResultsById)) {
    const reason = getIssueReason(result);
    if (!reason) {
      continue;
    }
    if (result.status === 'failed') {
      modelUnavailableReasonByValue[modelId] = reason;
    } else if (result.status === 'notes') {
      modelAdvisoryReasonByValue[modelId] = reason;
    }
  }

  return {
    modelAdvisoryReasonByValue,
    modelIssueReasonByValue,
    modelUnavailableReasonByValue,
  };
}

export function storeShortLivedProviderPrepareModelResults({
  providerId,
  cacheKey,
  modelResultsById,
}: {
  providerId: TeamProviderId;
  cacheKey: string;
  modelResultsById: Record<string, ProviderPrepareDiagnosticsModelResult>;
}): void {
  if (providerId !== 'opencode') {
    return;
  }

  const issueResultsById = Object.fromEntries(
    Object.entries(modelResultsById).filter(([, result]) => result.status !== 'ready')
  );
  const readyResultsById = Object.fromEntries(
    Object.entries(modelResultsById).filter(([, result]) => result.status === 'ready')
  );

  const now = Date.now();
  pruneExpiredEntries(shortLivedProviderPrepareCache, now);
  pruneExpiredEntries(shortLivedProviderPrepareIssueCache, now);

  if (Object.keys(readyResultsById).length > 0) {
    const existingEntry = shortLivedProviderPrepareCache.get(cacheKey);
    shortLivedProviderPrepareCache.set(cacheKey, {
      expiresAt: now + OPENCODE_DEEP_VERIFY_SUCCESS_CACHE_TTL_MS,
      modelResultsById: {
        ...(existingEntry?.modelResultsById ?? {}),
        ...readyResultsById,
      },
    });
  }

  if (Object.keys(issueResultsById).length > 0) {
    const existingEntry = shortLivedProviderPrepareCache.get(cacheKey);
    if (existingEntry) {
      const nextReadyResultsById = { ...existingEntry.modelResultsById };
      for (const modelId of Object.keys(issueResultsById)) {
        delete nextReadyResultsById[modelId];
      }
      if (Object.keys(nextReadyResultsById).length > 0) {
        shortLivedProviderPrepareCache.set(cacheKey, {
          expiresAt: existingEntry.expiresAt,
          modelResultsById: nextReadyResultsById,
        });
      } else {
        shortLivedProviderPrepareCache.delete(cacheKey);
      }
    }

    const existingIssueEntry = shortLivedProviderPrepareIssueCache.get(cacheKey);
    const nextIssueResultsById = {
      ...(existingIssueEntry?.modelResultsById ?? {}),
      ...issueResultsById,
    };
    for (const modelId of Object.keys(readyResultsById)) {
      delete nextIssueResultsById[modelId];
    }
    shortLivedProviderPrepareIssueCache.set(cacheKey, {
      expiresAt: now + OPENCODE_MODEL_ISSUE_CACHE_TTL_MS,
      modelResultsById: nextIssueResultsById,
    });
  } else if (Object.keys(readyResultsById).length > 0) {
    const existingIssueEntry = shortLivedProviderPrepareIssueCache.get(cacheKey);
    if (!existingIssueEntry) {
      return;
    }
    const nextIssueResultsById = { ...existingIssueEntry.modelResultsById };
    for (const modelId of Object.keys(readyResultsById)) {
      delete nextIssueResultsById[modelId];
    }
    if (Object.keys(nextIssueResultsById).length > 0) {
      shortLivedProviderPrepareIssueCache.set(cacheKey, {
        expiresAt: existingIssueEntry.expiresAt,
        modelResultsById: nextIssueResultsById,
      });
    } else {
      shortLivedProviderPrepareIssueCache.delete(cacheKey);
    }
  }
}

export function __resetShortLivedProviderPrepareCacheForTests(): void {
  shortLivedProviderPrepareCache.clear();
  shortLivedProviderPrepareIssueCache.clear();
}
