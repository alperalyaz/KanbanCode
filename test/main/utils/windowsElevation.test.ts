// @vitest-environment node
import {
  createWindowsElevationStatusChecker,
  resetWindowsElevationStatusCacheForTests,
} from '@main/utils/windowsElevation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WindowsElevationCommandRunner } from '@main/utils/windowsElevation';

function createError(
  message: string,
  fields: { code?: string | number; killed?: boolean; signal?: string | null } = {}
): Error & { code?: string | number; killed?: boolean; signal?: string | null } {
  return Object.assign(new Error(message), fields);
}

describe('windowsElevation', () => {
  afterEach(() => {
    resetWindowsElevationStatusCacheForTests();
  });

  it('does not run the elevation command outside Windows', async () => {
    const runCommand = vi.fn<WindowsElevationCommandRunner>();

    const status = await createWindowsElevationStatusChecker({
      platform: 'darwin',
      runCommand,
    })();

    expect(runCommand).not.toHaveBeenCalled();
    expect(status).toEqual({
      platform: 'darwin',
      isWindows: false,
      isAdministrator: null,
      checkFailed: false,
      error: null,
    });
  });

  it('reports Administrator mode when fltmc succeeds', async () => {
    const runCommand = vi
      .fn<WindowsElevationCommandRunner>()
      .mockResolvedValue({ error: null });

    const status = await createWindowsElevationStatusChecker({
      platform: 'win32',
      systemRoot: 'C:\\Windows',
      runCommand,
    })();

    expect(runCommand).toHaveBeenCalledWith('C:\\Windows\\System32\\fltmc.exe', {
      timeoutMs: 3_000,
    });
    expect(status.isAdministrator).toBe(true);
    expect(status.checkFailed).toBe(false);
  });

  it('reports non-elevated Windows when fltmc exits with an error', async () => {
    const runCommand = vi.fn<WindowsElevationCommandRunner>().mockResolvedValue({
      error: createError('Command failed', { code: 1 }),
      stderr: 'Access is denied.',
    });

    const status = await createWindowsElevationStatusChecker({
      platform: 'win32',
      runCommand,
    })();

    expect(status.isWindows).toBe(true);
    expect(status.isAdministrator).toBe(false);
    expect(status.checkFailed).toBe(false);
    expect(status.error).toBe('Access is denied.');
  });

  it('reports an unknown status when the Windows probe command is missing', async () => {
    const runCommand = vi.fn<WindowsElevationCommandRunner>().mockResolvedValue({
      error: createError('spawn fltmc.exe ENOENT', { code: 'ENOENT' }),
    });

    const status = await createWindowsElevationStatusChecker({
      platform: 'win32',
      runCommand,
    })();

    expect(status.isAdministrator).toBeNull();
    expect(status.checkFailed).toBe(true);
    expect(status.error).toContain('ENOENT');
  });

  it('reports an unknown status when the Windows probe times out', async () => {
    const runCommand = vi.fn<WindowsElevationCommandRunner>().mockResolvedValue({
      error: createError('Command timed out', { code: 'ETIMEDOUT', killed: true }),
    });

    const status = await createWindowsElevationStatusChecker({
      platform: 'win32',
      runCommand,
    })();

    expect(status.isAdministrator).toBeNull();
    expect(status.checkFailed).toBe(true);
    expect(status.error).toContain('Command timed out');
  });

  it('reports an unknown status when the Windows probe throws before returning a result', async () => {
    const runCommand = vi
      .fn<WindowsElevationCommandRunner>()
      .mockRejectedValue(new Error('spawn failed'));

    const status = await createWindowsElevationStatusChecker({
      platform: 'win32',
      runCommand,
    })();

    expect(status.isAdministrator).toBeNull();
    expect(status.checkFailed).toBe(true);
    expect(status.error).toBe('spawn failed');
  });
});
