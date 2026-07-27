import {
  DEFAULT_PROVIDER_MODEL_SELECTION,
  isDefaultProviderModelSelection,
} from '@shared/utils/providerModelSelection';
import { describe, expect, it } from 'vitest';

describe('providerModelSelection', () => {
  it('treats persisted default sentinels as provider-default selection', () => {
    expect(isDefaultProviderModelSelection(DEFAULT_PROVIDER_MODEL_SELECTION)).toBe(true);
    expect(isDefaultProviderModelSelection('default')).toBe(true);
    expect(isDefaultProviderModelSelection('Default')).toBe(true);
    expect(isDefaultProviderModelSelection('__default__')).toBe(true);
    expect(isDefaultProviderModelSelection(' gpt-5.5 ')).toBe(false);
    expect(isDefaultProviderModelSelection('')).toBe(false);
    expect(isDefaultProviderModelSelection(undefined)).toBe(false);
  });
});
