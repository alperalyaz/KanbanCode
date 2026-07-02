import {
  extractPrimaryLocaleSubtag,
  normalizeAppLocalePreference,
  resolveAppLocale,
} from '@features/localization/core/domain/localePolicy';
import { describe, expect, it } from 'vitest';

describe('localePolicy', () => {
  it('keeps only en and tr preferences and normalizes everything else to system', () => {
    expect(normalizeAppLocalePreference('en')).toBe('en');
    expect(normalizeAppLocalePreference('tr')).toBe('tr');
    expect(normalizeAppLocalePreference('system')).toBe('system');

    expect(normalizeAppLocalePreference('sv')).toBe('system');
    expect(normalizeAppLocalePreference(null)).toBe('system');
    for (const removed of [
      'ru',
      'zh',
      'ja',
      'ko',
      'es',
      'hi',
      'pt',
      'fr',
      'ar',
      'bn',
      'ur',
      'id',
      'de',
      'it',
      'vi',
      'pl',
      'fa',
      'th',
      'uk',
      'nl',
      'ta',
      'te',
      'mr',
      'fil',
      'ms',
      'sw',
      'ro',
    ]) {
      expect(normalizeAppLocalePreference(removed)).toBe('system');
    }
  });

  it('extracts the primary locale subtag', () => {
    expect(extractPrimaryLocaleSubtag('en-US')).toBe('en');
    expect(extractPrimaryLocaleSubtag('EN_us')).toBe('en');
    expect(extractPrimaryLocaleSubtag('')).toBeNull();
  });

  it('resolves system locale to a supported primary locale (en or tr only)', () => {
    expect(resolveAppLocale({ preference: 'system', systemLocale: 'en-US' })).toBe('en');
    expect(resolveAppLocale({ preference: 'system', systemLocale: 'tr-TR' })).toBe('tr');
  });

  it('falls back to en when the system locale is no longer supported', () => {
    expect(resolveAppLocale({ preference: 'system', systemLocale: 'sv-SE' })).toBe('en');
    for (const removedSystemLocale of [
      'ru-RU',
      'zh-CN',
      'ja-JP',
      'ko-KR',
      'es-ES',
      'hi-IN',
      'pt-BR',
      'fr-FR',
      'ar-SA',
      'bn-BD',
      'ur-PK',
      'id-ID',
      'de-DE',
      'it-IT',
      'vi-VN',
      'pl-PL',
      'fa-IR',
      'th-TH',
      'uk-UA',
      'nl-NL',
      'ta-IN',
      'te-IN',
      'mr-IN',
      'fil-PH',
      'ms-MY',
      'sw-KE',
      'ro-RO',
    ]) {
      expect(resolveAppLocale({ preference: 'system', systemLocale: removedSystemLocale })).toBe(
        'en'
      );
    }
  });
});
