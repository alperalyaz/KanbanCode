import { useAppTranslation } from '@features/localization/renderer';
import { type DashboardRecentProject } from '@features/recent-projects/contracts';
import { Button } from '@renderer/components/ui/button';
import { FolderGit2, FolderOpen, Search } from 'lucide-react';

import { RecentProjectCard } from './RecentProjectCard';

import type { RecentProjectCardModel } from '../adapters/RecentProjectsSectionAdapter';

export type RecentProjectsSectionState = {
  cards: RecentProjectCardModel[];
  hasRecentProjects: boolean;
  loading: boolean;
  error: string | null;
  canLoadMore: boolean;
  isElectron: boolean;
  loadMore: () => void;
  reload: () => Promise<void>;
  openRecentProject: (project: DashboardRecentProject) => Promise<void>;
  openProjectPath: (projectPath: string) => Promise<void>;
  selectProjectFolder: () => Promise<void>;
  dismissRecentProject: (project: DashboardRecentProject) => void;
};

interface RecentProjectsSectionProps {
  searchQuery: string;
  section: RecentProjectsSectionState;
}

const titleWidths = [60, 66, 50, 55, 75, 45, 40, 65];
const pathWidths = [80, 75, 85, 66, 70, 80, 60, 72];

function SelectProjectFolderCard({
  onClick,
}: Readonly<{
  onClick: () => void;
}>): React.JSX.Element {
  const { t } = useAppTranslation('dashboard');
  return (
    <button
      className="hover:bg-surface/30 group relative flex min-h-[148px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-transparent p-5 transition-all duration-300 hover:border-border-emphasis"
      onClick={onClick}
      title={t('recentProjects.selectFolderTitle')}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-dashed border-border transition-colors duration-300 group-hover:border-border-emphasis">
        <FolderOpen className="size-5 text-text-muted transition-colors group-hover:text-text-secondary" />
      </div>
      <span className="text-sm font-medium text-text-secondary transition-colors group-hover:text-text">
        {t('recentProjects.selectFolder')}
      </span>
    </button>
  );
}

export const RecentProjectsSection = ({
  searchQuery,
  section,
}: Readonly<RecentProjectsSectionProps>): React.JSX.Element => {
  const { t } = useAppTranslation('dashboard');
  const {
    cards,
    loading,
    error,
    canLoadMore,
    isElectron,
    loadMore,
    reload,
    openRecentProject,
    openProjectPath,
    selectProjectFolder,
    dismissRecentProject,
  } = section;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="skeleton-card flex min-h-[148px] flex-col rounded-xl border border-border p-5"
            style={{
              animationDelay: `${index * 80}ms`,
              backgroundColor: 'var(--skeleton-base)',
            }}
          >
            <div
              className="mb-3 size-8 rounded-sm"
              style={{ backgroundColor: 'var(--skeleton-base-light)' }}
            />
            <div
              className="mb-2 h-3.5 rounded-sm"
              style={{
                width: `${titleWidths[index]}%`,
                backgroundColor: 'var(--skeleton-base-light)',
              }}
            />
            <div
              className="mb-auto h-2.5 rounded-sm"
              style={{
                width: `${pathWidths[index]}%`,
                backgroundColor: 'var(--skeleton-base-dim)',
              }}
            />
            <div className="mt-3 flex gap-2">
              <div
                className="h-2.5 w-16 rounded-sm"
                style={{ backgroundColor: 'var(--skeleton-base-dim)' }}
              />
              <div
                className="h-2.5 w-12 rounded-sm"
                style={{ backgroundColor: 'var(--skeleton-base-dim)' }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border px-10 py-20">
        <div className="flex size-14 items-center justify-center rounded-xl border border-border bg-surface-raised">
          <FolderGit2 className="size-7 text-text-muted" />
        </div>
        <div className="text-center">
          <p className="mb-2 text-lg font-medium text-text-secondary">
            {t('recentProjects.failedToLoad')}
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-text-muted">{error}</p>
        </div>
        <button
          onClick={() => void reload()}
          className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-emphasis hover:text-text"
        >
          {t('recentProjects.retry')}
        </button>
      </div>
    );
  }

  if (cards.length === 0 && searchQuery.trim()) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-10 py-20">
        <div className="mb-5 flex size-14 items-center justify-center rounded-xl border border-border bg-surface-raised">
          <Search className="size-7 text-text-muted" />
        </div>
        <p className="mb-2 text-lg font-medium text-text-secondary">
          {t('recentProjects.noProjects')}
        </p>
        <p className="text-sm text-text-muted">
          {t('recentProjects.noMatches', { query: searchQuery })}
        </p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-10 py-20">
        <div className="mb-5 flex size-14 items-center justify-center rounded-xl border border-border bg-surface-raised">
          <FolderGit2 className="size-7 text-text-muted" />
        </div>
        <p className="mb-2 text-lg font-medium text-text-secondary">
          {t('recentProjects.noRecentProjects')}
        </p>
        <p className="max-w-lg text-center text-sm leading-relaxed text-text-muted">
          {t('recentProjects.emptyDescription')}
        </p>
      </div>
    );
  }

  const hasSelectFolderCard = !searchQuery.trim() && isElectron;

  return (
    <div className="space-y-4">
      <div className="project-row-zebra-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {hasSelectFolderCard && (
          <SelectProjectFolderCard onClick={() => void selectProjectFolder()} />
        )}
        {cards.map((card) => (
          <RecentProjectCard
            key={card.id}
            card={card}
            onClick={() => void openRecentProject(card.project)}
            onOpenPath={() => void openProjectPath(card.project.primaryPath)}
            onDismiss={() => dismissRecentProject(card.project)}
          />
        ))}
      </div>

      {canLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadMore}>
            {t('recentProjects.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
};
