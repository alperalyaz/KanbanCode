import { api } from '@renderer/api';
import { useStore } from '@renderer/store';
import { getIncompleteMultimodelProviderIds } from '@renderer/store/slices/cliInstallerSlice';

import type { CliProviderId } from '@shared/types';

let inFlight: Promise<void> | null = null;
let requested = false;

/** Prefer OpenCode first on cold start so free first-run path becomes ready sooner. */
const PROVIDER_HYDRATION_PRIORITY: readonly CliProviderId[] = [
  'opencode',
  'anthropic',
  'codex',
  'gemini',
];

function sortProviderIdsForHydration(providerIds: CliProviderId[]): CliProviderId[] {
  const priority = new Map(PROVIDER_HYDRATION_PRIORITY.map((id, index) => [id, index]));
  return [...providerIds].sort((left, right) => {
    const leftRank = priority.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = priority.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

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
 *
 * Strategy:
 * 1. Lightweight bootstrap (`defer`) — binary/version only
 * 2. Runtime install status (OpenCode/Codex) in parallel with provider hydration
 * 3. Provider status hydration prioritized: OpenCode → Anthropic → Codex → Gemini
 *    so first-run free path becomes usable before paid-provider catalogs finish
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

      const runtimeFetches: Promise<void>[] = [];
      if (api.openCodeRuntime) {
        runtimeFetches.push(useStore.getState().fetchOpenCodeRuntimeStatus());
      }
      if (api.codexRuntime) {
        runtimeFetches.push(useStore.getState().fetchCodexRuntimeStatus());
      }

      // Kick runtime status immediately — first-run readiness depends on install state,
      // not the full model catalog.
      const runtimePromise = Promise.all(runtimeFetches);

      const providerIds = sortProviderIdsForHydration(
        getIncompleteMultimodelProviderIds(useStore.getState().cliStatus)
      );
      const [priorityProviderId, ...remainingProviderIds] = providerIds;

      // Start OpenCode (or highest-priority incomplete provider) first so the free
      // first-run path becomes usable sooner, then hydrate the rest in parallel.
      if (priorityProviderId) {
        await useStore.getState().fetchCliProviderStatus(priorityProviderId, { silent: false });
      }
      await Promise.all([
        ...remainingProviderIds.map((providerId) =>
          useStore.getState().fetchCliProviderStatus(providerId, { silent: false })
        ),
        runtimePromise,
      ]);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
