/**
 * TabBarActions - Right-side action buttons for the tab bar row.
 * Extracted from TabBar to render once (not per-pane).
 * Reads focused pane data from root store selectors (auto-synced via syncRootState).
 */

import { useCallback, useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { api } from '@renderer/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useStore } from '@renderer/store';
import { Bell, PanelRight, PowerOff } from 'lucide-react';
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
    leadActivityByTeam,
  } = useStore(
    useShallow((s) => ({
      unreadCount: s.unreadCount,
      openNotificationsTab: s.openNotificationsTab,
      activeTabId: s.activeTabId,
      openTabs: s.openTabs,
      tabSessionData: s.tabSessionData,
      sidebarCollapsed: s.sidebarCollapsed,
      toggleSidebar: s.toggleSidebar,
      leadActivityByTeam: s.leadActivityByTeam,
    }))
  );

  // Hover states for buttons
  const [notificationsHover, setNotificationsHover] = useState(false);
  const [expandHover, setExpandHover] = useState(false);
  const [safeStopHover, setSafeStopHover] = useState(false);
  const [stoppingAll, setStoppingAll] = useState(false);

  // Any team that is not offline is considered running and worth a safe stop.
  const hasRunningTeams = useMemo(
    () => Object.values(leadActivityByTeam).some((state) => state && state !== 'offline'),
    [leadActivityByTeam]
  );

  const handleSafeStopAll = useCallback(async (): Promise<void> => {
    setStoppingAll(true);
    try {
      await api.teams.stopAll();
    } catch (error) {
      console.error('[TabBarActions] Safe stop all failed', error);
    } finally {
      setStoppingAll(false);
    }
  }, []);

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
      {/* Safe stop — gracefully stop all running teams before closing */}
      {(hasRunningTeams || stoppingAll) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => void handleSafeStopAll()}
              onMouseEnter={() => setSafeStopHover(true)}
              onMouseLeave={() => setSafeStopHover(false)}
              disabled={stoppingAll}
              className="relative rounded-md p-2 transition-colors disabled:opacity-60"
              style={{
                color: safeStopHover ? '#f87171' : 'var(--color-text-muted)',
                backgroundColor: safeStopHover ? 'rgba(248,113,113,0.12)' : 'transparent',
              }}
              aria-label={t('layout.safeStopAll')}
            >
              <PowerOff className={`size-4 ${stoppingAll ? 'animate-pulse' : ''}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {stoppingAll ? t('layout.safeStopAllInProgress') : t('layout.safeStopAllTooltip')}
          </TooltipContent>
        </Tooltip>
      )}

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
