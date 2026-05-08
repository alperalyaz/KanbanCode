interface TaskWorkDurationIntervalLike {
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface TaskWorkDurationLike<
  TInterval extends TaskWorkDurationIntervalLike = TaskWorkDurationIntervalLike,
> {
  status?: string | null;
  workIntervals?: TInterval[] | null;
}

export interface TaskImplementationDuration {
  elapsedMs: number;
  hasRunningInterval: boolean;
  countedIntervalCount: number;
}

function parseIsoMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateTaskImplementationDuration<TInterval extends TaskWorkDurationIntervalLike>(
  task: TaskWorkDurationLike<TInterval> | null | undefined,
  nowMs = Date.now()
): TaskImplementationDuration {
  if (!task || !Array.isArray(task.workIntervals)) {
    return { elapsedMs: 0, hasRunningInterval: false, countedIntervalCount: 0 };
  }

  const windows: { startMs: number; endMs: number }[] = [];
  let hasRunningInterval = false;

  for (const interval of task.workIntervals) {
    const startMs = parseIsoMs(interval?.startedAt);
    if (startMs <= 0) continue;

    const completedAtMs = parseIsoMs(interval?.completedAt);
    if (completedAtMs > startMs) {
      windows.push({ startMs, endMs: completedAtMs });
      continue;
    }

    if (!interval?.completedAt && task.status === 'in_progress' && nowMs > startMs) {
      windows.push({ startMs, endMs: nowMs });
      hasRunningInterval = true;
    }
  }

  if (windows.length === 0) {
    return { elapsedMs: 0, hasRunningInterval, countedIntervalCount: 0 };
  }

  windows.sort((left, right) => left.startMs - right.startMs);

  const merged: { startMs: number; endMs: number }[] = [];
  for (const window of windows) {
    const previous = merged[merged.length - 1];
    if (previous && window.startMs <= previous.endMs) {
      previous.endMs = Math.max(previous.endMs, window.endMs);
    } else {
      merged.push({ ...window });
    }
  }

  const elapsedMs = merged.reduce((sum, window) => sum + (window.endMs - window.startMs), 0);
  return { elapsedMs, hasRunningInterval, countedIntervalCount: windows.length };
}

export function shouldShowTaskImplementationDuration(
  duration: TaskImplementationDuration
): boolean {
  return duration.elapsedMs > 0 || duration.hasRunningInterval;
}

export function formatTaskImplementationDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return `${totalMinutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
