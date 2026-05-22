import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WindowsAdministratorBanner } from './WindowsAdministratorBanner';

import type { WindowsElevationStatus } from '@shared/types/api';

function createStatus(overrides: Partial<WindowsElevationStatus> = {}): WindowsElevationStatus {
  return {
    platform: 'win32',
    isWindows: true,
    isAdministrator: false,
    checkFailed: false,
    error: null,
    ...overrides,
  };
}

function installElevationStatus(status: WindowsElevationStatus) {
  const getWindowsElevationStatus = vi.fn().mockResolvedValue(status);
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      getWindowsElevationStatus,
    },
  });
  return getWindowsElevationStatus;
}

async function flushReact(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('WindowsAdministratorBanner', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    Reflect.deleteProperty(window, 'electronAPI');
    vi.unstubAllGlobals();
  });

  it('shows a Windows Administrator warning when the app is not elevated', async () => {
    const getWindowsElevationStatus = installElevationStatus(createStatus());
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(React.createElement(WindowsAdministratorBanner));
      await flushReact();
    });

    expect(getWindowsElevationStatus).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Windows Administrator mode recommended');
    expect(host.textContent).toContain('Run as administrator');

    await act(async () => {
      root.unmount();
      await flushReact();
    });
  });

  it('hides the warning when Windows is already elevated', async () => {
    const getWindowsElevationStatus = installElevationStatus(
      createStatus({ isAdministrator: true })
    );
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(React.createElement(WindowsAdministratorBanner));
      await flushReact();
    });

    expect(getWindowsElevationStatus).toHaveBeenCalledTimes(1);
    expect(host.textContent).toBe('');

    await act(async () => {
      root.unmount();
      await flushReact();
    });
  });

  it('hides the warning outside Windows', async () => {
    const getWindowsElevationStatus = installElevationStatus(
      createStatus({ platform: 'darwin', isWindows: false, isAdministrator: null })
    );
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(React.createElement(WindowsAdministratorBanner));
      await flushReact();
    });

    expect(getWindowsElevationStatus).toHaveBeenCalledTimes(1);
    expect(host.textContent).toBe('');

    await act(async () => {
      root.unmount();
      await flushReact();
    });
  });

  it('hides the warning when the preload bridge does not expose the status check', async () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {},
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(React.createElement(WindowsAdministratorBanner));
      await flushReact();
    });

    expect(host.textContent).toBe('');

    await act(async () => {
      root.unmount();
      await flushReact();
    });
  });
});
