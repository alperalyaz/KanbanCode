/**
 * AboutSection - App identity, version, and distribution notes.
 */

import { useEffect, useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { api, isElectronMode } from '@renderer/api';
import appIcon from '@renderer/favicon.png';
import { APP_NAME } from '@shared/constants/brand';

import { SettingsSectionHeader } from '../components';

export const AboutSection = (): React.JSX.Element => {
  const { t } = useAppTranslation('settings');
  const isElectron = useMemo(() => isElectronMode(), []);
  const [version, setVersion] = useState('');

  useEffect(() => {
    void api.getAppVersion().then(setVersion).catch(console.error);
  }, []);

  return (
    <div>
      <SettingsSectionHeader title={t('about.title')} />
      <div className="flex items-start gap-4 py-3">
        <img src={appIcon} alt={t('about.appIconAlt')} className="size-10 rounded-lg" />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {APP_NAME}
            </p>
            {!isElectron && (
              <span
                className="rounded-md border px-2.5 py-1 text-xs font-medium"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {t('about.standalone')}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('about.version', { version: version || '...' })}
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t('about.description')}
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t('about.storeUpdates')}
          </p>
        </div>
      </div>
    </div>
  );
};
