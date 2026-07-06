import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';

import { FALLBACK_APP_LOCALE } from '../../contracts';
import { appI18n } from '../composition/createI18nextInstance';
import { persistStartupLocaleCaches } from '@shared/i18n/startupMessages';

import type { AppConfig } from '@shared/types';

interface LocalizationProviderProps {
  readonly appConfig: AppConfig | null;
  readonly children: React.ReactNode;
}

export const LocalizationProvider = ({
  appConfig: _appConfig,
  children,
}: LocalizationProviderProps): React.JSX.Element => {
  // TEMPORARY: the app UI is locked to English while the i18n coverage is
  // incomplete (many strings are still hardcoded English). The i18n scaffolding
  // (t() calls, locale files) stays in place so Turkish (and future languages)
  // can be re-activated later by restoring OS/preference-based resolution here.
  const resolvedLocale = FALLBACK_APP_LOCALE;
  const localePreference = FALLBACK_APP_LOCALE;

  useEffect(() => {
    if (appI18n.language !== resolvedLocale) {
      void appI18n.changeLanguage(resolvedLocale);
    }
  }, [resolvedLocale]);

  useEffect(() => {
    document.documentElement.lang = resolvedLocale;
    persistStartupLocaleCaches(localePreference, resolvedLocale);
  }, [localePreference, resolvedLocale]);

  return <I18nextProvider i18n={appI18n}>{children}</I18nextProvider>;
};
