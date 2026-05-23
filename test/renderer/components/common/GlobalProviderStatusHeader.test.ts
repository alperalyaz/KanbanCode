import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface StoreState {
  cliStatus: Record<string, unknown> | null;
  cliStatusLoading: boolean;
  cliProviderStatusLoading: Record<string, boolean>;
  appConfig: {
    general: {
      multimodelEnabled: boolean;
    };
  };
  paneLayout: {
    focusedPaneId: string;
    panes: Array<{
      id: string;
      activeTabId: string | null;
      tabs: Array<{
        id: string;
        type: string;
      }>;
    }>;
  };
}

const storeState = {} as StoreState;
const codexAccountHookState = {
  snapshot: null,
  loading: false,
  error: null,
  refresh: vi.fn(() => Promise.resolve(undefined)),
  startChatgptLogin: vi.fn(() => Promise.resolve(true)),
  cancelChatgptLogin: vi.fn(() => Promise.resolve(true)),
  logout: vi.fn(() => Promise.resolve(true)),
};

vi.mock('@renderer/api', () => ({
  isElectronMode: () => true,
}));

vi.mock('@renderer/components/common/ProviderBrandLogo', () => ({
  ProviderBrandLogo: ({ providerId }: { providerId: string }) =>
    React.createElement('span', { 'data-testid': `provider-logo-${providerId}` }, providerId),
}));

vi.mock('@features/codex-account/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/codex-account/renderer')>();
  return {
    ...actual,
    useCodexAccountSnapshot: () => codexAccountHookState,
  };
});

vi.mock('@renderer/store', () => ({
  useStore: (selector: (state: StoreState) => unknown) => selector(storeState),
}));

import { GlobalProviderStatusHeader } from '@renderer/components/common/GlobalProviderStatusHeader';

function createProvider(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    providerId: 'anthropic',
    displayName: 'Anthropic',
    supported: true,
    authenticated: false,
    authMethod: null,
    verificationState: 'unknown',
    statusMessage: 'Checking...',
    detailMessage: null,
    models: [],
    modelVerificationState: 'idle',
    modelAvailability: [],
    canLoginFromUi: true,
    capabilities: {
      teamLaunch: true,
      oneShot: true,
      extensions: {},
    },
    backend: null,
    availableBackends: [],
    connection: null,
    ...overrides,
  };
}

function createMultimodelStatus(providers: Record<string, unknown>[]): Record<string, unknown> {
  return {
    flavor: 'agent_teams_orchestrator',
    displayName: 'Multimodel runtime',
    supportsSelfUpdate: false,
    showVersionDetails: false,
    showBinaryPath: false,
    installed: true,
    installedVersion: '0.0.3',
    binaryPath: '/tmp/claude-multimodel',
    latestVersion: null,
    updateAvailable: false,
    authLoggedIn: providers.some((provider) => provider.authenticated === true),
    authStatusChecking: false,
    authMethod: null,
    providers,
  };
}

function setFocusedTab(type: string): void {
  storeState.paneLayout = {
    focusedPaneId: 'pane-1',
    panes: [
      {
        id: 'pane-1',
        activeTabId: type === 'empty' ? null : 'tab-1',
        tabs: type === 'empty' ? [] : [{ id: 'tab-1', type }],
      },
    ],
  };
}

describe('GlobalProviderStatusHeader', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    storeState.cliStatus = createMultimodelStatus([createProvider({})]);
    storeState.cliStatusLoading = false;
    storeState.cliProviderStatusLoading = { anthropic: true };
    storeState.appConfig = {
      general: {
        multimodelEnabled: true,
      },
    };
    setFocusedTab('team');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('shows provider activity on non-dashboard screens', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(React.createElement(GlobalProviderStatusHeader));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Provider Activity');
    expect(host.textContent).toContain('Anthropic');
    expect(host.textContent).toContain('Checking...');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });

  it('hides on dashboard screens', async () => {
    setFocusedTab('dashboard');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(React.createElement(GlobalProviderStatusHeader));
      await Promise.resolve();
    });

    expect(host.textContent).toBe('');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });
});
