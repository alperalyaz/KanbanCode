import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

import {
  __resetTeamSliceModuleStateForTests,
  createTeamSlice,
} from '../../../src/renderer/store/slices/teamSlice';

import type { AppState } from '../../../src/renderer/store/types';

const apiMock = vi.hoisted(() => ({
  teams: {
    list: vi.fn(),
    getAllTasks: vi.fn(),
    showMessageNotification: vi.fn(async () => undefined),
  },
}));

interface TeamSummaryLike {
  teamName: string;
  displayName: string;
  projectPath: string;
}

interface GlobalTaskLike {
  id: string;
  subject: string;
  status: string;
  teamName: string;
  teamDisplayName: string;
  projectPath: string;
  comments: [];
}

vi.mock('@renderer/api', () => ({
  api: apiMock,
}));

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function createSliceStore() {
  return create<AppState>()((set, get, store) =>
    ({
      ...createTeamSlice(set as never, get as never, store as never),
      activeContextId: 'local',
      appConfig: null,
      paneLayout: {
        focusedPaneId: 'pane-default',
        panes: [
          {
            id: 'pane-default',
            widthFraction: 1,
            tabs: [],
            activeTabId: null,
          },
        ],
      },
      openTab: vi.fn(),
      setActiveTab: vi.fn(),
      updateTabLabel: vi.fn(),
      getAllPaneTabs: vi.fn(() => []),
      warmTaskChangeSummaries: vi.fn(async () => undefined),
      invalidateTaskChangePresence: vi.fn(),
    }) as unknown as AppState
  );
}

describe('team slice context races', () => {
  beforeEach(() => {
    __resetTeamSliceModuleStateForTests();
    apiMock.teams.list.mockReset();
    apiMock.teams.getAllTasks.mockReset();
    apiMock.teams.showMessageNotification.mockClear();
  });

  afterEach(() => {
    __resetTeamSliceModuleStateForTests();
    vi.restoreAllMocks();
  });

  it('ignores a team list response loaded for a previous context', async () => {
    const store = createSliceStore();
    const localList = deferred<TeamSummaryLike[]>();
    apiMock.teams.list.mockReturnValueOnce(localList.promise);

    const fetchPromise = store.getState().fetchTeams();
    expect(store.getState().teamsLoading).toBe(true);

    store.setState({
      activeContextId: 'ssh-dev',
      teams: [],
      teamByName: {},
      teamBySessionId: {},
      teamsLoading: false,
    });
    localList.resolve([
      {
        teamName: 'local-team',
        displayName: 'Local Team',
        projectPath: '/local/project',
      },
    ]);
    await fetchPromise;

    expect(store.getState().teams).toEqual([]);
    expect(store.getState().teamByName).toEqual({});
    expect(store.getState().teamsLoading).toBe(false);
  });

  it('reruns a pending global task refresh for the current context instead of applying stale tasks', async () => {
    const store = createSliceStore();
    const localTasks = deferred<GlobalTaskLike[]>();
    apiMock.teams.getAllTasks.mockReturnValueOnce(localTasks.promise).mockResolvedValueOnce([
      {
        id: 'ssh-task',
        subject: 'SSH task',
        status: 'todo',
        teamName: 'ssh-team',
        teamDisplayName: 'SSH Team',
        projectPath: '/ssh/project',
        comments: [],
      },
    ]);

    const firstFetch = store.getState().fetchAllTasks();
    expect(store.getState().globalTasksLoading).toBe(true);

    store.setState({
      activeContextId: 'ssh-dev',
      globalTasks: [],
      globalTasksLoading: false,
      globalTasksInitialized: false,
    });
    const secondFetch = store.getState().fetchAllTasks();

    localTasks.resolve([
      {
        id: 'local-task',
        subject: 'Local task',
        status: 'todo',
        teamName: 'local-team',
        teamDisplayName: 'Local Team',
        projectPath: '/local/project',
        comments: [],
      },
    ]);

    await Promise.all([firstFetch, secondFetch]);

    expect(apiMock.teams.getAllTasks).toHaveBeenCalledTimes(2);
    expect(store.getState().globalTasks).toEqual([
      expect.objectContaining({ id: 'ssh-task', teamName: 'ssh-team' }),
    ]);
    expect(store.getState().globalTasksInitialized).toBe(true);
    expect(store.getState().globalTasksLoading).toBe(false);
  });
});
