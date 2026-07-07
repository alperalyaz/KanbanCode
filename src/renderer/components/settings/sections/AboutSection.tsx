/**
 * AboutSection - App identity, version, and distribution notes.
 */

import { useEffect, useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { api, isElectronMode } from '@renderer/api';
import appIcon from '@renderer/favicon.png';
import {
  APP_NAME,
  CONTACT_EMAIL,
  PROJECT_LEAD,
  WEBSITE_LABEL,
  WEBSITE_URL,
} from '@shared/constants/brand';

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

          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            <dt className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {t('about.projectLeadLabel')}
            </dt>
            <dd style={{ color: 'var(--color-text-muted)' }}>{PROJECT_LEAD}</dd>

            <dt className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {t('about.websiteLabel')}
            </dt>
            <dd>
              <a
                href={WEBSITE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-sky-700 hover:underline dark:text-sky-400"
              >
                {WEBSITE_LABEL}
              </a>
            </dd>

            <dt className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {t('about.contactLabel')}
            </dt>
            <dd>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-sky-700 hover:underline dark:text-sky-400"
              >
                {CONTACT_EMAIL}
              </a>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
};
