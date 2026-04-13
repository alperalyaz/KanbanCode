import { describe, expect, it, vi } from 'vitest';

import { BoardTaskActivityDetailService } from '../../../../src/main/services/team/taskLogs/activity/BoardTaskActivityDetailService';

import type { BoardTaskActivityRecord } from '../../../../src/main/services/team/taskLogs/activity/BoardTaskActivityRecord';
import type { BoardTaskExactLogDetailCandidate } from '../../../../src/main/services/team/taskLogs/exact/BoardTaskExactLogTypes';

function makeRecord(overrides: Partial<BoardTaskActivityRecord> = {}): BoardTaskActivityRecord {
  return {
    id: 'record-1',
    timestamp: '2026-04-13T10:35:00.000Z',
    task: {
      locator: { ref: 'abc12345', refKind: 'display', canonicalId: 'task-a' },
      resolution: 'resolved',
      taskRef: {
        taskId: 'task-a',
        displayId: 'abc12345',
        teamName: 'demo',
      },
    },
    linkKind: 'board_action',
    targetRole: 'subject',
    actor: {
      memberName: 'bob',
      role: 'member',
      sessionId: 'session-1',
      agentId: 'agent-1',
      isSidechain: true,
    },
    actorContext: {
      relation: 'other_active_task',
      activePhase: 'work',
      activeTask: {
        locator: { ref: 'peer12345', refKind: 'display', canonicalId: 'task-b' },
        resolution: 'resolved',
        taskRef: {
          taskId: 'task-b',
          displayId: 'peer12345',
          teamName: 'demo',
        },
      },
    },
    action: {
      canonicalToolName: 'task_add_comment',
      toolUseId: 'tool-1',
      category: 'comment',
      details: {
        commentId: '42',
      },
    },
    source: {
      filePath: '/tmp/task.jsonl',
      messageUuid: 'msg-1',
      toolUseId: 'tool-1',
      sourceOrder: 1,
    },
    ...overrides,
  };
}

describe('BoardTaskActivityDetailService', () => {
  it('returns structured metadata and focused log detail for tool-backed activity', async () => {
    const record = makeRecord();
    const detailCandidate: BoardTaskExactLogDetailCandidate = {
      id: 'activity:record-1',
      timestamp: record.timestamp,
      actor: record.actor,
      source: record.source,
      records: [record],
      filteredMessages: [],
    };

    const service = new BoardTaskActivityDetailService(
      { getTaskRecords: vi.fn(async () => [record]) } as never,
      { parseFiles: vi.fn(async () => new Map([['/tmp/task.jsonl', []]])) } as never,
      { selectDetail: vi.fn(() => detailCandidate) } as never,
      { buildBundleChunks: vi.fn(() => [{ id: 'chunk-1' }]) } as never
    );

    const result = await service.getTaskActivityDetail('demo', 'task-a', 'record-1');

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      throw new Error('expected ok detail');
    }
    expect(result.detail.summaryLabel).toBe('Added a comment');
    expect(result.detail.actorLabel).toBe('bob');
    expect(result.detail.contextLines).toContain('while working on #peer12345');
    expect(result.detail.metadataRows).toEqual(
      expect.arrayContaining([
        { label: 'Task', value: '#abc12345' },
        { label: 'Tool', value: 'task_add_comment' },
        { label: 'Comment', value: '42' },
      ])
    );
    expect(result.detail.logDetail?.chunks).toEqual([{ id: 'chunk-1' }]);
  });

  it('returns metadata only for non-tool-backed activity without parsing transcript content', async () => {
    const record = makeRecord({
      id: 'record-2',
      source: {
        filePath: '/tmp/task.jsonl',
        messageUuid: 'msg-2',
        sourceOrder: 2,
      },
      action: {
        canonicalToolName: 'task_set_owner',
        category: 'assignment',
        details: {
          owner: 'alice',
        },
      },
    });
    const strictParser = { parseFiles: vi.fn(async () => new Map()) };
    const service = new BoardTaskActivityDetailService(
      { getTaskRecords: vi.fn(async () => [record]) } as never,
      strictParser as never,
      { selectDetail: vi.fn() } as never,
      { buildBundleChunks: vi.fn() } as never
    );

    const result = await service.getTaskActivityDetail('demo', 'task-a', 'record-2');

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      throw new Error('expected ok detail');
    }
    expect(result.detail.metadataRows).toEqual(
      expect.arrayContaining([{ label: 'Owner', value: 'alice' }])
    );
    expect(result.detail.logDetail).toBeUndefined();
    expect(strictParser.parseFiles).not.toHaveBeenCalled();
  });

  it('returns missing when the activity id does not exist', async () => {
    const service = new BoardTaskActivityDetailService(
      { getTaskRecords: vi.fn(async () => [makeRecord()]) } as never,
      { parseFiles: vi.fn() } as never,
      { selectDetail: vi.fn() } as never,
      { buildBundleChunks: vi.fn() } as never
    );

    await expect(service.getTaskActivityDetail('demo', 'task-a', 'missing-id')).resolves.toEqual({
      status: 'missing',
    });
  });
});
