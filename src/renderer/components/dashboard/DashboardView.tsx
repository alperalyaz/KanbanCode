/**
 * DashboardView - Main dashboard shell.
 * Keeps only screen composition and delegates recent-projects logic to the feature slice.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { RecentProjectsSection } from '@features/recent-projects/renderer';
import { RunningTeamsSection } from '@features/running-teams/renderer';
import { useStore } from '@renderer/store';
import { formatShortcut } from '@renderer/utils/stringUtils';
import { ArrowRight, Command, Search, Users } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { CliStatusBanner } from './CliStatusBanner';
import { DashboardUpdateBanner } from './DashboardUpdateBanner';
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

  return (
    <div className="relative flex-1 overflow-auto bg-surface">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(99,102,241,0.14),transparent)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(ellipse_70%_45%_at_80%_0%,rgba(192,132,252,0.08),transparent)]"
        aria-hidden="true"
      />

      <div className="relative w-full px-6 py-14 sm:px-8 lg:px-12 lg:py-20 xl:px-16 2xl:px-20">
        <div className="mb-10 space-y-3">
          <WebPreviewBanner />
          <WindowsAdministratorBanner />
          <DashboardUpdateBanner />
          <CliStatusBanner />
          <TmuxStatusBanner />
        </div>

        <header className="mb-12 lg:mb-14">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-indigo-300/80">
            KanbanCode
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl lg:text-[2.75rem] lg:leading-tight xl:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mt-4 max-w-4xl text-base leading-relaxed text-text-secondary sm:text-lg xl:text-xl">
            {t('hero.subtitle')}
          </p>
        </header>

        <div className="mb-14 grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <button
            type="button"
            onClick={openTeamsTab}
            className="bg-surface-raised/80 group flex min-h-[148px] flex-col justify-between rounded-xl border border-border p-5 text-left transition-all duration-200 hover:border-indigo-500/35 hover:bg-surface-raised hover:shadow-[0_12px_40px_rgba(15,23,42,0.18)]"
          >
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface-overlay transition-colors group-hover:border-indigo-500/30">
              <Users className="size-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-text">
                {t('actions.selectTeam')}
                <ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-secondary" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {t('hero.selectTeamDescription')}
              </p>
            </div>
          </button>

          <CommandSearch value={searchQuery} onChange={setSearchQuery} />
        </div>

        <RunningTeamsSection searchQuery={searchQuery} />

        <section>
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
          <RecentProjectsSection searchQuery={searchQuery} />
        </section>
      </div>
    </div>
  );
};
