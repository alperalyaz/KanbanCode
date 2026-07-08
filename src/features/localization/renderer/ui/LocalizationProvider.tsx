import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';

import { normalizeAppLocalePreference, resolveAppLocale } from '../../core/domain/localePolicy';
import { appI18n } from '../composition/createI18nextInstance';
import { persistStartupLocaleCaches } from '@shared/i18n/startupMessages';

import type { AppConfig } from '@shared/types';

interface LocalizationProviderProps {
  readonly appConfig: AppConfig | null;
  readonly children: React.ReactNode;
}

export const LocalizationProvider = ({
  appConfig,
  children,
}: LocalizationProviderProps): React.JSX.Element => {
  // App UI locale follows the user's preference (Settings → Language).
  // 'system' resolves via the OS/browser locale; any string not yet translated
  // falls back to English.
  const localePreference = normalizeAppLocalePreference(appConfig?.general?.appLocale);
  const resolvedLocale = resolveAppLocale({
    preference: localePreference,
    systemLocale: navigator.language,
  });

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
