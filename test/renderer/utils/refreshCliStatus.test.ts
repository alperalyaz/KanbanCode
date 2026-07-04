import { refreshCliStatusForCurrentMode } from '@renderer/utils/refreshCliStatus';
import { describe, expect, it, vi } from 'vitest';

describe('refreshCliStatusForCurrentMode', () => {
  it('always uses provider-first bootstrap', async () => {
    const bootstrapCliStatus = vi.fn().mockResolvedValue(undefined);
    const fetchCliStatus = vi.fn().mockResolvedValue(undefined);

    await refreshCliStatusForCurrentMode({
      bootstrapCliStatus,
      fetchCliStatus,
    });

    expect(bootstrapCliStatus).toHaveBeenCalledWith(undefined);
    expect(fetchCliStatus).not.toHaveBeenCalled();
  });

  it('passes deferred provider status mode to the bootstrap when requested', async () => {
    const bootstrapCliStatus = vi.fn().mockResolvedValue(undefined);
    const fetchCliStatus = vi.fn().mockResolvedValue(undefined);

    await refreshCliStatusForCurrentMode({
      providerStatusMode: 'defer',
      bootstrapCliStatus,
      fetchCliStatus,
    });

    expect(bootstrapCliStatus).toHaveBeenCalledWith({
      providerStatusMode: 'defer',
    });
    expect(fetchCliStatus).not.toHaveBeenCalled();
  });
});
