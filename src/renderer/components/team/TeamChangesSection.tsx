import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@renderer/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useStore } from '@renderer/store';
import { resolveTaskChangePresenceFromResult } from '@renderer/utils/taskChangePresence';
import {
  buildTaskChangeRequestOptions,
  canDisplayTaskChangesForOptions,
  type TaskChangeRequestOptions,
} from '@renderer/utils/taskChangeRequest';
import { deriveTaskDisplayId } from '@shared/utils/taskIdentity';
import { AlertTriangle, FileDiff, GitCompareArrows, Loader2, RefreshCw } from 'lucide-react';

import { FileIcon } from './editor/FileIcon';
import { CollapsibleTeamSection } from './CollapsibleTeamSection';

import type {
  FileChangeSummary,
  TaskChangeSetV2,
  TeamTaskChangeSummaryRequest,
  TeamTaskWithKanban,
} from '@shared/types';

const TEAM_CHANGES_AUTO_REFRESH_MS = 30_000;
const TEAM_CHANGES_MAX_REQUESTS = 120;
const TEAM_CHANGES_UNKNOWN_SCAN_LIMIT = 32;
const TEAM_CHANGES_MAX_RENDERED_FILE_ROWS = 300;

interface TeamChangesSectionProps {
  teamName: string;
  tasks: TeamTaskWithKanban[];
  onViewChanges: (taskId: string, filePath?: string) => void;
}

interface TeamChangeCandidate {
  task: TeamTaskWithKanban;
  options: TaskChangeRequestOptions;
  priority: number;
  isUnknownScan: boolean;
}

interface TeamChangeRequestPlan {
  requests: TeamTaskChangeSummaryRequest[];
  requestOptionsByTaskId: Map<string, TaskChangeRequestOptions>;
  eligibleCount: number;
  requestedCount: number;
  deferredCount: number;
  nextUnknownScanCursor: number;
}

interface TeamChangeSummaryState {
  taskId: string;
  changeSet: TaskChangeSetV2 | null;
  error?: string;
  options: TaskChangeRequestOptions;
  loadedAt: number;
}

interface TeamChangeStats {
  eligibleCount: number;
  requestedCount: number;
  deferredCount: number;
}

function getTaskTimeMs(task: TeamTaskWithKanban): number {
  const value = task.updatedAt ?? task.createdAt;
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function compareCandidateRecency(a: TeamChangeCandidate, b: TeamChangeCandidate): number {
  const priorityDelta = a.priority - b.priority;
  if (priorityDelta !== 0) return priorityDelta;
  return getTaskTimeMs(b.task) - getTaskTimeMs(a.task);
}

function rotateCandidates<T>(items: T[], cursor: number): T[] {
  if (items.length === 0) return items;
  const start = cursor % items.length;
  if (start === 0) return items;
  return [...items.slice(start), ...items.slice(0, start)];
}

function buildTeamChangeRequestPlan(
  tasks: TeamTaskWithKanban[],
  unknownScanCursor: number,
  forceFresh: boolean
): TeamChangeRequestPlan {
  const primary: TeamChangeCandidate[] = [];
  const active: TeamChangeCandidate[] = [];
  const unknown: TeamChangeCandidate[] = [];
  const seenTaskIds = new Set<string>();

  for (const task of tasks) {
    if (!task.id || task.status === 'deleted' || seenTaskIds.has(task.id)) {
      continue;
    }
    seenTaskIds.add(task.id);

    const options = buildTaskChangeRequestOptions(task, { summaryOnly: true });
    const presence = task.changePresence ?? 'unknown';
    const canDisplay = canDisplayTaskChangesForOptions(options);
    if (!canDisplay && presence !== 'has_changes' && presence !== 'needs_attention') {
      continue;
    }

    if (presence === 'has_changes') {
      primary.push({ task, options, priority: 0, isUnknownScan: false });
      continue;
    }
    if (presence === 'needs_attention') {
      primary.push({ task, options, priority: 1, isUnknownScan: false });
      continue;
    }
    if (options.stateBucket === 'active' && options.status === 'in_progress') {
      active.push({ task, options, priority: 2, isUnknownScan: false });
      continue;
    }
    if (presence === 'unknown') {
      unknown.push({ task, options, priority: 3, isUnknownScan: true });
    }
  }

  primary.sort(compareCandidateRecency);
  active.sort(compareCandidateRecency);
  unknown.sort(compareCandidateRecency);

  const unknownWindow = rotateCandidates(unknown, unknownScanCursor).slice(
    0,
    TEAM_CHANGES_UNKNOWN_SCAN_LIMIT
  );
  const selected = [...primary, ...active, ...unknownWindow].slice(0, TEAM_CHANGES_MAX_REQUESTS);
  const requestOptionsByTaskId = new Map<string, TaskChangeRequestOptions>();
  const requests = selected.map((candidate) => {
    const options = {
      ...candidate.options,
      summaryOnly: true,
      forceFresh: forceFresh ? true : candidate.options.forceFresh,
    };
    requestOptionsByTaskId.set(candidate.task.id, options);
    return {
      taskId: candidate.task.id,
      options,
    };
  });
  const eligibleCount = primary.length + active.length + unknown.length;
  const nextUnknownScanCursor =
    unknown.length > 0
      ? (unknownScanCursor + Math.min(TEAM_CHANGES_UNKNOWN_SCAN_LIMIT, unknown.length)) %
        unknown.length
      : 0;

  return {
    requests,
    requestOptionsByTaskId,
    eligibleCount,
    requestedCount: requests.length,
    deferredCount: Math.max(0, eligibleCount - requests.length),
    nextUnknownScanCursor,
  };
}

function getTaskChangeContributors(
  task: TeamTaskWithKanban,
  changeSet: TaskChangeSetV2 | null
): string[] {
  const names = new Set<string>();
  for (const contributor of changeSet?.scope.contributors ?? []) {
    if (contributor.memberName) names.add(contributor.memberName);
  }
  for (const name of changeSet?.scope.memberNames ?? []) {
    names.add(name);
  }
  if (changeSet?.scope.primaryMemberName) {
    names.add(changeSet.scope.primaryMemberName);
  }
  for (const file of changeSet?.files ?? []) {
    for (const name of file.ledgerSummary?.memberNames ?? []) {
      names.add(name);
    }
  }
  if (names.size === 0 && task.owner) {
    names.add(task.owner);
  }
  return [...names];
}

function getVisibleFileName(file: FileChangeSummary): string {
  const value = file.relativePath || file.filePath;
  return value.split('/').pop() ?? value;
}

function getTaskSummaryBadge(changeSet: TaskChangeSetV2 | null): string | undefined {
  if (!changeSet) return undefined;
  if (changeSet.totalFiles > 0) return `${changeSet.totalFiles} files`;
  if (changeSet.warnings.length > 0) return 'attention';
  return undefined;
}

function buildTasksFingerprint(tasks: TeamTaskWithKanban[]): string {
  return tasks
    .map((task) =>
      [
        task.id,
        task.status,
        task.owner ?? '',
        task.updatedAt ?? '',
        task.changePresence ?? 'unknown',
        task.workIntervals?.length ?? 0,
      ].join(':')
    )
    .join('|');
}

export const TeamChangesSection = memo(function TeamChangesSection({
  teamName,
  tasks,
  onViewChanges,
}: TeamChangesSectionProps): React.JSX.Element {
  const recordTaskChangePresence = useStore((s) => s.recordTaskChangePresence);
  const setSelectedTeamTaskChangePresence = useStore((s) => s.setSelectedTeamTaskChangePresence);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [summariesByTaskId, setSummariesByTaskId] = useState<
    Record<string, TeamChangeSummaryState>
  >({});
  const [stats, setStats] = useState<TeamChangeStats>({
    eligibleCount: 0,
    requestedCount: 0,
    deferredCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const requestSeqRef = useRef(0);
  const unknownScanCursorRef = useRef(0);
  const lastRequestedTasksFingerprintRef = useRef<string | null>(null);
  const tasksFingerprint = useMemo(() => buildTasksFingerprint(tasks), [tasks]);
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const visibleSummaries = useMemo(() => {
    return Object.values(summariesByTaskId)
      .map((summary) => ({ summary, task: taskMap.get(summary.taskId) }))
      .filter(
        (entry): entry is { summary: TeamChangeSummaryState; task: TeamTaskWithKanban } =>
          Boolean(entry.task) &&
          (Boolean(entry.summary.error) ||
            (entry.summary.changeSet?.files.length ?? 0) > 0 ||
            (entry.summary.changeSet?.warnings.length ?? 0) > 0)
      )
      .sort((a, b) => getTaskTimeMs(b.task) - getTaskTimeMs(a.task));
  }, [summariesByTaskId, taskMap]);

  const totalFiles = visibleSummaries.reduce(
    (sum, entry) => sum + (entry.summary.changeSet?.files.length ?? 0),
    0
  );
  const hiddenFileRows = Math.max(0, totalFiles - TEAM_CHANGES_MAX_RENDERED_FILE_ROWS);
  const badge = totalFiles > 0 ? totalFiles : visibleSummaries.length || undefined;

  const loadSummaries = useCallback(
    async ({
      forceFresh = false,
      showSpinner = false,
      preserveOnError = true,
    }: {
      forceFresh?: boolean;
      showSpinner?: boolean;
      preserveOnError?: boolean;
    } = {}): Promise<void> => {
      const plan = buildTeamChangeRequestPlan(tasks, unknownScanCursorRef.current, forceFresh);
      unknownScanCursorRef.current = plan.nextUnknownScanCursor;
      setStats({
        eligibleCount: plan.eligibleCount,
        requestedCount: plan.requestedCount,
        deferredCount: plan.deferredCount,
      });
      setError(null);

      if (plan.requests.length === 0) {
        setSummariesByTaskId({});
        return;
      }

      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await api.review.getTeamTaskChangeSummaries(teamName, plan.requests);
        if (requestSeqRef.current !== requestSeq) {
          return;
        }

        const currentTaskIds = new Set(tasks.map((task) => task.id));
        for (const item of response.items) {
          const changeSet = item.changeSet;
          const options = plan.requestOptionsByTaskId.get(item.taskId);
          if (!changeSet || !options) continue;

          const nextPresence = resolveTaskChangePresenceFromResult(changeSet);
          recordTaskChangePresence(teamName, item.taskId, options, nextPresence);
          setSelectedTeamTaskChangePresence(teamName, item.taskId, nextPresence ?? 'unknown');
        }

        setSummariesByTaskId((previous) => {
          const next: Record<string, TeamChangeSummaryState> = {};
          for (const [taskId, summary] of Object.entries(previous)) {
            if (currentTaskIds.has(taskId)) {
              next[taskId] = summary;
            }
          }
          for (const item of response.items) {
            const options = plan.requestOptionsByTaskId.get(item.taskId);
            if (!options) continue;
            next[item.taskId] = {
              taskId: item.taskId,
              changeSet: item.changeSet,
              error: item.error,
              options,
              loadedAt: Date.now(),
            };
          }
          return next;
        });
      } catch (err) {
        if (requestSeqRef.current !== requestSeq) {
          return;
        }
        if (!preserveOnError) {
          setSummariesByTaskId({});
        }
        setError(err instanceof Error ? err.message : 'Failed to load team changes');
      } finally {
        if (requestSeqRef.current === requestSeq) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [recordTaskChangePresence, setSelectedTeamTaskChangePresence, tasks, teamName]
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    requestSeqRef.current += 1;
    unknownScanCursorRef.current = 0;
    lastRequestedTasksFingerprintRef.current = null;
    setSummariesByTaskId({});
    setError(null);
    setStats({ eligibleCount: 0, requestedCount: 0, deferredCount: 0 });
  }, [teamName]);

  useEffect(() => {
    if (!sectionOpen || hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    lastRequestedTasksFingerprintRef.current = tasksFingerprint;
    void loadSummaries({ showSpinner: true, preserveOnError: false });
  }, [loadSummaries, sectionOpen, tasksFingerprint]);

  useEffect(() => {
    if (!sectionOpen || !hasLoadedRef.current) {
      return;
    }
    if (lastRequestedTasksFingerprintRef.current === tasksFingerprint) {
      return;
    }
    lastRequestedTasksFingerprintRef.current = tasksFingerprint;
    void loadSummaries({ showSpinner: false, preserveOnError: true });
  }, [loadSummaries, sectionOpen, tasksFingerprint]);

  useEffect(() => {
    if (!sectionOpen) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSummaries({ showSpinner: false, preserveOnError: true });
    }, TEAM_CHANGES_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadSummaries, sectionOpen]);

  const handleRefresh = useCallback(() => {
    void loadSummaries({ forceFresh: true, showSpinner: true, preserveOnError: false });
  }, [loadSummaries]);

  let remainingFileRows = TEAM_CHANGES_MAX_RENDERED_FILE_ROWS;

  return (
    <CollapsibleTeamSection
      sectionId="changes"
      title="Changes"
      icon={<FileDiff size={14} />}
      badge={badge}
      defaultOpen={false}
      onOpenChange={setSectionOpen}
      headerExtra={
        loading && !sectionOpen ? (
          <Loader2
            size={12}
            className="pointer-events-none animate-spin text-[var(--color-text-muted)]"
          />
        ) : sectionOpen ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="pointer-events-auto rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-section-hover)] hover:text-[var(--color-text)] disabled:opacity-50"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRefresh();
                }}
                disabled={loading || refreshing}
                aria-label="Refresh team changes"
              >
                <RefreshCw
                  size={12}
                  className={loading || refreshing ? 'animate-spin' : undefined}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Refresh</TooltipContent>
          </Tooltip>
        ) : null
      }
      contentClassName="pl-2.5"
    >
      {loading && visibleSummaries.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 size={14} className="animate-spin" />
          Loading changes...
        </div>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : visibleSummaries.length > 0 ? (
        <div className="space-y-2">
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {visibleSummaries.map(({ summary, task }) => {
              const changeSet = summary.changeSet;
              const files = changeSet?.files ?? [];
              const fileBudget = Math.max(0, remainingFileRows);
              const visibleFiles = files.slice(0, fileBudget);
              remainingFileRows -= visibleFiles.length;
              const contributors = getTaskChangeContributors(task, changeSet);
              const contributorLabel =
                contributors.length > 0 ? contributors.slice(0, 3).join(', ') : 'Unassigned';
              const extraContributors = Math.max(0, contributors.length - 3);
              const badgeText = getTaskSummaryBadge(changeSet);

              if (visibleFiles.length === 0 && !summary.error && !changeSet?.warnings.length) {
                return null;
              }

              return (
                <div
                  key={summary.taskId}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                >
                  <button
                    type="button"
                    className="flex w-full min-w-0 items-center gap-2 rounded-t-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-surface-raised)]"
                    onClick={() => onViewChanges(task.id)}
                  >
                    <span className="shrink-0 font-mono text-[10px] text-[var(--color-text-muted)]">
                      #{deriveTaskDisplayId(task.id)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-text)]">
                      {task.subject}
                    </span>
                    <span
                      className="hidden max-w-[180px] shrink-0 truncate text-[10px] text-[var(--color-text-muted)] sm:inline"
                      title={contributors.join(', ')}
                    >
                      {contributorLabel}
                      {extraContributors > 0 ? ` +${extraContributors}` : ''}
                    </span>
                    {badgeText ? (
                      <span className="shrink-0 rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        {badgeText}
                      </span>
                    ) : null}
                  </button>

                  {summary.error ? (
                    <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-2 py-1.5 text-xs text-red-400">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span className="min-w-0 truncate">{summary.error}</span>
                    </div>
                  ) : null}

                  {changeSet?.warnings.length ? (
                    <div className="space-y-1 border-t border-[var(--color-border)] px-2 py-1.5">
                      {changeSet.warnings.slice(0, 2).map((warning) => (
                        <div
                          key={warning}
                          className="flex items-center gap-2 text-xs text-[var(--step-warning-text)]"
                        >
                          <AlertTriangle size={13} className="shrink-0" />
                          <span className="min-w-0 truncate">{warning}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {visibleFiles.length > 0 ? (
                    <div className="border-t border-[var(--color-border)] py-0.5">
                      {visibleFiles.map((file) => (
                        <div
                          key={`${summary.taskId}:${file.filePath}`}
                          className="group flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-surface-raised)]"
                        >
                          <FileIcon fileName={getVisibleFileName(file)} className="size-3.5" />
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left font-mono text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                            onClick={() => onViewChanges(task.id, file.filePath)}
                            title={file.relativePath || file.filePath}
                          >
                            {file.relativePath || file.filePath}
                          </button>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {file.linesAdded > 0 ? (
                              <span className="text-emerald-400">+{file.linesAdded}</span>
                            ) : null}
                            {file.linesRemoved > 0 ? (
                              <span className="text-red-400">-{file.linesRemoved}</span>
                            ) : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border-emphasis)] hover:text-[var(--color-text)]"
                                  onClick={() => onViewChanges(task.id, file.filePath)}
                                  aria-label="Review diff"
                                >
                                  <GitCompareArrows size={13} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Review diff</TooltipContent>
                            </Tooltip>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {files.length > visibleFiles.length && fileBudget > 0 ? (
                    <div className="border-t border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-text-muted)]">
                      {files.length - visibleFiles.length} more files
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
            {refreshing ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" />
                Refreshing
              </span>
            ) : null}
            {hiddenFileRows > 0 ? <span>{hiddenFileRows} file rows hidden</span> : null}
            {stats.deferredCount > 0 ? (
              <span>{stats.deferredCount} tasks deferred this pass</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-1 py-1">
          <p className="text-xs text-[var(--color-text-muted)]">No file changes recorded</p>
          {stats.eligibleCount > 0 ? (
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Scanned {stats.requestedCount} of {stats.eligibleCount} candidate tasks
            </p>
          ) : null}
        </div>
      )}
    </CollapsibleTeamSection>
  );
});

TeamChangesSection.displayName = 'TeamChangesSection';
