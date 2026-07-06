/**
 * DashboardView - Main dashboard shell.
 * Keeps only screen composition and delegates recent-projects logic to the feature slice.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { RecentProjectsSection } from '@features/recent-projects/renderer';
import { useRecentProjectsSection } from '@features/recent-projects/renderer/hooks/useRecentProjectsSection';
import { RunningTeamsSection } from '@features/running-teams/renderer';
import { useStore } from '@renderer/store';
import { formatShortcut } from '@renderer/utils/stringUtils';
import { APP_NAME } from '@shared/constants/brand';
import { ArrowRight, Command, Search, Users } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { CliStatusBanner } from './CliStatusBanner';
import { TmuxStatusBanner } from './TmuxStatusBanner';
import { WebPreviewBanner } from './WebPreviewBanner';
import { WindowsAdministratorBanner } from './WindowsAdministratorBanner';

interface CommandSearchProps {
  value: string;
  onChange: (value: string) => void;
}

const CommandSearch = ({ value, onChange }: Readonly<CommandSearchProps>): React.JSX.Element => {
  const { t } = useAppTranslation('dashboard');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openCommandPalette, selectedProjectId } = useStore(
    useShallow((state) => ({
      openCommandPalette: state.openCommandPalette,
      selectedProjectId: state.selectedProjectId,
    }))
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.code === 'KeyK') {
        event.preventDefault();
        openCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCommandPalette]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus({ preventScroll: true });
    const timeoutId = window.setTimeout(() => {
      if (document.activeElement !== input) {
        input.focus({ preventScroll: true });
      }
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="relative w-full">
      <label className="mb-2 block text-sm font-medium text-text-secondary">
        {t('hero.searchLabel')}
      </label>
      <div
        className={`relative flex items-center gap-3 rounded-xl border bg-surface-raised px-5 py-4 transition-all duration-200 ${
          isFocused
            ? 'border-indigo-500/40 shadow-[0_0_24px_rgba(99,102,241,0.12)] ring-1 ring-indigo-500/20'
            : 'border-border hover:border-zinc-600'
        } `}
      >
        <Search className="size-5 shrink-0 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('recentProjects.searchPlaceholder')}
          className="flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-muted"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <button
          onClick={() => openCommandPalette()}
          className="flex shrink-0 items-center gap-1.5 transition-opacity hover:opacity-80"
          title={
            selectedProjectId
              ? `Search in sessions (${formatShortcut('K')})`
              : `Search projects (${formatShortcut('K')})`
          }
        >
          <kbd className="flex h-7 items-center justify-center rounded-md border border-border bg-surface-overlay px-2 text-xs font-medium text-text-muted">
            <Command className="size-3" />
          </kbd>
          <kbd className="flex h-7 min-w-7 items-center justify-center rounded-md border border-border bg-surface-overlay px-2 text-xs font-medium text-text-muted">
            K
          </kbd>
        </button>
      </div>
      <p className="mt-2 text-sm text-text-muted">{t('hero.searchDescription')}</p>
    </div>
  );
};

interface DashboardSectionHeadingProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
}

const DashboardSectionHeading = ({
  title,
  count,
  action,
}: Readonly<DashboardSectionHeadingProps>): React.JSX.Element => (
  <div className="mb-5 flex items-center justify-between gap-3">
    <h2 className="flex items-center gap-2.5 text-base font-semibold text-text">
      {title}
      {count !== undefined ? (
        <span className="rounded-full border border-border bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-secondary">
          {count}
        </span>
      ) : null}
    </h2>
    {action}
  </div>
);

export const DashboardView = (): React.JSX.Element => {
  const { t } = useAppTranslation('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const openTeamsTab = useStore((state) => state.openTeamsTab);
  const { teams, teamsLoading } = useStore(
    useShallow((state) => ({
      teams: state.teams,
      teamsLoading: state.teamsLoading,
    }))
  );
  const recentProjectsSection = useRecentProjectsSection(searchQuery);

  const hasTeams = useMemo(() => teams.some((team) => !team.deletedAt), [teams]);
  const showProjectSearch =
    recentProjectsSection.loading ||
    recentProjectsSection.hasRecentProjects ||
    searchQuery.trim().length > 0;
  const showCreateTeamAction = !teamsLoading && !hasTeams;

  useEffect(() => {
    if (
      !recentProjectsSection.loading &&
      !recentProjectsSection.hasRecentProjects &&
      searchQuery.trim()
    ) {
      setSearchQuery('');
    }
  }, [recentProjectsSection.hasRecentProjects, recentProjectsSection.loading, searchQuery]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-auto bg-surface">
      {/* Ambient aurora: slow GPU-only drift, near-zero CPU/RAM. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="dashboard-aurora dashboard-aurora--one" />
        <div className="dashboard-aurora dashboard-aurora--two" />
        <div className="dashboard-aurora dashboard-aurora--three" />
      </div>

      <div className="relative flex min-h-0 w-full flex-1 flex-col px-6 py-6 sm:px-8 lg:px-12 lg:py-7 xl:px-16 2xl:px-20">
        <div className="mb-5 space-y-3 empty:mb-0 empty:hidden">
          <WebPreviewBanner />
          <WindowsAdministratorBanner />
          <CliStatusBanner />
          <TmuxStatusBanner />
        </div>

        <header className="mb-6">
          <p className="mb-2 text-sm font-medium tracking-wide text-indigo-700/80 dark:text-indigo-300/80">
            {APP_NAME}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            {t('hero.title')}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-text-secondary lg:text-lg">
            {t('hero.subtitle')}
          </p>
        </header>

        <div
          className={`mb-6 grid gap-4 ${
            showProjectSearch
              ? 'lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]'
              : 'max-w-2xl'
          }`}
        >
          <button
            type="button"
            onClick={openTeamsTab}
            className="bg-surface-raised/80 group flex min-h-[148px] flex-col justify-between rounded-xl border border-border p-5 text-left transition-all duration-200 hover:border-indigo-500/35 hover:bg-surface-raised hover:shadow-[0_12px_40px_rgba(15,23,42,0.18)]"
          >
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface-overlay transition-colors group-hover:border-indigo-500/30">
              <Users className="size-5 text-indigo-700 dark:text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-text">
                {showCreateTeamAction ? t('actions.createTeam') : t('actions.selectTeam')}
                <ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-secondary" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {showCreateTeamAction
                  ? t('hero.createTeamDescription')
                  : t('hero.selectTeamDescription')}
              </p>
            </div>
          </button>

          {showProjectSearch ? (
            <CommandSearch value={searchQuery} onChange={setSearchQuery} />
          ) : null}
        </div>

        <RunningTeamsSection searchQuery={searchQuery} />

        <section className="flex min-h-0 flex-1 flex-col">
          <DashboardSectionHeading
            title={
              searchQuery.trim() ? t('recentProjects.searchResults') : t('recentProjects.title')
            }
            action={
              searchQuery.trim() ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-text-muted transition-colors hover:text-text-secondary"
                >
                  {t('actions.clearSearch')}
                </button>
              ) : undefined
            }
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <RecentProjectsSection searchQuery={searchQuery} section={recentProjectsSection} />
          </div>
        </section>
      </div>
    </div>
  );
};
