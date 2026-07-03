/**
 * PricingRefreshService - Runtime model pricing refresh.
 *
 * The app ships a bundled `resources/pricing.json` snapshot (fetched at build
 * time from LiteLLM). New models released after a build would show $0 cost, so
 * this service refreshes pricing at runtime:
 *
 * - On startup: load the cached copy from userData (if any) and apply it.
 * - If the cache is missing or older than the TTL: fetch the public LiteLLM
 *   pricing JSON in the background, filter it to relevant model families,
 *   persist it atomically, apply it, and notify subscribers (renderer IPC).
 * - Offline / fetch failure: silently keep bundled + cached data.
 *
 * The LiteLLM source is public and requires no authentication or API key.
 */

import { createLogger } from '@shared/utils/logger';
import { applyPricingOverrides } from '@shared/utils/pricing';
import * as fsp from 'fs/promises';
import * as path from 'path';

const logger = createLogger('Service:PricingRefresh');

const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const CACHE_FILE_NAME = 'pricing-runtime.json';
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000; // daily
const FETCH_TIMEOUT_MS = 10_000;

interface PricingCacheFile {
  fetchedAt: number;
  source: string;
  models: Record<string, unknown>;
}

export interface PricingRefreshOptions {
  cacheDir: string;
  fetchImpl?: typeof fetch;
  ttlMs?: number;
  now?: () => number;
}

/** Model families the app can expose; keeps the cached file small. */
export function isRelevantPricingModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return (
    lower.includes('claude') ||
    lower.includes('codex') ||
    lower.startsWith('gpt-') ||
    lower.startsWith('gemini-')
  );
}

function isValidPricingEntry(entry: unknown): boolean {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as Record<string, unknown>).input_cost_per_token === 'number' &&
    typeof (entry as Record<string, unknown>).output_cost_per_token === 'number'
  );
}

export function filterPricingModels(data: Record<string, unknown>): Record<string, unknown> {
  const selected: Record<string, unknown> = {};
  for (const [modelName, entry] of Object.entries(data)) {
    if (isRelevantPricingModel(modelName) && isValidPricingEntry(entry)) {
      selected[modelName] = entry;
    }
  }
  return selected;
}

export class PricingRefreshService {
  private readonly cacheFilePath: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private overrides: Record<string, unknown> | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private readonly updateListeners = new Set<(models: Record<string, unknown>) => void>();

  constructor(options: PricingRefreshOptions) {
    this.cacheFilePath = path.join(options.cacheDir, CACHE_FILE_NAME);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.ttlMs = options.ttlMs ?? REFRESH_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  getRuntimeOverrides(): Record<string, unknown> | null {
    return this.overrides;
  }

  onUpdated(listener: (models: Record<string, unknown>) => void): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  /**
   * Loads the cached pricing snapshot (if valid) and kicks off a background
   * refresh when the cache is stale. Never throws.
   */
  async initialize(): Promise<void> {
    const cache = await this.readCache();
    if (cache) {
      this.applyModels(cache.models, false);
    }
    const cacheAge = cache ? this.now() - cache.fetchedAt : Number.POSITIVE_INFINITY;
    if (cacheAge >= this.ttlMs) {
      // Fire-and-forget: startup must not wait on the network.
      void this.refresh();
    }
  }

  /** Fetches fresh pricing, persists and applies it. Returns true on success. */
  async refresh(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(LITELLM_PRICING_URL, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const raw = (await response.json()) as Record<string, unknown>;
      const models = filterPricingModels(raw);
      if (Object.keys(models).length === 0) {
        throw new Error('No usable pricing entries in response');
      }
      await this.writeCache({
        fetchedAt: this.now(),
        source: LITELLM_PRICING_URL,
        models,
      });
      this.applyModels(models, true);
      logger.info(`Runtime pricing refreshed: ${Object.keys(models).length} models`);
      return true;
    } catch (error) {
      // Offline or blocked network is normal — bundled/cached pricing stays in effect.
      logger.warn(`Runtime pricing refresh skipped: ${String(error)}`);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private applyModels(models: Record<string, unknown>, notify: boolean): void {
    this.overrides = models;
    applyPricingOverrides(models);
    if (notify) {
      for (const listener of this.updateListeners) {
        try {
          listener(models);
        } catch (error) {
          logger.warn(`Pricing update listener failed: ${String(error)}`);
        }
      }
    }
  }

  private async readCache(): Promise<PricingCacheFile | null> {
    try {
      const raw = await fsp.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PricingCacheFile>;
      if (
        typeof parsed.fetchedAt !== 'number' ||
        !parsed.models ||
        typeof parsed.models !== 'object' ||
        Object.keys(parsed.models).length === 0
      ) {
        return null;
      }
      return {
        fetchedAt: parsed.fetchedAt,
        source: typeof parsed.source === 'string' ? parsed.source : LITELLM_PRICING_URL,
        models: parsed.models,
      };
    } catch {
      return null;
    }
  }

  private async writeCache(cache: PricingCacheFile): Promise<void> {
    const tmpPath = `${this.cacheFilePath}.tmp`;
    await fsp.mkdir(path.dirname(this.cacheFilePath), { recursive: true });
    await fsp.writeFile(tmpPath, JSON.stringify(cache), 'utf-8');
    await fsp.rename(tmpPath, this.cacheFilePath);
  }
}
