import { normalizePath } from '@renderer/utils/pathNormalize';

import type { DashboardRecentProject } from '@features/recent-projects/contracts';

const RECENT_PROJECT_OPEN_HISTORY_KEY = 'recent-projects:open-history';
const RECENT_PROJECT_OPEN_HISTORY_EVENT = 'recent-projects:open-history-changed';
const OPEN_PRIORITY_WINDOW_MS = 1000 * 60 * 60 * 48;
const MAX_HISTORY_ENTRIES = 120;

interface RecentProjectOpenHistoryEntry {
  path: string;
  openedAt: number;
}

interface RecentProjectOpenHistoryState {
  version: 1;
  entries: RecentProjectOpenHistoryEntry[];
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeHistoryPath(projectPath: string): string | null {
  const trimmed = projectPath.trim();
  if (!trimmed) {
    return null;
  }
  return normalizePath(trimmed);
}

function readHistoryState(): RecentProjectOpenHistoryState {
  if (!canUseLocalStorage()) {
    return { version: 1, entries: [] };
  }

  try {
    const raw = window.localStorage.getItem(RECENT_PROJECT_OPEN_HISTORY_KEY);
    if (!raw) {
      return { version: 1, entries: [] };
    }

    const parsed = JSON.parse(raw) as Partial<RecentProjectOpenHistoryState>;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return {
      version: 1,
      entries: entries
        .filter(
          (entry): entry is RecentProjectOpenHistoryEntry =>
            !!entry &&
            typeof entry.path === 'string' &&
            typeof entry.openedAt === 'number' &&
            Number.isFinite(entry.openedAt)
        )
        .map((entry) => ({
          path: entry.path,
          openedAt: entry.openedAt,
        })),
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

function pruneEntries(
  entries: readonly RecentProjectOpenHistoryEntry[]
): RecentProjectOpenHistoryEntry[] {
  const byPath = new Map<string, number>();

  for (const entry of entries) {
    const normalizedPath = normalizeHistoryPath(entry.path);
    if (!normalizedPath) {
      continue;
    }
    byPath.set(normalizedPath, Math.max(byPath.get(normalizedPath) ?? 0, entry.openedAt));
  }

  return Array.from(byPath.entries())
    .map(([historyPath, openedAt]) => ({ path: historyPath, openedAt }))
    .sort((left, right) => right.openedAt - left.openedAt)
    .slice(0, MAX_HISTORY_ENTRIES);
}

function writeHistoryEntries(entries: readonly RecentProjectOpenHistoryEntry[]): void {
  if (!canUseLocalStorage()) {
    return;
  }

  const nextState: RecentProjectOpenHistoryState = {
    version: 1,
    entries: pruneEntries(entries),
  };

  try {
    window.localStorage.setItem(RECENT_PROJECT_OPEN_HISTORY_KEY, JSON.stringify(nextState));
    window.dispatchEvent(new CustomEvent(RECENT_PROJECT_OPEN_HISTORY_EVENT));
  } catch {
    // Best-effort persistence only.
  }
}

function createHistoryLookup(): Map<string, number> {
  return new Map(readHistoryState().entries.map((entry) => [entry.path, entry.openedAt]));
}

function getProjectPaths(
  project: Pick<DashboardRecentProject, 'primaryPath' | 'associatedPaths'>
): string[] {
  return [project.primaryPath, ...project.associatedPaths]
    .map((projectPath) => normalizeHistoryPath(projectPath))
    .filter((projectPath): projectPath is string => Boolean(projectPath));
}

export function recordRecentProjectOpenPaths(
  projectPaths: readonly string[],
  openedAt: number = Date.now()
): void {
  const normalizedPaths = Array.from(
    new Set(
      projectPaths
        .map((projectPath) => normalizeHistoryPath(projectPath))
        .filter((projectPath): projectPath is string => Boolean(projectPath))
    )
  );

  if (normalizedPaths.length === 0) {
    return;
  }

  const existing = readHistoryState().entries;
  writeHistoryEntries([
    ...existing,
    ...normalizedPaths.map((projectPath) => ({
      path: projectPath,
      openedAt,
    })),
  ]);
}

export function getRecentProjectLastOpenedAt(
  project: Pick<DashboardRecentProject, 'primaryPath' | 'associatedPaths'>
): number {
  const historyLookup = createHistoryLookup();
  return getProjectPaths(project).reduce(
    (latest, projectPath) => Math.max(latest, historyLookup.get(projectPath) ?? 0),
    0
  );
}

export function sortRecentProjectsByDisplayPriority(
  projects: readonly DashboardRecentProject[],
  now: number = Date.now()
): DashboardRecentProject[] {
  const historyLookup = createHistoryLookup();

  const getLastOpenedAt = (
    project: Pick<DashboardRecentProject, 'primaryPath' | 'associatedPaths'>
  ): number =>
    getProjectPaths(project).reduce(
      (latest, projectPath) => Math.max(latest, historyLookup.get(projectPath) ?? 0),
      0
    );

  const isPriorityOpen = (openedAt: number): boolean =>
    openedAt > 0 && now - openedAt <= OPEN_PRIORITY_WINDOW_MS;

  return [...projects].sort((left, right) => {
    const leftOpenedAt = getLastOpenedAt(left);
    const rightOpenedAt = getLastOpenedAt(right);
    const leftPriority = isPriorityOpen(leftOpenedAt);
    const rightPriority = isPriorityOpen(rightOpenedAt);

    if (leftPriority !== rightPriority) {
      return leftPriority ? -1 : 1;
    }

    if (leftPriority && rightPriority && leftOpenedAt !== rightOpenedAt) {
      return rightOpenedAt - leftOpenedAt;
    }

    if (left.mostRecentActivity !== right.mostRecentActivity) {
      return right.mostRecentActivity - left.mostRecentActivity;
    }

    if (leftOpenedAt !== rightOpenedAt) {
      return rightOpenedAt - leftOpenedAt;
    }

    return left.name.localeCompare(right.name);
  });
}

export function subscribeRecentProjectOpenHistory(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleChange = (): void => listener();
  window.addEventListener(RECENT_PROJECT_OPEN_HISTORY_EVENT, handleChange);
  return () => {
    window.removeEventListener(RECENT_PROJECT_OPEN_HISTORY_EVENT, handleChange);
  };
}

export function resetRecentProjectOpenHistoryForTests(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(RECENT_PROJECT_OPEN_HISTORY_KEY);
}
