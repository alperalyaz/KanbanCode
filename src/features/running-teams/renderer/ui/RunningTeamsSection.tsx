import { useAppTranslation } from '@features/localization/renderer';
import { TeamTaskStatusSummary } from '@renderer/components/team/TeamTaskStatusSummary';
import { ActivePulseIndicator } from '@renderer/components/ui/ActivePulseIndicator';
import { FolderOpen, UsersRound } from 'lucide-react';

import { useRunningTeamsSection } from '../hooks/useRunningTeamsSection';

import type { RunningTeamRowModel } from '../adapters/RunningTeamsSectionAdapter';
import type React from 'react';

interface RunningTeamsSectionProps {
  searchQuery: string;
}

function getRowTitle(row: RunningTeamRowModel): string {
  return row.projectPath ? `${row.displayName} - ${row.projectPath}` : row.displayName;
}

export function RunningTeamsSection({
  searchQuery,
}: Readonly<RunningTeamsSectionProps>): React.JSX.Element | null {
  const { t } = useAppTranslation('team');
  const { rows, hidden, openRunningTeam } = useRunningTeamsSection(searchQuery);

  if (hidden) {
    return null;
  }

  return (
    <section className="mb-14">
      <div className="mb-5 flex items-center">
        <h2 className="flex items-center gap-2.5 text-base font-semibold text-text">
          {t('runningTeams.title')}
          <span className="rounded-full border border-border bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-secondary">
            {rows.length}
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => openRunningTeam(row)}
            className="bg-surface/50 group relative flex min-w-0 items-start gap-3 overflow-hidden rounded-xl border border-border px-4 py-4 pr-10 text-left transition-all duration-200 hover:border-border-emphasis hover:bg-surface-raised"
            title={getRowTitle(row)}
          >
            <ActivePulseIndicator className="absolute right-3 top-3" />
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-overlay transition-colors group-hover:border-border-emphasis">
              <UsersRound className="size-5 transition-colors" style={{ color: row.iconColor }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-base font-semibold text-text">{row.displayName}</span>
              </span>
              <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
                <FolderOpen className="size-3.5 shrink-0" />
                <span className="truncate">{row.projectLabel}</span>
              </span>
              <TeamTaskStatusSummary
                counts={row.taskCounts}
                showProgress={false}
                iconSize={11}
                className="mt-1.5"
                countersClassName="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted"
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
