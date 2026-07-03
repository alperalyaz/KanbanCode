/**
 * AdvancedSection - Advanced settings including config management.
 */

import { useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { isElectronMode } from '@renderer/api';
import { Code2, Download, FileEdit, RefreshCw, Upload } from 'lucide-react';

import { SettingsSectionHeader } from '../components';

import { CliStatusSection } from './CliStatusSection';
import { ConfigEditorDialog } from './ConfigEditorDialog';

interface AdvancedSectionProps {
  readonly saving: boolean;
  readonly onResetToDefaults: () => void;
  readonly onExportConfig: () => void;
  readonly onImportConfig: () => void;
  readonly onOpenInEditor: () => void;
}

export const AdvancedSection = ({
  saving,
  onResetToDefaults,
  onExportConfig,
  onImportConfig,
  onOpenInEditor,
}: AdvancedSectionProps): React.JSX.Element => {
  const { t } = useAppTranslation('settings');
  const isElectron = useMemo(() => isElectronMode(), []);
  const [configEditorOpen, setConfigEditorOpen] = useState(false);

  return (
    <div>
      <SettingsSectionHeader title={t('advanced.configuration.title')} />
      <div className="flex flex-wrap gap-2 py-2">
        <button
          onClick={() => setConfigEditorOpen(true)}
          className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all duration-150 hover:bg-white/5"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
          }}
        >
          <FileEdit className="size-4" />
          {t('advanced.configuration.editConfig')}
        </button>
        <button
          onClick={onResetToDefaults}
          disabled={saving}
          className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all duration-150 hover:bg-white/5 ${saving ? 'cursor-not-allowed opacity-50' : ''}`}
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <RefreshCw className="size-4" />
          {t('advanced.configuration.resetToDefaults')}
        </button>
        <button
          onClick={onExportConfig}
          disabled={saving}
          className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all duration-150 hover:bg-white/5 ${saving ? 'cursor-not-allowed opacity-50' : ''}`}
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Download className="size-4" />
          {t('advanced.configuration.exportConfig')}
        </button>
        <button
          onClick={onImportConfig}
          disabled={saving}
          className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all duration-150 hover:bg-white/5 ${saving ? 'cursor-not-allowed opacity-50' : ''}`}
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Upload className="size-4" />
          {t('advanced.configuration.importConfig')}
        </button>
        {isElectron && (
          <button
            onClick={onOpenInEditor}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all duration-150 hover:bg-white/5"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Code2 className="size-4" />
            {t('advanced.configuration.openInEditor')}
          </button>
        )}
      </div>

      <CliStatusSection />

      <ConfigEditorDialog
        open={configEditorOpen}
        onClose={() => setConfigEditorOpen(false)}
        onConfigSaved={() => {
          // Config saved via editor — settings page will pick up changes on next render
        }}
      />
    </div>
  );
};
