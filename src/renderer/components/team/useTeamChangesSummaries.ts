import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@renderer/api';
import { useStore } from '@renderer/store';
import { resolveTaskChangePresenceFromResult } from '@renderer/utils/taskChangePresence';

import {
  buildTeamChangeRequestPlan,
  buildTeamChangesTasksFingerprint,
} from './teamChangesRequestPlan';

import type { TaskChangeSetV2, TeamTaskWithKanban } from '@shared/types';

const TEAM_CHANGES_AUTO_REFRESH_MS = 30_000;

export interface TeamChangeSummaryState {
  taskId: string;
  changeSet: TaskChangeSetV2 | null;
  error?: string;
}

export interface TeamChangeStats {
  eligibleCount: number;
  requestedCount: number;
  deferredCount: number;
}

interface TeamChangesLoadOptions {
  forceFresh?: boolean;
  showSpinner?: boolean;
  preserveOnError?: boolean;
}

interface UseTeamChangesSummariesInput {
  teamName: string;
  tasks: TeamTaskWithKanban[];
  sectionOpen: boolean;
}

interface UseTeamChangesSummariesResult {
  summariesByTaskId: Record<string, TeamChangeSummaryState>;
  stats: TeamChangeStats;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTeamChangesSummaries({
  teamName,
  tasks,
  sectionOpen,
}: UseTeamChangesSummariesInput): UseTeamChangesSummariesResult {
  const recordTaskChangePresence = useStore((s) => s.recordTaskChangePresence);
  const setSelectedTeamTaskChangePresence = useStore((s) => s.setSelectedTeamTaskChangePresence);
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
  const [queuedRefreshTick, setQueuedRefreshTick] = useState(0);
  const hasLoadedRef = useRef(false);
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const activeRequestSeqRef = useRef<number | null>(null);
  const queuedRefreshOptionsRef = useRef<TeamChangesLoadOptions | null>(null);
  const sectionOpenRef = useRef(sectionOpen);
  const unknownScanCursorRef = useRef(0);
  const lastRequestedTasksFingerprintRef = useRef<string | null>(null);
  const tasksFingerprint = useMemo(
    () => (sectionOpen ? buildTeamChangesTasksFingerprint(tasks) : ''),
    [sectionOpen, tasks]
  );
  sectionOpenRef.current = sectionOpen;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestSeqRef.current += 1;
      activeRequestSeqRef.current = null;
      queuedRefreshOptionsRef.current = null;
    };
  }, []);

  const loadSummaries = useCallback(
    async ({
      forceFresh = false,
      showSpinner = false,
      preserveOnError = true,
    }: TeamChangesLoadOptions = {}): Promise<void> => {
      if (activeRequestSeqRef.current !== null || queuedRefreshOptionsRef.current !== null) {
        const previous = queuedRefreshOptionsRef.current;
        queuedRefreshOptionsRef.current = {
          forceFresh: Boolean(previous?.forceFresh || forceFresh),
          showSpinner: Boolean(previous?.showSpinner || showSpinner),
          preserveOnError: previous
            ? Boolean(previous.preserveOnError && preserveOnError)
            : preserveOnError,
        };
        requestSeqRef.current += 1;
        if (activeRequestSeqRef.current === null && sectionOpenRef.current) {
          setQueuedRefreshTick((value) => value + 1);
        }
        return;
      }

      const plan = buildTeamChangeRequestPlan(tasks, unknownScanCursorRef.current, forceFresh);
      unknownScanCursorRef.current = plan.nextUnknownScanCursor;
      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      setStats({
        eligibleCount: plan.eligibleCount,
        requestedCount: plan.requestedCount,
        deferredCount: plan.deferredCount,
      });
      setError(null);

      if (plan.requests.length === 0) {
        setSummariesByTaskId({});
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      activeRequestSeqRef.current = requestSeq;

      try {
        const response = await api.review.getTeamTaskChangeSummaries(teamName, plan.requests);
        if (!mountedRef.current || requestSeqRef.current !== requestSeq) {
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
            if (currentTaskIds.has(taskId) && plan.eligibleTaskIds.has(taskId)) {
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
            };
          }
          return next;
        });
      } catch (err) {
        if (!mountedRef.current || requestSeqRef.current !== requestSeq) {
          return;
        }
        if (!preserveOnError) {
          setSummariesByTaskId({});
        }
        setError(err instanceof Error ? err.message : 'Failed to load team changes');
      } finally {
        if (mountedRef.current) {
          const hasQueuedRefresh = queuedRefreshOptionsRef.current !== null;
          if (activeRequestSeqRef.current === requestSeq) {
            activeRequestSeqRef.current = null;
          }
          if (hasQueuedRefresh && activeRequestSeqRef.current === null && sectionOpenRef.current) {
            setQueuedRefreshTick((value) => value + 1);
          }
          const shouldStopIndicators =
            requestSeqRef.current === requestSeq ||
            (!hasQueuedRefresh && activeRequestSeqRef.current === null);
          if (shouldStopIndicators) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      }
    },
    [recordTaskChangePresence, setSelectedTeamTaskChangePresence, tasks, teamName]
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    requestSeqRef.current += 1;
    activeRequestSeqRef.current = null;
    queuedRefreshOptionsRef.current = null;
    unknownScanCursorRef.current = 0;
    lastRequestedTasksFingerprintRef.current = null;
    setSummariesByTaskId({});
    setError(null);
    setStats({ eligibleCount: 0, requestedCount: 0, deferredCount: 0 });
  }, [teamName]);

  useEffect(() => {
    if (!sectionOpen) {
      requestSeqRef.current += 1;
      activeRequestSeqRef.current = null;
      queuedRefreshOptionsRef.current = null;
      hasLoadedRef.current = false;
      lastRequestedTasksFingerprintRef.current = null;
      setSummariesByTaskId({});
      setError(null);
      setStats({ eligibleCount: 0, requestedCount: 0, deferredCount: 0 });
      setLoading(false);
      setRefreshing(false);
    }
  }, [sectionOpen]);

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
    if (!sectionOpen || activeRequestSeqRef.current !== null) {
      return;
    }
    const options = queuedRefreshOptionsRef.current;
    if (!options) {
      return;
    }
    queuedRefreshOptionsRef.current = null;
    void loadSummaries(options);
  }, [loadSummaries, queuedRefreshTick, sectionOpen]);

  useEffect(() => {
    if (!sectionOpen) {
      return;
    }

    const timer = window.setInterval(() => {
      if (activeRequestSeqRef.current !== null || queuedRefreshOptionsRef.current !== null) {
        return;
      }
      void loadSummaries({ showSpinner: false, preserveOnError: true });
    }, TEAM_CHANGES_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadSummaries, sectionOpen]);

  const refresh = useCallback(() => {
    void loadSummaries({ forceFresh: true, showSpinner: true, preserveOnError: false });
  }, [loadSummaries]);

  return {
    summariesByTaskId,
    stats,
    loading,
    refreshing,
    error,
    refresh,
  };
}
