import type { CliInstallerProviderStatusMode } from '@shared/types';

interface RefreshCliStatusOptions {
  providerStatusMode?: CliInstallerProviderStatusMode;
  bootstrapCliStatus: (options?: {
    providerStatusMode?: CliInstallerProviderStatusMode;
  }) => Promise<void>;
  fetchCliStatus: () => Promise<void>;
}

// Multi-model is always on, so this always hydrates the full provider bootstrap.
export function refreshCliStatusForCurrentMode({
  providerStatusMode,
  bootstrapCliStatus,
}: RefreshCliStatusOptions): Promise<void> {
  return bootstrapCliStatus(providerStatusMode ? { providerStatusMode } : undefined);
}
