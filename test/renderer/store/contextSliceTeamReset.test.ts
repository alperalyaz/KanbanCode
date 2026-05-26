import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestStore } from './storeTestUtils';

const apiMock = vi.hoisted(() => ({
  context: {
    switch: vi.fn(async () => undefined),
    list: vi.fn(async () => [{ id: 'local', type: 'local' }]),
    getActive: vi.fn(async () => 'local'),
    onChanged: vi.fn(() => () => undefined),
  },
  getProjects: vi.fn(async (): Promise<unknown[]> => []),
  getRepositoryGroups: vi.fn(async (): Promise<unknown[]> => []),
  notifications: {
    get: vi.fn(async () => ({
      notifications: [],
      total: 0,
      totalCount: 0,
      unreadCount: 0,
      hasMore: false,
    })),
  },
  teams: {
    list: vi.fn(async () => []),
    getAllTasks: vi.fn(async () => []),
    showMessageNotification: vi.fn(async () => undefined),
  },
  ssh: {
    connect: vi.fn(async () => ({ state: 'connected', host: 'dev', error: null })),
    disconnect: vi.fn(async () => ({ state: 'disconnected', host: null, error: null })),
    saveLastConnection: vi.fn(async () => undefined),
  },
}));

const contextStorageMock = vi.hoisted(() => ({
  saveSnapshot: vi.fn(async () => undefined),
  loadSnapshot: vi.fn(),
  cleanupExpired: vi.fn(async () => undefined),
  isAvailable: vi.fn(async () => true),
}));

const draftStorageMock = vi.hoisted(() => ({
  cleanupExpired: vi.fn(async () => undefined),
}));

vi.mock('@renderer/api', () => ({
  api: apiMock,
}));

vi.mock('@renderer/services/contextStorage', () => ({
  contextStorage: contextStorageMock,
}));

vi.mock('@renderer/services/draftStorage', () => ({
  draftStorage: draftStorageMock,
}));

function targetSnapshot() {
  return {
    projects: [
      {
        id: 'ssh-project',
        name: 'SSH Project',
        path: '/ssh/project',
        sessions: [],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
    selectedProjectId: null,
    repositoryGroups: [],
    selectedRepositoryId: null,
    selectedWorktreeId: null,
    viewMode: 'flat' as const,
    sessions: [],
    selectedSessionId: null,
    sessionsCursor: null,
    sessionsHasMore: false,
    sessionsTotalCount: 0,
    pinnedSessionIds: [],
    notifications: [],
    unreadCount: 0,
    openTabs: [],
    activeTabId: null,
    selectedTabIds: [],
    activeProjectId: null,
    paneLayout: {
      panes: [
        {
          id: 'pane-default',
          tabs: [],
          activeTabId: null,
          selectedTabIds: [],
          widthFraction: 1,
        },
      ],
      focusedPaneId: 'pane-default',
    },
    sidebarCollapsed: false,
    _metadata: {
      contextId: 'ssh-dev',
      capturedAt: Date.now(),
      version: 1,
    },
  };
}

describe('context slice team/task reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextStorageMock.loadSnapshot.mockResolvedValue(targetSnapshot());
    apiMock.context.getActive.mockResolvedValue('local');
    apiMock.getProjects.mockResolvedValue(targetSnapshot().projects);
    apiMock.getRepositoryGroups.mockResolvedValue([]);
    apiMock.teams.list.mockResolvedValue([]);
    apiMock.teams.getAllTasks.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops previous-context team and task caches before refreshing the target context', async () => {
    const store = createTestStore();
    store.setState({
      activeContextId: 'local',
      teams: [
        {
          teamName: 'local-team',
          displayName: 'Local Team',
          projectPath: '/local/project',
        },
      ],
      teamByName: {
        'local-team': {
          teamName: 'local-team',
          displayName: 'Local Team',
          projectPath: '/local/project',
        },
      },
      teamBySessionId: {},
      globalTasks: [
        {
          id: 'local-task',
          subject: 'Local task',
          status: 'todo',
          teamName: 'local-team',
          teamDisplayName: 'Local Team',
          projectPath: '/local/project',
          comments: [],
        },
      ],
      globalTasksInitialized: true,
      selectedTeamName: 'local-team',
      selectedTeamData: { teamName: 'local-team' },
      teamDataCacheByName: { 'local-team': { teamName: 'local-team' } },
    } as never);

    await store.getState().switchContext('ssh-dev');

    expect(store.getState().activeContextId).toBe('ssh-dev');
    expect(store.getState().teams).toEqual([]);
    expect(store.getState().teamByName).toEqual({});
    expect(store.getState().globalTasks).toEqual([]);
    expect(store.getState().selectedTeamName).toBeNull();
    expect(store.getState().selectedTeamData).toBeNull();
    expect(store.getState().teamDataCacheByName).toEqual({});
    expect(apiMock.teams.list).toHaveBeenCalledTimes(1);
    expect(apiMock.teams.getAllTasks).toHaveBeenCalledTimes(1);
  });

  it('drops previous-context team and task caches when lazy context initialization changes context', async () => {
    apiMock.context.getActive.mockResolvedValue('ssh-dev');
    const store = createTestStore();
    store.setState({
      activeContextId: 'local',
      teams: [
        {
          teamName: 'local-team',
          displayName: 'Local Team',
          projectPath: '/local/project',
        },
      ],
      teamByName: {
        'local-team': {
          teamName: 'local-team',
          displayName: 'Local Team',
          projectPath: '/local/project',
        },
      },
      globalTasks: [
        {
          id: 'local-task',
          subject: 'Local task',
          status: 'todo',
          teamName: 'local-team',
          teamDisplayName: 'Local Team',
          projectPath: '/local/project',
          comments: [],
        },
      ],
      globalTasksInitialized: true,
    } as never);

    await store.getState().initializeContextSystem();

    expect(store.getState().activeContextId).toBe('ssh-dev');
    expect(store.getState().teams).toEqual([]);
    expect(store.getState().teamByName).toEqual({});
    expect(store.getState().globalTasks).toEqual([]);
    expect(apiMock.teams.list).toHaveBeenCalledTimes(1);
    expect(apiMock.teams.getAllTasks).toHaveBeenCalledTimes(1);
  });

  it('drops previous-context team and task caches on direct SSH connect', async () => {
    const store = createTestStore();
    store.setState({
      activeContextId: 'local',
      teams: [
        {
          teamName: 'local-team',
          displayName: 'Local Team',
          projectPath: '/local/project',
        },
      ],
      teamByName: {
        'local-team': {
          teamName: 'local-team',
          displayName: 'Local Team',
          projectPath: '/local/project',
        },
      },
      globalTasks: [
        {
          id: 'local-task',
          subject: 'Local task',
          status: 'todo',
          teamName: 'local-team',
          teamDisplayName: 'Local Team',
          projectPath: '/local/project',
          comments: [],
        },
      ],
      globalTasksInitialized: true,
    } as never);

    await store.getState().connectSsh({
      host: 'dev',
      port: 22,
      username: 'me',
      authMethod: 'privateKey',
      privateKeyPath: '/tmp/key',
    });

    expect(store.getState().activeContextId).toBe('ssh-dev');
    expect(store.getState().teams).toEqual([]);
    expect(store.getState().teamByName).toEqual({});
    expect(store.getState().globalTasks).toEqual([]);
    expect(apiMock.teams.list).toHaveBeenCalledTimes(1);
    expect(apiMock.teams.getAllTasks).toHaveBeenCalledTimes(1);
  });

  it('drops previous-context team and task caches on direct SSH disconnect', async () => {
    const store = createTestStore();
    store.setState({
      activeContextId: 'ssh-dev',
      teams: [
        {
          teamName: 'ssh-team',
          displayName: 'SSH Team',
          projectPath: '/ssh/project',
        },
      ],
      teamByName: {
        'ssh-team': {
          teamName: 'ssh-team',
          displayName: 'SSH Team',
          projectPath: '/ssh/project',
        },
      },
      globalTasks: [
        {
          id: 'ssh-task',
          subject: 'SSH task',
          status: 'todo',
          teamName: 'ssh-team',
          teamDisplayName: 'SSH Team',
          projectPath: '/ssh/project',
          comments: [],
        },
      ],
      globalTasksInitialized: true,
    } as never);

    await store.getState().disconnectSsh();

    expect(store.getState().activeContextId).toBe('local');
    expect(store.getState().teams).toEqual([]);
    expect(store.getState().teamByName).toEqual({});
    expect(store.getState().globalTasks).toEqual([]);
    expect(apiMock.teams.list).toHaveBeenCalledTimes(1);
    expect(apiMock.teams.getAllTasks).toHaveBeenCalledTimes(1);
  });
});
