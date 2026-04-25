import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimeProviderManagementPanelView } from '../../../../src/features/runtime-provider-management/renderer/ui/RuntimeProviderManagementPanelView';

import type {
  RuntimeProviderManagementActions,
  RuntimeProviderManagementState,
} from '../../../../src/features/runtime-provider-management/renderer/hooks/useRuntimeProviderManagement';

function createState(
  overrides: Partial<RuntimeProviderManagementState> = {}
): RuntimeProviderManagementState {
  return {
    view: {
      runtimeId: 'opencode',
      title: 'OpenCode',
      runtime: {
        state: 'ready',
        cliPath: '/usr/local/bin/opencode',
        version: '1.14.24',
        managedProfile: 'active',
        localAuth: 'synced',
      },
      providers: [
        {
          providerId: 'openrouter',
          displayName: 'OpenRouter',
          state: 'available',
          ownership: [],
          recommended: true,
          modelCount: 4,
          defaultModelId: null,
          authMethods: ['api'],
          actions: [
            {
              id: 'connect',
              label: 'Connect',
              enabled: true,
              disabledReason: null,
              requiresSecret: true,
              ownershipScope: 'managed',
            },
          ],
          detail: null,
        },
      ],
      defaultModel: null,
      fallbackModel: null,
      diagnostics: [],
    },
    providers: [],
    selectedProviderId: 'openrouter',
    activeFormProviderId: null,
    apiKeyValue: '',
    modelPickerProviderId: null,
    modelPickerMode: null,
    modelQuery: '',
    models: [],
    modelsLoading: false,
    modelsError: null,
    selectedModelId: null,
    testingModelId: null,
    savingDefaultModelId: null,
    modelResults: {},
    loading: false,
    savingProviderId: null,
    error: null,
    successMessage: null,
    ...overrides,
  };
}

function createActions(): RuntimeProviderManagementActions {
  return {
    refresh: vi.fn(() => Promise.resolve()),
    selectProvider: vi.fn(),
    startConnect: vi.fn(),
    cancelConnect: vi.fn(),
    setApiKeyValue: vi.fn(),
    submitConnect: vi.fn(() => Promise.resolve()),
    forgetProvider: vi.fn(() => Promise.resolve()),
    openModelPicker: vi.fn(),
    closeModelPicker: vi.fn(),
    setModelQuery: vi.fn(),
    selectModel: vi.fn(),
    useModelForNewTeams: vi.fn(),
    testModel: vi.fn(() => Promise.resolve()),
    setDefaultModel: vi.fn(() => Promise.resolve()),
  };
}

describe('RuntimeProviderManagementPanelView', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders provider actions and opens API-key form state without exposing a raw secret', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const actions = createActions();
    const state = createState();

    await act(async () => {
      root.render(
        React.createElement(RuntimeProviderManagementPanelView, {
          state: { ...state, providers: state.view?.providers ?? [] },
          actions,
          disabled: false,
        })
      );
      await Promise.resolve();
    });

    expect(host.textContent).toContain('OpenRouter');
    expect(host.textContent).toContain('4 models');

    await act(async () => {
      const connect = Array.from(host.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Connect')
      );
      connect?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(actions.startConnect).toHaveBeenCalledWith('openrouter');

    await act(async () => {
      root.render(
        React.createElement(RuntimeProviderManagementPanelView, {
          state: {
            ...state,
            providers: state.view?.providers ?? [],
            activeFormProviderId: 'openrouter',
            apiKeyValue: 'sk-secret-value',
          },
          actions,
          disabled: false,
        })
      );
      await Promise.resolve();
    });

    expect(host.querySelector('input[type="password"]')).not.toBeNull();
    expect(host.textContent).not.toContain('sk-secret-value');
  });

  it('renders connected provider model picker actions', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const actions = createActions();
    const connectedProvider = {
      providerId: 'openrouter',
      displayName: 'OpenRouter',
      state: 'connected' as const,
      ownership: ['managed'] as const,
      recommended: true,
      modelCount: 174,
      defaultModelId: null,
      authMethods: ['api'] as const,
      actions: [
        {
          id: 'use' as const,
          label: 'Use',
          enabled: true,
          disabledReason: null,
          requiresSecret: false,
          ownershipScope: 'runtime' as const,
        },
        {
          id: 'set-default' as const,
          label: 'Set default',
          enabled: true,
          disabledReason: null,
          requiresSecret: false,
          ownershipScope: 'runtime' as const,
        },
      ],
      detail: null,
    };
    const state = createState({
      view: {
        ...createState().view!,
        providers: [connectedProvider],
      },
      providers: [connectedProvider],
      modelPickerProviderId: 'openrouter',
      modelPickerMode: 'use',
      models: [
        {
          providerId: 'openrouter',
          modelId: 'openrouter/openai/gpt-oss-20b:free',
          displayName: 'openai/gpt-oss-20b:free',
          sourceLabel: 'OpenRouter',
          free: true,
          default: false,
          availability: 'untested',
        },
      ],
      selectedModelId: 'openrouter/openai/gpt-oss-20b:free',
    });

    await act(async () => {
      root.render(
        React.createElement(RuntimeProviderManagementPanelView, {
          state,
          actions,
          disabled: false,
        })
      );
      await Promise.resolve();
    });

    expect(host.textContent).toContain('openrouter/openai/gpt-oss-20b:free');
    expect(host.textContent).toContain('Use for new teams');
    expect(host.textContent).toContain('Set OpenCode default');

    await act(async () => {
      const useButton = Array.from(host.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Use for new teams')
      );
      useButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(actions.useModelForNewTeams).toHaveBeenCalledWith(
      'openrouter/openai/gpt-oss-20b:free'
    );
  });
});
