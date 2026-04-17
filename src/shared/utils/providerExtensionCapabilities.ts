import type {
  CliExtensionCapabilities,
  CliExtensionCapability,
  CliProviderStatus,
} from '@shared/types';

const SUPPORTED_SHARED_CAPABILITY: CliExtensionCapability = {
  status: 'supported',
  ownership: 'shared',
  reason: null,
};

export function createDefaultCliExtensionCapabilities(
  overrides?: Partial<CliExtensionCapabilities>
): CliExtensionCapabilities {
  return {
    plugins: { ...SUPPORTED_SHARED_CAPABILITY },
    mcp: { ...SUPPORTED_SHARED_CAPABILITY },
    skills: { ...SUPPORTED_SHARED_CAPABILITY },
    apiKeys: { ...SUPPORTED_SHARED_CAPABILITY },
    ...overrides,
  };
}

export function getCliProviderExtensionCapabilities(
  provider: Pick<CliProviderStatus, 'capabilities'>
): CliExtensionCapabilities {
  return provider.capabilities.extensions ?? createDefaultCliExtensionCapabilities();
}

export function getCliProviderExtensionCapability(
  provider: Pick<CliProviderStatus, 'capabilities'>,
  section: keyof CliExtensionCapabilities
): CliExtensionCapability {
  return getCliProviderExtensionCapabilities(provider)[section];
}

export function isCliExtensionCapabilityAvailable(
  capability: Pick<CliExtensionCapability, 'status'>
): boolean {
  return capability.status === 'supported' || capability.status === 'read-only';
}

export function isCliExtensionCapabilityMutable(
  capability: Pick<CliExtensionCapability, 'status'>
): boolean {
  return capability.status === 'supported';
}
