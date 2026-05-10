import { CheckCircle, Clock, Play } from 'lucide-react';

import type { TaskStatusCounts } from '@renderer/utils/pathNormalize';
import type React from 'react';

interface TeamTaskStatusSummaryProps {
  counts?: TaskStatusCounts | null;
  className?: string;
  showProgress?: boolean;
  iconSize?: number;
  countersClassName?: string;
}

function normalizeCounts(counts?: TaskStatusCounts | null): TaskStatusCounts {
  return {
    pending: counts?.pending ?? 0,
    inProgress: counts?.inProgress ?? 0,
    completed: counts?.completed ?? 0,
  };
}

function getTaskStatusTotal(counts?: TaskStatusCounts | null): number {
  const normalized = normalizeCounts(counts);
  return normalized.pending + normalized.inProgress + normalized.completed;
}

export const TeamTaskStatusSummary = ({
  counts,
  className = 'mt-2 w-full space-y-1.5',
  showProgress = true,
  iconSize = 10,
  countersClassName = 'flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-text-muted)]',
}: Readonly<TeamTaskStatusSummaryProps>): React.JSX.Element | null => {
  const normalized = normalizeCounts(counts);
  const totalTasks = getTaskStatusTotal(normalized);
  const completedRatio = totalTasks > 0 ? normalized.completed / totalTasks : 0;

  if (!showProgress && totalTasks === 0) {
    return null;
  }

  return (
    <div className={className}>
      {showProgress && (
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-raised)]"
            role="progressbar"
            aria-valuenow={normalized.completed}
            aria-valuemin={0}
            aria-valuemax={totalTasks}
            aria-label={`Tasks ${normalized.completed}/${totalTasks} completed`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${Math.round(completedRatio * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] font-medium tracking-tight text-[var(--color-text-muted)]">
            {normalized.completed}/{totalTasks}
          </span>
        </div>
      )}
      {totalTasks > 0 && (
        <div className={countersClassName}>
          {normalized.inProgress > 0 && (
            <span className="inline-flex items-center gap-1">
              <Play size={iconSize} className="shrink-0 text-blue-400" />
              {normalized.inProgress} in_progress
            </span>
          )}
          {normalized.pending > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock size={iconSize} className="shrink-0 text-amber-400" />
              {normalized.pending} pending
            </span>
          )}
          {normalized.completed > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle size={iconSize} className="shrink-0 text-emerald-400" />
              {normalized.completed} completed
            </span>
          )}
        </div>
      )}
    </div>
  );
};
