import { useMemo } from 'react';

import {
  CODEX_ACCOUNT_STARTUP_IDLE_MAX_DELAY_MS,
  CODEX_ACCOUNT_STARTUP_IDLE_MIN_DELAY_MS,
  mergeCodexCliStatusWithSnapshot,
  useCodexAccountSnapshot,
} from '@features/codex-account/renderer';
import { isElectronMode } from '@renderer/api';
import { useStore } from '@renderer/store';
import { createLoadingMultimodelCliStatus } from '@renderer/store/slices/cliInstallerSlice';
import { useShallow } from 'zustand/react/shallow';

import { ProviderActivityStatusStrip } from './ProviderActivityStatusStrip';

export const GlobalProviderStatusHeader = (): React.JSX.Element | null => {
  const isElectron = useMemo(() => isElectronMode(), []);
  const {
    cliStatus,
    cliStatusLoading,
    cliProviderStatusLoading,
    multimodelEnabled,
    isDashboardFocused,
  } = useStore(
    useShallow((state) => {
      const focusedPane = state.paneLayout.panes.find(
        (pane) => pane.id === state.paneLayout.focusedPaneId
      );
      const activeTab = focusedPane?.tabs.find((tab) => tab.id === focusedPane.activeTabId) ?? null;

      return {
        cliStatus: state.cliStatus,
        cliStatusLoading: state.cliStatusLoading,
        cliProviderStatusLoading: state.cliProviderStatusLoading,
        multimodelEnabled: state.appConfig?.general?.multimodelEnabled ?? true,
        isDashboardFocused:
          !focusedPane || focusedPane.tabs.length === 0 || activeTab?.type === 'dashboard',
      };
    })
  );

  const loadingCliStatus = useMemo(
    () =>
      !cliStatus && cliStatusLoading && multimodelEnabled
        ? createLoadingMultimodelCliStatus()
        : cliStatus,
    [cliStatus, cliStatusLoading, multimodelEnabled]
  );

  const codexAccount = useCodexAccountSnapshot({
    enabled:
      isElectron &&
      multimodelEnabled &&
      loadingCliStatus?.flavor === 'agent_teams_orchestrator' &&
      Boolean(loadingCliStatus?.providers.some((provider) => provider.providerId === 'codex')),
    includeRateLimits: false,
    initialRefreshDelayMs: CODEX_ACCOUNT_STARTUP_IDLE_MIN_DELAY_MS,
    initialRefreshMaxDelayMs: CODEX_ACCOUNT_STARTUP_IDLE_MAX_DELAY_MS,
  });

  const effectiveCliStatus = useMemo(
    () => mergeCodexCliStatusWithSnapshot(loadingCliStatus, codexAccount.snapshot),
    [codexAccount.snapshot, loadingCliStatus]
  );
  const codexSnapshotPending =
    codexAccount.loading &&
    Boolean(loadingCliStatus?.providers.some((provider) => provider.providerId === 'codex')) &&
    !codexAccount.snapshot;

  if (isDashboardFocused) {
    return null;
  }

  return (
    <ProviderActivityStatusStrip
      cliStatus={effectiveCliStatus}
      sourceCliStatus={loadingCliStatus}
      cliStatusLoading={cliStatusLoading}
      cliProviderStatusLoading={cliProviderStatusLoading}
      multimodelEnabled={multimodelEnabled}
      codexSnapshotPending={codexSnapshotPending}
      className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface-sidebar)] px-4 py-2"
    />
  );
};
