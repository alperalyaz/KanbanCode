import { memo, useMemo } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { OngoingIndicator } from '@renderer/components/common/OngoingIndicator';
import { MemberBadge } from '@renderer/components/team/MemberBadge';
import { Button } from '@renderer/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useTheme } from '@renderer/hooks/useTheme';
import { REVIEW_STATE_DISPLAY } from '@renderer/utils/memberHelpers';
import {
  buildTaskChangeRequestOptions,
  canDisplayTaskChangesForOptions,
} from '@renderer/utils/taskChangeRequest';
import { deriveTaskDisplayId, formatTaskDisplayLabel } from '@shared/utils/taskIdentity';
import {
  isTeamTaskFinishedForDependency,
  isTeamTaskNeedsFixActionable,
} from '@shared/utils/teamTaskState';
import { ArrowLeftFromLine, ArrowRightFromLine, FileCode, HelpCircle } from 'lucide-react';

import type { KanbanColumnId, KanbanTaskState, TeamTask, TeamTaskWithKanban } from '@shared/types';

interface KanbanTaskCardProps {
  task: TeamTaskWithKanban;
  teamName: string;
  columnId: KanbanColumnId;
  kanbanTaskState?: KanbanTaskState;
  hasReviewers: boolean;
  compact?: boolean;
  taskMap: Map<string, TeamTask>;
  hasLiveTaskLogs?: boolean;
  onRequestReview: (taskId: string) => void;
  onApprove: (taskId: string) => void;
  onRequestChanges: (taskId: string) => void;
  onMoveBackToDone: (taskId: string) => void;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
  onScrollToTask?: (taskId: string) => void;
  onTaskClick?: (task: TeamTask) => void;
  onViewChanges?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

interface DependencyBadgeProps {
  taskId: string;
  taskMap: Map<string, TeamTask>;
  onScrollToTask?: (taskId: string) => void;
}

const taskCardSignatureCache = new WeakMap<TeamTaskWithKanban, string>();

function getTaskCardSignature(task: TeamTaskWithKanban): string {
  const cached = taskCardSignatureCache.get(task);
  if (cached !== undefined) return cached;

  const signature = JSON.stringify(task);
  taskCardSignatureCache.set(task, signature);
  return signature;
}

function areKanbanTaskStatesEqual(
  prev: KanbanTaskState | undefined,
  next: KanbanTaskState | undefined
): boolean {
  if (prev === next) return true;
  if (!prev || !next) return !prev && !next;
  return (
    prev.column === next.column &&
    prev.reviewer === next.reviewer &&
    prev.errorDescription === next.errorDescription &&
    prev.movedAt === next.movedAt
  );
}

function getTaskDependencyIds(task: TeamTaskWithKanban): string[] {
  return [...(task.blockedBy ?? []), ...(task.blocks ?? [])].filter((id) => id.length > 0);
}

function getDependencyTaskSignature(task: TeamTask | undefined): string {
  if (!task) return '';
  const kanbanTask = task as Partial<TeamTaskWithKanban>;
  return [
    task.id,
    task.displayId ?? '',
    task.subject,
    task.status,
    task.reviewState ?? '',
    kanbanTask.kanbanColumn ?? '',
  ].join('\u001f');
}

function areTaskMapDependenciesEqual(
  prevTask: TeamTaskWithKanban,
  nextTask: TeamTaskWithKanban,
  prevTaskMap: Map<string, TeamTask>,
  nextTaskMap: Map<string, TeamTask>
): boolean {
  const dependencyIds = new Set([
    ...getTaskDependencyIds(prevTask),
    ...getTaskDependencyIds(nextTask),
  ]);
  for (const taskId of dependencyIds) {
    if (
      getDependencyTaskSignature(prevTaskMap.get(taskId)) !==
      getDependencyTaskSignature(nextTaskMap.get(taskId))
    ) {
      return false;
    }
  }
  return true;
}

const DependencyBadge = ({
  taskId,
  taskMap,
  onScrollToTask,
}: DependencyBadgeProps): React.JSX.Element => {
  const depTask = taskMap.get(taskId);
  const isCompleted = depTask ? isTeamTaskFinishedForDependency(depTask) : false;
  const label = depTask
    ? `${formatTaskDisplayLabel(depTask)}: ${depTask.subject}`
    : `#${deriveTaskDisplayId(taskId)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            isCompleted
              ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400'
              : 'bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25 dark:text-yellow-300'
          } ${onScrollToTask ? 'cursor-pointer' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onScrollToTask?.(taskId);
          }}
        >
          {depTask ? formatTaskDisplayLabel(depTask) : `#${deriveTaskDisplayId(taskId)}`}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
};

const TruncatedTitle = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}): React.JSX.Element => (
  <h5
    className={`line-clamp-2 text-xs font-medium text-[var(--color-text)] ${className ?? ''}`}
    title={text}
  >
    {text}
  </h5>
);

interface TaskActionIconButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className: string;
  variant?: 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
}

const TaskActionIconButton = ({
  label,
  icon,
  onClick,
  className,
  variant = 'outline',
  disabled = false,
}: TaskActionIconButtonProps): React.JSX.Element => (
  <Button
    variant={variant}
    size="icon"
    className={`size-6 shrink-0 rounded-full shadow-sm ${className}`}
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
  >
    {icon}
  </Button>
);

interface TaskMetaActionsProps {
  taskId: string;
  changesNeedAttention: boolean;
  onViewChanges?: (taskId: string) => void;
}

// Comment-count badge removed: it added a whole row per card for information the
// user gets by opening the task anyway. Only the (conditional) changes button
// remains here.
const TaskMetaActions = memo(function TaskMetaActions({
  taskId,
  changesNeedAttention,
  onViewChanges,
}: TaskMetaActionsProps): React.JSX.Element | null {
  const { t } = useAppTranslation('team');

  if (!onViewChanges) {
    return null;
  }

  return (
    <TaskActionIconButton
      label={
        changesNeedAttention
          ? t('kanban.taskCard.changesNeedAttention')
          : t('kanban.taskCard.changes')
      }
      icon={<FileCode className="size-2.5" />}
      variant="ghost"
      className={
        changesNeedAttention
          ? 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300'
          : 'text-sky-700 hover:bg-sky-500/10 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300'
      }
      onClick={(e) => {
        e.stopPropagation();
        onViewChanges(taskId);
      }}
    />
  );
});

export const KanbanTaskCard = memo(
  function KanbanTaskCard({
    task,
    columnId,
    compact,
    taskMap,
    hasLiveTaskLogs = false,
    onScrollToTask,
    onTaskClick,
    onViewChanges,
  }: KanbanTaskCardProps): React.JSX.Element {
    const { t } = useAppTranslation('team');
    const { isLight } = useTheme();
    const blockedByIds = task.blockedBy?.filter((id) => id.length > 0) ?? [];
    const blocksIds = task.blocks?.filter((id) => id.length > 0) ?? [];
    const hasBlockedBy = blockedByIds.length > 0;
    const hasBlocks = blocksIds.length > 0;
    const shouldHighlightBlocked = hasBlockedBy && columnId !== 'done' && columnId !== 'approved';
    const cardSurfaceClass = isLight ? 'bg-white' : 'bg-[var(--color-surface-raised)]';

    const taskChangeRequestOptions = useMemo(() => buildTaskChangeRequestOptions(task), [task]);
    const canDisplay = useMemo(
      () => canDisplayTaskChangesForOptions(taskChangeRequestOptions) && !!onViewChanges,
      [taskChangeRequestOptions, onViewChanges]
    );

    const canOpenChanges =
      canDisplay &&
      (task.changePresence === 'has_changes' || task.changePresence === 'needs_attention');
    const changesNeedAttention = task.changePresence === 'needs_attention';

    return (
      <div
        data-task-id={task.id}
        className={`kanban-task-card relative cursor-pointer rounded-md border px-1.5 py-3 hover:border-[var(--color-border-emphasis)] ${
          shouldHighlightBlocked
            ? `border-yellow-500/30 ${cardSurfaceClass}`
            : `border-[var(--color-border)] ${cardSurfaceClass}`
        }`}
        role="button"
        tabIndex={0}
        onClick={() => onTaskClick?.(task)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTaskClick?.(task);
          }
        }}
      >
        <span className="absolute left-[3px] top-[2px] flex max-w-[calc(100%-72px)] items-center gap-1 text-[9px] leading-none text-[var(--color-text-muted)]">
          <span className="truncate">{formatTaskDisplayLabel(task)}</span>
          {hasLiveTaskLogs ? (
            <span aria-label={t('kanban.taskCard.taskLogsActive')} className="inline-flex">
              <OngoingIndicator size="sm" title={t('kanban.taskCard.newTaskLogsArriving')} />
            </span>
          ) : null}
        </span>
        {task.owner ? (
          <span className="absolute right-[6px] top-[2px]">
            <MemberBadge name={task.owner} size="xs" variant="neutral" />
          </span>
        ) : null}
        <div className="mb-2 pt-[11px]">
          {!compact && <TruncatedTitle text={task.subject} className="min-w-0" />}
          {!compact &&
          typeof task.description === 'string' &&
          task.description.trim() &&
          task.description.trim() !== task.subject.trim() ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
              {task.description.trim()}
            </p>
          ) : null}
          {task.needsClarification ? (
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                task.needsClarification === 'user'
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
              }`}
            >
              <HelpCircle size={10} />
              {task.needsClarification === 'user'
                ? t('kanban.taskCard.awaitingUser')
                : t('kanban.taskCard.awaitingLead')}
            </span>
          ) : null}
          {isTeamTaskNeedsFixActionable(task) ? (
            <span
              className={`mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${REVIEW_STATE_DISPLAY.needsFix.bg} ${REVIEW_STATE_DISPLAY.needsFix.text}`}
            >
              {REVIEW_STATE_DISPLAY.needsFix.label}
            </span>
          ) : null}
          {compact && <TruncatedTitle text={task.subject} className="mt-1" />}
        </div>

        {hasBlockedBy ? (
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-700 dark:text-yellow-300">
              <ArrowLeftFromLine size={10} />
              {t('kanban.taskCard.blockedBy')}
            </span>
            {blockedByIds.map((id) => (
              <DependencyBadge
                key={id}
                taskId={id}
                taskMap={taskMap}
                onScrollToTask={onScrollToTask}
              />
            ))}
          </div>
        ) : null}

        {hasBlocks ? (
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400">
              <ArrowRightFromLine size={10} />
              {t('kanban.taskCard.blocks')}
            </span>
            {blocksIds.map((id) => (
              <DependencyBadge
                key={id}
                taskId={id}
                taskMap={taskMap}
                onScrollToTask={onScrollToTask}
              />
            ))}
          </div>
        ) : null}

        {canOpenChanges ? (
          <div className="flex items-center justify-end gap-2">
            <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
              <TaskMetaActions
                taskId={task.id}
                changesNeedAttention={changesNeedAttention}
                onViewChanges={onViewChanges}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  },
  (prev, next) =>
    getTaskCardSignature(prev.task) === getTaskCardSignature(next.task) &&
    prev.teamName === next.teamName &&
    prev.columnId === next.columnId &&
    areKanbanTaskStatesEqual(prev.kanbanTaskState, next.kanbanTaskState) &&
    prev.hasReviewers === next.hasReviewers &&
    prev.compact === next.compact &&
    areTaskMapDependenciesEqual(prev.task, next.task, prev.taskMap, next.taskMap) &&
    prev.hasLiveTaskLogs === next.hasLiveTaskLogs &&
    prev.onRequestReview === next.onRequestReview &&
    prev.onApprove === next.onApprove &&
    prev.onRequestChanges === next.onRequestChanges &&
    prev.onMoveBackToDone === next.onMoveBackToDone &&
    prev.onStartTask === next.onStartTask &&
    prev.onCompleteTask === next.onCompleteTask &&
    prev.onCancelTask === next.onCancelTask &&
    prev.onScrollToTask === next.onScrollToTask &&
    prev.onTaskClick === next.onTaskClick &&
    prev.onViewChanges === next.onViewChanges &&
    prev.onDeleteTask === next.onDeleteTask
);
