import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const showMessageNotificationMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@renderer/api', () => ({
  api: {
    teams: {
      showMessageNotification: showMessageNotificationMock,
    },
  },
}));

import {
  processGlobalTaskNotifications,
  resetGlobalTaskNotificationTrackerForTests,
} from '../teamGlobalTaskNotifications';

import type { AppConfig } from '@renderer/types/data';
import type { GlobalTask } from '@shared/types';

function buildTask(overrides: Partial<GlobalTask> = {}): GlobalTask {
  return {
    id: 'task-1',
    subject: 'Review the implementation',
    owner: 'alice',
    reviewer: '',
    status: 'in_progress',
    changePresence: 'unknown',
    comments: [],
    blockedBy: [],
    blocks: [],
    workIntervals: [],
    historyEvents: [],
    createdAt: '2026-07-01T18:00:00.000Z',
    updatedAt: '2026-07-01T18:01:00.000Z',
    teamName: 'team-a',
    teamDisplayName: 'Team A',
    ...overrides,
  } as GlobalTask;
}

function buildNotificationConfig(
  overrides: Partial<NonNullable<AppConfig['notifications']>> = {}
): NonNullable<AppConfig['notifications']> {
  return {
    enabled: true,
    soundEnabled: true,
    includeSubagentErrors: false,
    snoozedUntil: null,
    snoozeMinutes: 30,
    notifyOnLeadInbox: false,
    notifyOnUserInbox: true,
    notifyOnClarifications: true,
    notifyOnStatusChange: false,
    notifyOnTaskComments: true,
    notifyOnTaskCreated: false,
    notifyOnAllTasksCompleted: false,
    notifyOnCrossTeamMessage: false,
    notifyOnTeamLaunched: false,
    notifyOnToolApproval: true,
    statusChangeStatuses: ['review', 'completed'],
    statusChangeOnlySolo: false,
    ignoredRepositories: [],
    ...overrides,
  } as NonNullable<AppConfig['notifications']>;
}

describe('processGlobalTaskNotifications', () => {
  beforeEach(() => {
    showMessageNotificationMock.mockClear();
    resetGlobalTaskNotificationTrackerForTests();
  });

  afterEach(() => {
    resetGlobalTaskNotificationTrackerForTests();
  });

  it('keeps review requests visible when task comments are muted', () => {
    const oldTask = buildTask({ comments: [] });
    const newTask = buildTask({
      comments: [
        {
          id: 'comment-1',
          author: 'teammate',
          text: 'Regular task comment',
          createdAt: '2026-07-01T18:05:00.000Z',
          type: 'regular',
        },
        {
          id: 'comment-2',
          author: 'teammate',
          text: 'Please review this change',
          createdAt: '2026-07-01T18:06:00.000Z',
          type: 'review_request',
        },
      ],
    });

    processGlobalTaskNotifications({
      oldTasks: [oldTask],
      newTasks: [newTask],
      appConfig: {
        notifications: buildNotificationConfig({
          notifyOnTaskComments: false,
        }),
      } as AppConfig,
      teamByName: {},
      isInitialFetch: false,
    });

    expect(showMessageNotificationMock).toHaveBeenCalledTimes(2);
    expect(showMessageNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamEventType: 'task_comment',
        suppressToast: true,
      })
    );
    expect(showMessageNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamEventType: 'task_review_requested',
        suppressToast: false,
      })
    );
  });

  it('suppresses the review toast when notifications are disabled', () => {
    const oldTask = buildTask({ comments: [] });
    const newTask = buildTask({
      comments: [
        {
          id: 'comment-1',
          author: 'teammate',
          text: 'Please review this change',
          createdAt: '2026-07-01T18:06:00.000Z',
          type: 'review_request',
        },
      ],
    });

    processGlobalTaskNotifications({
      oldTasks: [oldTask],
      newTasks: [newTask],
      appConfig: {
        notifications: buildNotificationConfig({
          enabled: false,
        }),
      } as AppConfig,
      teamByName: {},
      isInitialFetch: false,
    });

    expect(showMessageNotificationMock).toHaveBeenCalledTimes(1);
    expect(showMessageNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamEventType: 'task_review_requested',
        suppressToast: true,
      })
    );
  });
});
