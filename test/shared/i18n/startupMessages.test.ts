import { APP_NAME } from '@shared/constants/brand';
import {
  getInitialSplashMessage,
  localizeStartupMessage,
  localizeStartupTimelineDurationLabel,
  resolveStartupLocale,
  STARTUP_INITIAL_MESSAGE_EN,
} from '@shared/i18n/startupMessages';
import { describe, expect, it } from 'vitest';

describe('startupMessages', () => {
  it('resolves Turkish from cached locale', () => {
    expect(resolveStartupLocale({ cachedLocale: 'tr' })).toBe('tr');
  });

  it('resolves Turkish from cached app locale preference', () => {
    expect(resolveStartupLocale({ cachedPreference: 'tr' })).toBe('tr');
  });

  it('resolves Turkish from system locale when preference is system', () => {
    expect(resolveStartupLocale({ preference: 'system', systemLocale: 'tr-TR' })).toBe('tr');
  });

  it('localizes the initial splash message in Turkish', () => {
    expect(getInitialSplashMessage('tr')).toBe('Çalışma alanı hazırlanıyor...');
    expect(getInitialSplashMessage('en')).toBe(STARTUP_INITIAL_MESSAGE_EN);
  });

  it('localizes static startup messages', () => {
    expect(localizeStartupMessage('Opening window...', 'tr')).toBe('Pencere açılıyor...');
    expect(localizeStartupMessage(`Starting ${APP_NAME}...`, 'tr')).toBe(`${APP_NAME} başlatılıyor...`);
  });

  it('localizes dynamic runtime mode messages', () => {
    expect(localizeStartupMessage('Using agent_teams_orchestrator runtime mode...', 'tr')).toBe(
      'agent_teams_orchestrator çalışma zamanı modu kullanılıyor...'
    );
  });

  it('localizes startup failure messages', () => {
    expect(localizeStartupMessage('Startup failed: disk full', 'tr')).toBe(
      'Başlatma başarısız: disk full'
    );
  });

  it('localizes timeline duration labels', () => {
    expect(localizeStartupTimelineDurationLabel(true, '3s', 'tr')).toBe('3s sürdü');
    expect(localizeStartupTimelineDurationLabel(false, '12s', 'tr')).toBe('12s çalışıyor');
  });
});
