import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const closeNotificationsTab = vi.fn();
const openDashboard = vi.fn();
const fetchNotifications = vi.fn(async () => undefined);
const getActiveTab = vi.fn(() => null);

vi.mock('@features/localization/renderer', () => ({
  useAppTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'notifications.empty.autoClosing') {
        return `Closing in ${String(options?.seconds ?? '')}s…`;
      }
      const labels: Record<string, string> = {
        'notifications.title': 'Notifications',
        'notifications.loading': 'Loading notifications...',
        'notifications.actions.close': 'Close',
        'notifications.actions.back': 'Go back',
        'notifications.empty.noNotifications': 'No notifications',
        'notifications.empty.allCaughtUp': "You're all caught up!",
        'notifications.empty.keepOpen': 'Keep open',
        'notifications.empty.noMatching': 'No matching notifications',
        'notifications.empty.tryDifferentFilter': 'Try a different filter',
        'list.all': 'All',
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('@renderer/store', () => ({
  useStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        notifications: [],
        unreadCount: 0,
        fetchNotifications,
        markNotificationRead: vi.fn(),
        markAllNotificationsRead: vi.fn(),
        deleteNotification: vi.fn(),
        clearNotifications: vi.fn(),
        navigateToError: vi.fn(),
        closeNotificationsTab,
        openDashboard,
        getActiveTab,
      }),
    {
      getState: () => ({
        getActiveTab,
      }),
    }
  ),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
    scrollToIndex: vi.fn(),
  }),
}));

import { NotificationsView } from '@renderer/components/notifications/NotificationsView';

describe('NotificationsView empty exit', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    closeNotificationsTab.mockReset();
    openDashboard.mockReset();
    fetchNotifications.mockClear();
    getActiveTab.mockReturnValue(null);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows an explicit close action and auto-closes an empty inbox', async () => {
    await act(async () => {
      root.render(<NotificationsView />);
    });

    // Resolve the mount-time fetchNotifications promise.
    await act(async () => {
      await Promise.resolve();
    });

    expect(host.querySelector('[data-testid="notifications-empty-state"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="notifications-close"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="notifications-empty-close"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="notifications-auto-close-hint"]')).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });

    expect(closeNotificationsTab).toHaveBeenCalled();
    expect(openDashboard).toHaveBeenCalled();
  });

  it('keeps the empty inbox open when the user cancels auto-close', async () => {
    await act(async () => {
      root.render(<NotificationsView />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const keepOpen = host.querySelector(
      '[data-testid="notifications-keep-open"]'
    ) as HTMLButtonElement | null;
    expect(keepOpen).not.toBeNull();

    await act(async () => {
      keepOpen?.click();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(closeNotificationsTab).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="notifications-auto-close-hint"]')).toBeNull();
  });

  it('closes immediately when the empty-state back button is clicked', async () => {
    await act(async () => {
      root.render(<NotificationsView />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const backButton = host.querySelector(
      '[data-testid="notifications-empty-close"]'
    ) as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();

    await act(async () => {
      backButton?.click();
    });

    expect(closeNotificationsTab).toHaveBeenCalled();
  });
});
