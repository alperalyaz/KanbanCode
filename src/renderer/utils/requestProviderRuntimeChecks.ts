import { api } from '@renderer/api';
import { useStore } from '@renderer/store';
import { getIncompleteMultimodelProviderIds } from '@renderer/store/slices/cliInstallerSlice';

let inFlight: Promise<void> | null = null;
let requested = false;

export function hasRequestedProviderRuntimeChecks(): boolean {
  return requested;
}

/** Test-only reset for module-level request tracking. */
export function resetProviderRuntimeChecksState(): void {
  inFlight = null;
  requested = false;
}

/**
 * Load CLI/provider/runtime status on demand instead of at app startup.
 * Safe to call from multiple UI surfaces; concurrent calls share one in-flight run.
 */
export function requestProviderRuntimeChecks(options?: { force?: boolean }): Promise<void> {
  if (inFlight) {
    return inFlight;
  }

  const state = useStore.getState();
  const incompleteProviderIds = getIncompleteMultimodelProviderIds(state.cliStatus);

  if (
    requested &&
    !options?.force &&
    state.cliStatus &&
    incompleteProviderIds.length === 0 &&
    (!api.openCodeRuntime || state.openCodeRuntimeStatus !== null) &&
    (!api.codexRuntime || state.codexRuntimeStatus !== null)
  ) {
    return Promise.resolve();
  }

  requested = true;
  inFlight = (async () => {
    try {
      const currentState = useStore.getState();
      await currentState.bootstrapCliStatus({ providerStatusMode: 'defer' });
      const providerIds = getIncompleteMultimodelProviderIds(useStore.getState().cliStatus);
      await Promise.all(
        providerIds.map((providerId) =>
          useStore.getState().fetchCliProviderStatus(providerId, { silent: false })
        )
      );

      const runtimeFetches: Promise<void>[] = [];
      if (api.openCodeRuntime) {
        runtimeFetches.push(useStore.getState().fetchOpenCodeRuntimeStatus());
      }
      if (api.codexRuntime) {
        runtimeFetches.push(useStore.getState().fetchCodexRuntimeStatus());
      }
      await Promise.all(runtimeFetches);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
