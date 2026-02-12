/**
 * GeneralSection - General settings including startup, appearance, and browser access.
 */

import { useCallback, useEffect, useState } from 'react';

import { api } from '@renderer/api';
import { Check, Copy, Loader2 } from 'lucide-react';

import { SettingRow, SettingsSectionHeader, SettingsSelect, SettingsToggle } from '../components';

import type { SafeConfig } from '../hooks/useSettingsConfig';
import type { HttpServerStatus } from '@shared/types/api';

// Theme options
const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

interface GeneralSectionProps {
  readonly safeConfig: SafeConfig;
  readonly saving: boolean;
  readonly onGeneralToggle: (key: 'launchAtLogin' | 'showDockIcon', value: boolean) => void;
  readonly onThemeChange: (value: 'dark' | 'light' | 'system') => void;
}

export const GeneralSection = ({
  safeConfig,
  saving,
  onGeneralToggle,
  onThemeChange,
}: GeneralSectionProps): React.JSX.Element => {
  const [serverStatus, setServerStatus] = useState<HttpServerStatus>({
    running: false,
    port: 3456,
  });
  const [serverLoading, setServerLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch server status on mount
  useEffect(() => {
    void api.httpServer.getStatus().then(setServerStatus);
  }, []);

  const handleServerToggle = useCallback(async (enabled: boolean) => {
    setServerLoading(true);
    try {
      const status = enabled ? await api.httpServer.start() : await api.httpServer.stop();
      setServerStatus(status);
    } catch {
      // Status didn't change
    } finally {
      setServerLoading(false);
    }
  }, []);

  const serverUrl = `http://localhost:${serverStatus.port}`;

  const handleCopyUrl = useCallback(() => {
    void navigator.clipboard.writeText(serverUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [serverUrl]);

  return (
    <div>
      <SettingsSectionHeader title="Startup" />
      <SettingRow label="Launch at login" description="Automatically start the app when you log in">
        <SettingsToggle
          enabled={safeConfig.general.launchAtLogin}
          onChange={(v) => onGeneralToggle('launchAtLogin', v)}
          disabled={saving}
        />
      </SettingRow>
      {window.navigator.userAgent.includes('Macintosh') && (
        <SettingRow label="Show dock icon" description="Display the app icon in the dock (macOS)">
          <SettingsToggle
            enabled={safeConfig.general.showDockIcon}
            onChange={(v) => onGeneralToggle('showDockIcon', v)}
            disabled={saving}
          />
        </SettingRow>
      )}

      <SettingsSectionHeader title="Appearance" />
      <SettingRow label="Theme" description="Choose your preferred color theme">
        <SettingsSelect
          value={safeConfig.general.theme}
          options={THEME_OPTIONS}
          onChange={onThemeChange}
          disabled={saving}
        />
      </SettingRow>

      <SettingsSectionHeader title="Browser Access" />
      <SettingRow
        label="Enable server mode"
        description="Start an HTTP server to access the UI from a browser or embed in iframes"
      >
        {serverLoading ? (
          <Loader2 className="size-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        ) : (
          <SettingsToggle
            enabled={serverStatus.running}
            onChange={handleServerToggle}
            disabled={saving}
          />
        )}
      </SettingRow>

      {serverStatus.running && (
        <div
          className="mb-2 flex items-center gap-3 rounded-md px-3 py-2.5"
          style={{ backgroundColor: 'var(--color-surface-raised)' }}
        >
          <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: '#22c55e' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Running on
          </span>
          <code
            className="rounded px-1.5 py-0.5 font-mono text-xs"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            {serverUrl}
          </code>
          <button
            onClick={handleCopyUrl}
            className="ml-auto flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/5"
            style={{
              borderColor: 'var(--color-border)',
              color: copied ? '#22c55e' : 'var(--color-text-secondary)',
            }}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy URL'}
          </button>
        </div>
      )}
    </div>
  );
};
