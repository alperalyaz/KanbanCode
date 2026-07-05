/* eslint-disable @typescript-eslint/naming-convention -- Component mocks mirror PascalCase exports. */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storeMock = vi.hoisted(() => ({
  state: {
    sidebarCollapsed: false,
    toggleSidebar: vi.fn(),
  },
}));

vi.mock('@renderer/store', () => ({
  useStore: <T,>(selector: (state: typeof storeMock.state) => T): T => selector(storeMock.state),
}));

vi.mock('../sidebar/GlobalTaskList', () => ({
  GlobalTaskList: () => React.createElement('div', { 'data-testid': 'tasks-panel' }, 'Tasks panel'),
}));

/* eslint-enable @typescript-eslint/naming-convention -- Re-enable after component mocks. */

import { Sidebar } from './Sidebar';

const roots: Root[] = [];

const flushReact = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
};

const createHarness = (): { host: HTMLDivElement; root: Root } => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  return { host, root };
};

const renderSidebar = async (root: Root): Promise<void> => {
  await act(async () => {
    root.render(<Sidebar />);
    await flushReact();
  });
};

describe('Sidebar', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    storeMock.state.sidebarCollapsed = false;
    storeMock.state.toggleSidebar.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) {
        root.unmount();
      }
      await flushReact();
    });
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders the task list and no longer exposes a sessions panel', async () => {
    const { host, root } = createHarness();

    await renderSidebar(root);

    expect(host.querySelector('[data-testid="tasks-panel"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="sessions-panel"]')).toBeNull();
    // The Tasks/Sessions tablist was removed; the sidebar now shows a single view.
    expect(host.querySelector('[role="tablist"]')).toBeNull();
  });
});
