import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {
  filterPricingModels,
  isRelevantPricingModel,
  PricingRefreshService,
} from '@main/services/infrastructure/PricingRefreshService';
import { applyPricingOverrides, getPricing } from '@shared/utils/pricing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VALID_ENTRY = {
  input_cost_per_token: 0.000005,
  output_cost_per_token: 0.000025,
};

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(payload),
    })
  ) as unknown as typeof fetch;
}

describe('PricingRefreshService', () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pricing-refresh-'));
  });

  afterEach(async () => {
    applyPricingOverrides(null);
    await fsp.rm(cacheDir, { recursive: true, force: true });
  });

  describe('isRelevantPricingModel', () => {
    it('keeps claude, codex, gpt and gemini families', () => {
      expect(isRelevantPricingModel('claude-sonnet-5')).toBe(true);
      expect(isRelevantPricingModel('anthropic/claude-opus-4-8')).toBe(true);
      expect(isRelevantPricingModel('gpt-5.3-codex')).toBe(true);
      expect(isRelevantPricingModel('gpt-6')).toBe(true);
      expect(isRelevantPricingModel('gemini-3.0-pro')).toBe(true);
    });

    it('drops unrelated providers', () => {
      expect(isRelevantPricingModel('mistral-large')).toBe(false);
      expect(isRelevantPricingModel('command-r-plus')).toBe(false);
    });
  });

  describe('filterPricingModels', () => {
    it('drops irrelevant models and entries without numeric costs', () => {
      const filtered = filterPricingModels({
        'claude-new-model': VALID_ENTRY,
        'mistral-large': VALID_ENTRY,
        'claude-broken': { input_cost_per_token: 'oops' },
        sample_spec: { notes: 'metadata entry' },
      });
      expect(Object.keys(filtered)).toEqual(['claude-new-model']);
    });
  });

  describe('initialize', () => {
    it('fetches, persists and applies pricing when no cache exists', async () => {
      const service = new PricingRefreshService({
        cacheDir,
        fetchImpl: fakeFetch({ 'claude-brand-new': VALID_ENTRY, 'mistral-large': VALID_ENTRY }),
      });
      const updated = vi.fn();
      service.onUpdated(updated);

      await service.initialize();
      await service.refresh();

      expect(service.getRuntimeOverrides()).toEqual({ 'claude-brand-new': VALID_ENTRY });
      expect(getPricing('claude-brand-new')).not.toBeNull();
      expect(updated).toHaveBeenCalledWith({ 'claude-brand-new': VALID_ENTRY });

      const cacheRaw = await fsp.readFile(path.join(cacheDir, 'pricing-runtime.json'), 'utf-8');
      const cache = JSON.parse(cacheRaw);
      expect(cache.models).toEqual({ 'claude-brand-new': VALID_ENTRY });
      expect(typeof cache.fetchedAt).toBe('number');
    });

    it('applies a fresh cache without fetching', async () => {
      const fetchImpl = fakeFetch({});
      await fsp.writeFile(
        path.join(cacheDir, 'pricing-runtime.json'),
        JSON.stringify({
          fetchedAt: 1_000_000,
          source: 'test',
          models: { 'claude-cached-model': VALID_ENTRY },
        }),
        'utf-8'
      );

      const service = new PricingRefreshService({
        cacheDir,
        fetchImpl,
        now: () => 1_000_000 + 60_000, // one minute later, well within TTL
      });
      await service.initialize();

      expect(service.getRuntimeOverrides()).toEqual({ 'claude-cached-model': VALID_ENTRY });
      expect(getPricing('claude-cached-model')).not.toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refreshes in the background when the cache is stale', async () => {
      const fetchImpl = fakeFetch({ 'claude-refreshed-model': VALID_ENTRY });
      await fsp.writeFile(
        path.join(cacheDir, 'pricing-runtime.json'),
        JSON.stringify({
          fetchedAt: 0,
          source: 'test',
          models: { 'claude-cached-model': VALID_ENTRY },
        }),
        'utf-8'
      );

      const service = new PricingRefreshService({
        cacheDir,
        fetchImpl,
        now: () => 48 * 60 * 60 * 1000, // two days later
      });
      await service.initialize();
      // Cached data applies immediately; wait for the background refresh.
      expect(getPricing('claude-cached-model')).not.toBeNull();
      await service.refresh();

      expect(service.getRuntimeOverrides()).toEqual({ 'claude-refreshed-model': VALID_ENTRY });
      expect(fetchImpl).toHaveBeenCalled();
    });
  });

  describe('refresh failure handling', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('keeps existing overrides when the fetch fails', async () => {
      const service = new PricingRefreshService({
        cacheDir,
        fetchImpl: fakeFetch(null, false),
      });

      const result = await service.refresh();

      expect(result).toBe(false);
      expect(service.getRuntimeOverrides()).toBeNull();
      expect(getPricing('claude-4-sonnet-20250514')).not.toBeNull(); // bundled fallback intact
    });

    it('rejects responses without any usable entries', async () => {
      const service = new PricingRefreshService({
        cacheDir,
        fetchImpl: fakeFetch({ 'mistral-large': VALID_ENTRY }),
      });

      const result = await service.refresh();

      expect(result).toBe(false);
      expect(service.getRuntimeOverrides()).toBeNull();
    });
  });
});
