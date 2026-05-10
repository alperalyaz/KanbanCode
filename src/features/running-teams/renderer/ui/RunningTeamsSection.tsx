import { TeamTaskStatusSummary } from '@renderer/components/team/TeamTaskStatusSummary';
import { ActivePulseIndicator } from '@renderer/components/ui/ActivePulseIndicator';
import { FolderOpen } from 'lucide-react';

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
  const { rows, hidden, openRunningTeam } = useRunningTeamsSection(searchQuery);

  if (hidden) {
    return null;
  }

  return (
    <section className="mb-12">
      <div className="mb-3 flex items-center">
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          Running Teams
          <span className="rounded-full border border-border bg-surface-overlay px-1.5 py-0.5 text-[10px] font-medium leading-none text-text-secondary">
            {rows.length}
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => openRunningTeam(row)}
            className="bg-surface/50 group relative flex min-w-0 items-start overflow-hidden rounded-lg border border-border px-3 py-2.5 pr-8 text-left transition-all duration-200 hover:border-border-emphasis hover:bg-surface-raised"
            style={{ borderLeftColor: row.accentColor }}
            title={getRowTitle(row)}
          >
            <ActivePulseIndicator className="absolute right-3 top-3" />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-text">{row.displayName}</span>
              </span>
              <span className="mt-1 flex min-w-0 items-center gap-1 text-[10px] text-text-muted">
                <FolderOpen className="size-3 shrink-0" />
                <span className="truncate">{row.projectLabel}</span>
              </span>
              <TeamTaskStatusSummary
                counts={row.taskCounts}
                showProgress={false}
                iconSize={11}
                className="mt-1.5"
                countersClassName="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-text-muted"
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
