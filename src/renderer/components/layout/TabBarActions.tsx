/**
 * TabBarActions - Right-side action buttons for the tab bar row.
 * Extracted from TabBar to render once (not per-pane).
 * Reads focused pane data from root store selectors (auto-synced via syncRootState).
 */

import { useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useStore } from '@renderer/store';
import { Bell, PanelRight } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { MoreMenu } from './MoreMenu';

export const TabBarActions = (): React.JSX.Element => {
  const { t } = useAppTranslation('common');
  const {
    unreadCount,
    openNotificationsTab,
    activeTabId,
    openTabs,
    tabSessionData,
    sidebarCollapsed,
    toggleSidebar,
  } = useStore(
    useShallow((s) => ({
      unreadCount: s.unreadCount,
      openNotificationsTab: s.openNotificationsTab,
      activeTabId: s.activeTabId,
      openTabs: s.openTabs,
      tabSessionData: s.tabSessionData,
      sidebarCollapsed: s.sidebarCollapsed,
      toggleSidebar: s.toggleSidebar,
    }))
  );

  // Hover states for buttons
  const [notificationsHover, setNotificationsHover] = useState(false);
  const [expandHover, setExpandHover] = useState(false);

  // Derive active tab and session detail for MoreMenu
  const activeTab = useMemo(
    () => openTabs.find((t) => t.id === activeTabId),
    [openTabs, activeTabId]
  );
  const activeTabSessionDetail = activeTabId
    ? (tabSessionData[activeTabId]?.sessionDetail ?? null)
    : null;

  return (
    <div
      className="ml-2 flex shrink-0 items-center gap-1"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Notifications bell icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={openNotificationsTab}
            onMouseEnter={() => setNotificationsHover(true)}
            onMouseLeave={() => setNotificationsHover(false)}
            className="relative rounded-md p-2 transition-colors"
            style={{
              color: notificationsHover ? 'var(--color-text)' : 'var(--color-text-muted)',
              backgroundColor: notificationsHover ? 'var(--color-surface-raised)' : 'transparent',
            }}
            aria-label={t('notifications.title')}
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('notifications.title')}</TooltipContent>
      </Tooltip>

      {/* More menu (Teams, Settings, Extensions, Search, Schedules, Docs, Export, Analyze) */}
      <MoreMenu
        activeTab={activeTab}
        activeTabSessionDetail={activeTabSessionDetail}
        activeTabId={activeTabId}
      />

      {/* Expand sidebar — rightmost, only when collapsed */}
      {sidebarCollapsed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              onMouseEnter={() => setExpandHover(true)}
              onMouseLeave={() => setExpandHover(false)}
              className="mr-1 rounded-md p-2 transition-colors"
              style={{
                color: expandHover ? 'var(--color-text)' : 'var(--color-text-muted)',
                backgroundColor: expandHover ? 'var(--color-surface-raised)' : 'transparent',
              }}
              aria-label={t('layout.expandSidebar')}
            >
              <PanelRight className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('layout.expandSidebar')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
