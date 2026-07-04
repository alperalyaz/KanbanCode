import { useMemo } from 'react';

import {
  mergeCodexCliStatusWithSnapshot,
  useCodexAccountSnapshot,
} from '@features/codex-account/renderer';
import { useStore } from '@renderer/store';
import { createLoadingMultimodelCliStatus } from '@renderer/store/slices/cliInstallerSlice';

import type { CliInstallationStatus, CliProviderId, CliProviderStatus } from '@shared/types';

export interface EffectiveCliProviderStatusSnapshot {
  cliStatus: CliInstallationStatus | null;
  sourceCliStatus: CliInstallationStatus | null;
  providerStatus: CliProviderStatus | null;
  loading: boolean;
  codexSnapshotPending: boolean;
}

export function useEffectiveCliProviderStatus(
  providerId: CliProviderId | undefined
): EffectiveCliProviderStatusSnapshot {
  const cliStatus = useStore((s) => s.cliStatus);
  const cliStatusLoading = useStore((s) => s.cliStatusLoading);

  const loadingCliStatus = useMemo(
    () => (!cliStatus && cliStatusLoading ? createLoadingMultimodelCliStatus() : cliStatus),
    [cliStatus, cliStatusLoading]
  );

  const codexAccount = useCodexAccountSnapshot({
    enabled:
      providerId === 'codex' &&
      loadingCliStatus?.flavor === 'agent_teams_orchestrator' &&
      Boolean(loadingCliStatus?.providers.some((provider) => provider.providerId === 'codex')),
  });

  const effectiveCliStatus = useMemo(
    () => mergeCodexCliStatusWithSnapshot(loadingCliStatus, codexAccount.snapshot),
    [codexAccount.snapshot, loadingCliStatus]
  );
  const codexSnapshotPending =
    codexAccount.loading &&
    Boolean(loadingCliStatus?.providers.some((provider) => provider.providerId === 'codex')) &&
    !codexAccount.snapshot;
  const providerStatus = useMemo(
    () =>
      providerId
        ? (effectiveCliStatus?.providers.find((provider) => provider.providerId === providerId) ??
          null)
        : null,
    [effectiveCliStatus?.providers, providerId]
  );

  return {
    cliStatus: effectiveCliStatus,
    sourceCliStatus: loadingCliStatus,
    providerStatus,
    loading: cliStatusLoading && effectiveCliStatus === null,
    codexSnapshotPending,
  };
}
