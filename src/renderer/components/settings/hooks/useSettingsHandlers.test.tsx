import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@renderer/api', () => ({
  api: {
    config: {},
  },
}));

vi.mock('@renderer/store', () => ({
  useStore: {
    setState: vi.fn(),
  },
}));

import { useSettingsHandlers } from './useSettingsHandlers';

import type { AppConfig } from '@renderer/types/data';

function createSettingsConfig(): AppConfig {
  return {
    general: {
      theme: 'system',
      language: 'en',
      appLocale: 'en',
      defaultTab: 'dashboard',
    },
    notifications: {
      enabled: true,
      soundEnabled: true,
      includeSubagentErrors: false,
      snoozedUntil: null,
      snoozeMinutes: 30,
      notifyOnLeadInbox: true,
      notifyOnUserInbox: true,
      notifyOnClarifications: true,
      notifyOnStatusChange: true,
      notifyOnTaskComments: true,
      notifyOnTaskCreated: true,
      notifyOnAllTasksCompleted: true,
      notifyOnCrossTeamMessage: true,
      notifyOnTeamLaunched: true,
      notifyOnToolApproval: false,
      statusChangeStatuses: ['review'],
      statusChangeOnlySolo: false,
      ignoredRepositories: [],
    },
    display: {
      showGraph: true,
      showTerminal: true,
      showTeamMembers: true,
    },
    runtime: {
      provider: 'codex',
    },
    sessions: {
      retentionDays: 30,
    },
  } as AppConfig;
}

describe('useSettingsHandlers critical-only preset', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('applies the critical-only notification preset payload', async () => {
    const updateConfig = vi.fn().mockResolvedValue(undefined);
    const onReady = vi.fn();

    const Probe = (): React.JSX.Element | null => {
      const handlers = useSettingsHandlers({
        config: createSettingsConfig(),
        setSaving: vi.fn(),
        setError: vi.fn(),
        setConfig: vi.fn(),
        setOptimisticConfig: vi.fn(),
        updateConfig,
      });

      useEffect(() => {
        onReady(handlers);
      }, [handlers]);

      return null;
    };

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<Probe />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const handlers = onReady.mock.calls[onReady.mock.calls.length - 1]?.[0] as ReturnType<
      typeof useSettingsHandlers
    >;
    expect(handlers).toBeDefined();

    await act(async () => {
      await handlers.handleApplyCriticalOnlyNotificationsPreset();
    });

    expect(updateConfig).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        notifyOnLeadInbox: false,
        notifyOnUserInbox: true,
        notifyOnClarifications: true,
        notifyOnStatusChange: false,
        notifyOnTaskComments: false,
        notifyOnTaskCreated: false,
        notifyOnAllTasksCompleted: false,
        notifyOnCrossTeamMessage: false,
        notifyOnTeamLaunched: false,
        notifyOnToolApproval: true,
      })
    );

    act(() => {
      root.unmount();
    });
  });
});
