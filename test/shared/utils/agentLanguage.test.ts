import {
  normalizeAgentLanguagePreference,
  resolveLanguageName,
} from '@shared/utils/agentLanguage';
import { describe, expect, it } from 'vitest';

describe('agentLanguage', () => {
  it('normalizes unsupported legacy language codes to system', () => {
    expect(normalizeAgentLanguagePreference('de')).toBe('system');
    expect(normalizeAgentLanguagePreference('fr')).toBe('system');
    expect(normalizeAgentLanguagePreference('en')).toBe('en');
    expect(normalizeAgentLanguagePreference('tr')).toBe('tr');
  });

  it('resolves supported agent languages', () => {
    expect(resolveLanguageName('en')).toBe('English');
    expect(resolveLanguageName('tr')).toBe('Turkish');
    expect(resolveLanguageName('system', 'tr-TR')).toBe('Turkish');
    expect(resolveLanguageName('system', 'en-US')).toBe('English');
    expect(resolveLanguageName('de', 'de-DE')).toBe('English');
  });
});
