/**
 * Compact API-key entry for create-team / model-selector flows.
 * Reuses ApiKeyService + providerConnections config — same backend as settings.
 */

import React, { useEffect, useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { useStore } from '@renderer/store';
import { KeyRound, Loader2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import type { TeamProviderId } from '@shared/types';
import type { ApiKeyEntry } from '@shared/types/extensions';

type ApiKeyProviderId = 'anthropic' | 'codex';

const API_KEY_PROVIDER_CONFIG: Record<
  ApiKeyProviderId,
  {
    envVarName: 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY';
    name: string;
  }
> = {
  anthropic: {
    envVarName: 'ANTHROPIC_API_KEY',
    name: 'Anthropic API Key',
  },
  codex: {
    envVarName: 'OPENAI_API_KEY',
    name: 'Codex API Key',
  },
};

function isApiKeyProviderId(providerId: TeamProviderId): providerId is ApiKeyProviderId {
  return providerId === 'anthropic' || providerId === 'codex';
}

function findPreferredApiKeyEntry(apiKeys: ApiKeyEntry[], envVarName: string): ApiKeyEntry | null {
  const matches = apiKeys.filter((entry) => entry.envVarName === envVarName);
  return matches.find((entry) => entry.scope === 'user') ?? matches[0] ?? null;
}

interface InlineProviderApiKeyPanelProps {
  providerId: TeamProviderId;
  onSaved?: (providerId: ApiKeyProviderId) => void;
  onOpenFullSettings?: (providerId: TeamProviderId) => void;
}

export const InlineProviderApiKeyPanel = ({
  providerId,
  onSaved,
  onOpenFullSettings,
}: Readonly<InlineProviderApiKeyPanelProps>): React.JSX.Element | null => {
  const { t } = useAppTranslation('settings');
  const { t: teamT } = useAppTranslation('team');
  const { apiKeys, apiKeysLoading, apiKeySaving, fetchApiKeys, saveApiKey, updateConfig } =
    useStore(
      useShallow((state) => ({
        apiKeys: state.apiKeys,
        apiKeysLoading: state.apiKeysLoading,
        apiKeySaving: state.apiKeySaving,
        fetchApiKeys: state.fetchApiKeys,
        saveApiKey: state.saveApiKey,
        updateConfig: state.updateConfig,
      }))
    );

  const [expanded, setExpanded] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchApiKeys();
  }, [fetchApiKeys]);

  useEffect(() => {
    setExpanded(false);
    setApiKeyValue('');
    setError(null);
  }, [providerId]);

  const config = isApiKeyProviderId(providerId) ? API_KEY_PROVIDER_CONFIG[providerId] : null;
  const existingKey = useMemo(() => {
    if (!config) {
      return null;
    }
    return findPreferredApiKeyEntry(apiKeys, config.envVarName);
  }, [apiKeys, config]);

  if (!config || !isApiKeyProviderId(providerId)) {
    return null;
  }

  const translationKeys = {
    anthropic: {
      title: 'providerRuntime.apiKey.providers.anthropic.title',
      description: 'providerRuntime.apiKey.providers.anthropic.description',
      placeholder: 'providerRuntime.apiKey.providers.anthropic.placeholder',
    },
    codex: {
      title: 'providerRuntime.apiKey.providers.codex.title',
      description: 'providerRuntime.apiKey.providers.codex.description',
      placeholder: 'providerRuntime.apiKey.providers.codex.placeholder',
    },
  } as const;
  const keys = translationKeys[providerId];

  const handleSave = async (): Promise<void> => {
    if (!apiKeyValue.trim()) {
      setError(t('providerRuntime.errors.apiKeyRequired'));
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await saveApiKey({
        id: existingKey?.id,
        name: config.name,
        envVarName: config.envVarName,
        value: apiKeyValue.trim(),
        scope: 'user',
      });

      if (providerId === 'anthropic') {
        await updateConfig('providerConnections', {
          anthropic: { authMode: 'api_key' },
        });
      } else {
        await updateConfig('providerConnections', {
          codex: { preferredAuthMode: 'api_key' },
        });
      }

      setApiKeyValue('');
      setExpanded(false);
      onSaved?.(providerId);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : t('providerRuntime.errors.saveApiKey')
      );
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || apiKeySaving;

  return (
    <div
      data-testid="inline-provider-api-key-panel"
      className="mt-2 rounded-md border border-amber-300/35 bg-amber-300/5 px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="size-3.5 shrink-0 text-amber-200" />
        <p className="text-[11px] font-medium text-amber-100">
          {teamT('modelSelector.inlineApiKey.title')}
        </p>
        {existingKey ? (
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-200">
            {t('providerRuntime.apiKey.storedInApp')} · {existingKey.maskedValue}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-100/80">
        {teamT('modelSelector.inlineApiKey.hint')}
      </p>

      {!expanded ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-amber-300/45 bg-amber-300/15 px-2.5 text-[11px] text-amber-100 hover:bg-amber-300/25"
            onClick={() => setExpanded(true)}
            data-testid="inline-provider-api-key-expand"
          >
            {existingKey
              ? teamT('modelSelector.inlineApiKey.update')
              : teamT('modelSelector.inlineApiKey.add')}
          </Button>
          {onOpenFullSettings ? (
            <button
              type="button"
              className="text-[11px] text-amber-100/80 underline decoration-dotted underline-offset-2 hover:text-amber-50"
              onClick={() => onOpenFullSettings(providerId)}
            >
              {teamT('modelSelector.inlineApiKey.openFullSettings')}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`inline-api-key-${providerId}`} className="text-[11px] text-amber-100">
              {t(keys.title)}
            </Label>
            <Input
              id={`inline-api-key-${providerId}`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKeyValue}
              disabled={busy || apiKeysLoading}
              placeholder={t(keys.placeholder)}
              onChange={(event) => setApiKeyValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSave();
                }
              }}
              className="h-8 border-amber-300/30 bg-[var(--color-surface)] text-xs"
              data-testid="inline-provider-api-key-input"
            />
            <p className="text-[10px] leading-relaxed text-amber-100/70">{t(keys.description)}</p>
          </div>
          {error ? (
            <p className="text-[11px] text-red-200" data-testid="inline-provider-api-key-error">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              disabled={busy || !apiKeyValue.trim()}
              onClick={() => void handleSave()}
              data-testid="inline-provider-api-key-save"
            >
              {busy ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
              {t('providerRuntime.actions.saveKey')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-[11px] text-amber-100/80"
              disabled={busy}
              onClick={() => {
                setExpanded(false);
                setApiKeyValue('');
                setError(null);
              }}
            >
              {t('providerRuntime.actions.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
