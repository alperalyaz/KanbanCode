import { beforeEach, describe, expect, it, vi } from 'vitest';

const bootstrapCliStatus = vi.fn().mockResolvedValue(undefined);
const fetchCliStatus = vi.fn().mockResolvedValue(undefined);
const fetchCliProviderStatus = vi.fn().mockResolvedValue(undefined);
const fetchOpenCodeRuntimeStatus = vi.fn().mockResolvedValue(undefined);
const fetchCodexRuntimeStatus = vi.fn().mockResolvedValue(undefined);

vi.mock('@renderer/api', () => ({
  api: {
    openCodeRuntime: {},
    codexRuntime: {},
  },
}));

vi.mock('@renderer/store', () => ({
  useStore: {
    getState: () => ({
      appConfig: { general: { multimodelEnabled: true } },
      cliStatus: null,
      openCodeRuntimeStatus: null,
      codexRuntimeStatus: null,
      bootstrapCliStatus,
      fetchCliStatus,
      fetchCliProviderStatus,
      fetchOpenCodeRuntimeStatus,
      fetchCodexRuntimeStatus,
    }),
  },
}));

vi.mock('@renderer/store/slices/cliInstallerSlice', () => ({
  getIncompleteMultimodelProviderIds: vi.fn(() => ['anthropic', 'codex', 'opencode']),
}));

import {
  hasRequestedProviderRuntimeChecks,
  requestProviderRuntimeChecks,
  resetProviderRuntimeChecksState,
} from '../../../src/renderer/utils/requestProviderRuntimeChecks';
import { getIncompleteMultimodelProviderIds } from '../../../src/renderer/store/slices/cliInstallerSlice';

describe('requestProviderRuntimeChecks', () => {
  beforeEach(() => {
    resetProviderRuntimeChecksState();
    bootstrapCliStatus.mockClear();
    fetchCliStatus.mockClear();
    fetchCliProviderStatus.mockClear();
    fetchOpenCodeRuntimeStatus.mockClear();
    fetchCodexRuntimeStatus.mockClear();
    vi.mocked(getIncompleteMultimodelProviderIds).mockReturnValue([
      'anthropic',
      'codex',
      'opencode',
    ]);
  });

  it('bootstraps multimodel providers and runtime status on first request', async () => {
    await requestProviderRuntimeChecks();

    expect(hasRequestedProviderRuntimeChecks()).toBe(true);
    expect(bootstrapCliStatus).toHaveBeenCalledWith({
      multimodelEnabled: true,
      providerStatusMode: 'defer',
    });
    expect(fetchCliProviderStatus).toHaveBeenCalledTimes(3);
    expect(fetchOpenCodeRuntimeStatus).toHaveBeenCalledTimes(1);
    expect(fetchCodexRuntimeStatus).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent requests', async () => {
    const first = requestProviderRuntimeChecks();
    const second = requestProviderRuntimeChecks();

    await Promise.all([first, second]);

    expect(bootstrapCliStatus).toHaveBeenCalledTimes(1);
  });
});
