import { normalizePathForComparison } from '@shared/utils/platformPath';

import { normalizeHistoryPath } from './recentProjectOpenHistory';

import type { DashboardRecentProject } from '@features/recent-projects/contracts';

const RECENT_PROJECT_DISMISSALS_KEY = 'recent-projects:dismissed';
const RECENT_PROJECT_DISMISSALS_EVENT = 'recent-projects:dismissed-changed';
const MAX_DISMISSAL_ENTRIES = 200;

interface RecentProjectDismissalEntry {
  id: string;
  paths: string[];
  dismissedAt: number;
}

interface RecentProjectDismissalsState {
  version: 1;
  entries: RecentProjectDismissalEntry[];
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function collectProjectPaths(
  project: Pick<DashboardRecentProject, 'id' | 'primaryPath' | 'associatedPaths'>
): string[] {
  const paths = new Set<string>();

  for (const projectPath of [project.primaryPath, ...project.associatedPaths]) {
    const normalizedPath = normalizeHistoryPath(projectPath);
    if (normalizedPath) {
      paths.add(normalizedPath);
    }
  }

  if (project.id.trim()) {
    paths.add(normalizePathForComparison(project.id.trim()));
  }

  return Array.from(paths);
}

function readDismissalsState(): RecentProjectDismissalsState {
  if (!canUseLocalStorage()) {
    return { version: 1, entries: [] };
  }

  try {
    const raw = window.localStorage.getItem(RECENT_PROJECT_DISMISSALS_KEY);
    if (!raw) {
      return { version: 1, entries: [] };
    }

    const parsed = JSON.parse(raw) as Partial<RecentProjectDismissalsState>;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];

    return {
      version: 1,
      entries: entries
        .filter(
          (entry): entry is RecentProjectDismissalEntry =>
            !!entry &&
            typeof entry.id === 'string' &&
            Array.isArray(entry.paths) &&
            typeof entry.dismissedAt === 'number' &&
            Number.isFinite(entry.dismissedAt)
        )
        .map((entry) => ({
          id: entry.id,
          paths: entry.paths.filter((path): path is string => typeof path === 'string'),
          dismissedAt: entry.dismissedAt,
        })),
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

function writeDismissalsEntries(entries: readonly RecentProjectDismissalEntry[]): void {
  if (!canUseLocalStorage()) {
    return;
  }

  const nextState: RecentProjectDismissalsState = {
    version: 1,
    entries: entries.slice(0, MAX_DISMISSAL_ENTRIES),
  };

  try {
    window.localStorage.setItem(RECENT_PROJECT_DISMISSALS_KEY, JSON.stringify(nextState));
    window.dispatchEvent(new CustomEvent(RECENT_PROJECT_DISMISSALS_EVENT));
  } catch {
    // Best-effort persistence only.
  }
}

function createDismissalLookup(entries: readonly RecentProjectDismissalEntry[]): {
  ids: Set<string>;
  paths: Set<string>;
} {
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const entry of entries) {
    if (entry.id.trim()) {
      ids.add(normalizePathForComparison(entry.id.trim()));
    }
    for (const path of entry.paths) {
      const normalizedPath = normalizeHistoryPath(path) ?? normalizePathForComparison(path);
      if (normalizedPath) {
        paths.add(normalizedPath);
      }
    }
  }

  return { ids, paths };
}

export function isRecentProjectDismissed(
  project: Pick<DashboardRecentProject, 'id' | 'primaryPath' | 'associatedPaths'>,
  entries: readonly RecentProjectDismissalEntry[] = readDismissalsState().entries
): boolean {
  const lookup = createDismissalLookup(entries);
  const projectPaths = collectProjectPaths(project);

  if (lookup.ids.has(normalizePathForComparison(project.id.trim()))) {
    return true;
  }

  return projectPaths.some((path) => lookup.paths.has(path));
}

export function filterDismissedRecentProjects(
  projects: readonly DashboardRecentProject[]
): DashboardRecentProject[] {
  const entries = readDismissalsState().entries;
  if (entries.length === 0) {
    return [...projects];
  }

  return projects.filter((project) => !isRecentProjectDismissed(project, entries));
}

export function dismissRecentProject(
  project: Pick<DashboardRecentProject, 'id' | 'primaryPath' | 'associatedPaths'>
): void {
  const paths = collectProjectPaths(project);
  if (!project.id.trim() && paths.length === 0) {
    return;
  }

  const existing = readDismissalsState().entries.filter((entry) => entry.id !== project.id);
  writeDismissalsEntries([
    {
      id: project.id,
      paths,
      dismissedAt: Date.now(),
    },
    ...existing,
  ]);
}

export function subscribeRecentProjectDismissals(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleChange = (): void => listener();
  window.addEventListener(RECENT_PROJECT_DISMISSALS_EVENT, handleChange);
  return () => {
    window.removeEventListener(RECENT_PROJECT_DISMISSALS_EVENT, handleChange);
  };
}

export function resetRecentProjectDismissalsForTests(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(RECENT_PROJECT_DISMISSALS_KEY);
}
