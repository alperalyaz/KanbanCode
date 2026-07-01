/**
 * TabBarActions - Right-side action buttons for the tab bar row.
 * Extracted from TabBar to render once (not per-pane).
 * Reads focused pane data from root store selectors (auto-synced via syncRootState).
 */

import { useEffect, useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { isElectronMode } from '@renderer/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useStore } from '@renderer/store';
import { Bell, PanelRight } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { MoreMenu } from './MoreMenu';

function formatDiscordMemberCount(count: number): string {
  if (count >= 10_000) return `${Math.floor(count / 1000)}k`;
  if (count >= 1000) return `${Math.floor(count / 100) / 10}k`;
  return String(count);
}

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
    updateStatus,
    openUpdateDialog,
  } = useStore(
    useShallow((s) => ({
      unreadCount: s.unreadCount,
      openNotificationsTab: s.openNotificationsTab,
      activeTabId: s.activeTabId,
      openTabs: s.openTabs,
      tabSessionData: s.tabSessionData,
      sidebarCollapsed: s.sidebarCollapsed,
      toggleSidebar: s.toggleSidebar,
      updateStatus: s.updateStatus,
      openUpdateDialog: s.openUpdateDialog,
    }))
  );

  // Hover states for buttons
  const [notificationsHover, setNotificationsHover] = useState(false);
  const [discordHover, setDiscordHover] = useState(false);
  const [expandHover, setExpandHover] = useState(false);
  const [updateHover, setUpdateHover] = useState(false);
  const [discordMemberCount, setDiscordMemberCount] = useState<number | null>(null);

  // Derive active tab and session detail for MoreMenu
  const activeTab = useMemo(
    () => openTabs.find((t) => t.id === activeTabId),
    [openTabs, activeTabId]
  );
  const activeTabSessionDetail = activeTabId
    ? (tabSessionData[activeTabId]?.sessionDetail ?? null)
    : null;
  const discordTooltip =
    discordMemberCount !== null
      ? `${t('layout.discord')} - ${discordMemberCount} members`
      : t('layout.discord');

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getDiscordMemberCount) return;

    let cancelled = false;
    void api
      .getDiscordMemberCount()
      .then(({ count }) => {
        if (!cancelled && typeof count === 'number' && Number.isFinite(count)) {
          setDiscordMemberCount(count);
        }
      })
      .catch(() => {
        // The Discord button stays usable if the public invite count is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="ml-2 flex shrink-0 items-center gap-1"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Update app button — only visible when update available or downloaded */}
      {(updateStatus === 'available' || updateStatus === 'downloaded') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={openUpdateDialog}
              onMouseEnter={() => setUpdateHover(true)}
              onMouseLeave={() => setUpdateHover(false)}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                color: updateHover ? '#4ade80' : '#22c55e',
                backgroundColor: updateHover ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              }}
            >
              {updateStatus === 'downloaded'
                ? t('updates.restartToUpdate')
                : t('updates.updateApp')}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {updateStatus === 'downloaded'
              ? t('updates.downloadedRestartTooltip')
              : t('updates.newVersionAvailable')}
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

      {/* Discord link */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={async () => {
              if (isElectronMode()) {
                await window.electronAPI.openExternal('https://discord.gg/qtqSZSyuEc');
                return;
              }

              window.open('https://discord.gg/qtqSZSyuEc', '_blank', 'noopener,noreferrer');
            }}
            onMouseEnter={() => setDiscordHover(true)}
            onMouseLeave={() => setDiscordHover(false)}
            className="relative rounded-md p-2 transition-colors"
            style={{
              color: discordHover ? 'var(--color-text)' : 'var(--color-text-muted)',
              backgroundColor: discordHover ? 'var(--color-surface-raised)' : 'transparent',
            }}
            aria-label={discordTooltip}
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.3698A19.791 19.791 0 0 0 15.4319 3.0a13.873 13.873 0 0 0-.6242 1.2757 18.27 18.27 0 0 0-5.6154 0A13.872 13.872 0 0 0 8.5681 3 19.736 19.736 0 0 0 3.683 4.3698C.5334 9.1048-.319 13.7216.099 18.272a19.9 19.9 0 0 0 6.0892 3.1157 14.96 14.96 0 0 0 1.303-2.1356 12.46 12.46 0 0 1-1.9352-.9351c.1624-.1218.3217-.2462.4763-.3736 3.7294 1.7014 7.772 1.7014 11.4572 0 .1546.1274.3139.2518.4763.3736-.6163.3622-1.2638.6754-1.9352.9351.3654.7439.8041 1.4554 1.303 2.1356A19.9 19.9 0 0 0 23.901 18.272c.5003-5.2737-.8381-9.8482-3.584-13.9022ZM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3334.9555-2.4191 2.1569-2.4191 1.2103 0 2.1757 1.0946 2.1568 2.419 0 1.3334-.9465 2.4191-2.1568 2.4191Zm7.96 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3334.9555-2.4191 2.1569-2.4191 1.2103 0 2.1757 1.0946 2.1568 2.419 0 1.3334-.9465 2.4191-2.1568 2.4191Z" />
            </svg>
            {discordMemberCount !== null && (
              <span className="pointer-events-none absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5865F2] px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-[var(--color-surface-sidebar)]">
                {formatDiscordMemberCount(discordMemberCount)}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{discordTooltip}</TooltipContent>
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
