import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const files = new Map<string, string>();
  const dirs = new Map<string, string[]>();

  // Normalize path separators so tests pass on Windows (backslash → forward slash)
  const norm = (p: string): string => p.replace(/\\/g, '/');

  const stat = vi.fn(async (filePath: string) => {
    const data = files.get(norm(filePath));
    if (data === undefined) {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    const signatureStride = Math.max(1, Math.floor(data.length / 128));
    let signatureValue = Buffer.byteLength(data, 'utf8');
    for (let i = 0; i < data.length; i += signatureStride) {
      signatureValue = (signatureValue * 33 + data.charCodeAt(i)) % 1_000_000_007;
    }
    return {
      isFile: () => true,
      size: Buffer.byteLength(data, 'utf8'),
      mtimeMs: signatureValue,
      ctimeMs: signatureValue,
      dev: 1,
      ino: signatureValue,
    };
  });

  const readdir = vi.fn(async (dirPath: string) => {
    const entries = dirs.get(norm(dirPath));
    if (!entries) {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return entries;
  });

  const readFile = vi.fn(async (filePath: string) => {
    const data = files.get(norm(filePath));
    if (data === undefined) {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return data;
  });

  return { files, dirs, stat, readdir, readFile };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: hoisted.stat,
      readdir: hoisted.readdir,
      readFile: hoisted.readFile,
    },
  };
});

vi.mock('../../../../src/main/utils/pathDecoder', () => ({
  getTeamsBasePath: () => '/mock/teams',
}));

import { TeamInboxReader } from '../../../../src/main/services/team/TeamInboxReader';

describe('TeamInboxReader', () => {
  let reader: TeamInboxReader;
  const inboxDir = '/mock/teams/my-team/inboxes';

  beforeEach(() => {
    reader = new TeamInboxReader();
    hoisted.files.clear();
    hoisted.dirs.clear();
    hoisted.stat.mockClear();
    hoisted.readdir.mockClear();
    hoisted.readFile.mockClear();
  });

  it('listInboxNames filters only visible json files', async () => {
    hoisted.dirs.set(inboxDir, ['alice.json', '.hidden.json', 'bob.json', 'note.txt']);

    const names = await reader.listInboxNames('my-team');
    expect(names).toEqual(['alice', 'bob']);
  });

  it('getMessagesFor returns empty for corrupted JSON', async () => {
    hoisted.files.set('/mock/teams/my-team/inboxes/alice.json', '{bad');
    const messages = await reader.getMessagesFor('my-team', 'alice');
    expect(messages).toEqual([]);
  });

  it('getMessages merges and sorts by newest timestamp', async () => {
    hoisted.dirs.set(inboxDir, ['alice.json', 'bob.json']);
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/alice.json',
      JSON.stringify([
        {
          from: 'alice',
          text: 'older',
          timestamp: '2026-01-01T00:00:00.000Z',
          read: false,
          messageId: 'm-1',
        },
      ])
    );
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/bob.json',
      JSON.stringify([
        {
          from: 'bob',
          text: 'newer',
          timestamp: '2026-01-02T00:00:00.000Z',
          read: false,
          messageId: 'm-2',
        },
      ])
    );

    const merged = await reader.getMessages('my-team');
    expect(merged).toHaveLength(2);
    expect(merged[0].text).toBe('newer');
    expect(merged[1].text).toBe('older');
  });

  it('caches getMessagesFor results while the inbox file signature is unchanged', async () => {
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/alice.json',
      JSON.stringify([
        {
          from: 'alice',
          text: 'cached',
          timestamp: '2026-01-01T00:00:00.000Z',
          read: false,
          messageId: 'm-1',
        },
      ])
    );

    const first = await reader.getMessagesFor('my-team', 'alice');
    first[0]!.to = 'mutated';
    const second = await reader.getMessagesFor('my-team', 'alice');

    expect(hoisted.stat).toHaveBeenCalledTimes(2);
    expect(hoisted.readFile).toHaveBeenCalledTimes(1);
    expect(second).toEqual([
      expect.objectContaining({
        messageId: 'm-1',
        text: 'cached',
        to: undefined,
      }),
    ]);
  });

  it('does not cache oversized parsed inbox payloads', async () => {
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/alice.json',
      JSON.stringify([
        {
          from: 'alice',
          text: 'x'.repeat(2_150_000),
          timestamp: '2026-01-01T00:00:00.000Z',
          read: false,
          messageId: 'm-large',
        },
      ])
    );

    const first = await reader.getMessagesFor('my-team', 'alice');
    const second = await reader.getMessagesFor('my-team', 'alice');

    expect(first[0]?.messageId).toBe('m-large');
    expect(second[0]?.messageId).toBe('m-large');
    expect(hoisted.readFile).toHaveBeenCalledTimes(2);
  });

  it('evicts old inbox payloads when the cache byte budget is exceeded', async () => {
    const memberCount = 18;
    for (let index = 0; index < memberCount; index++) {
      hoisted.files.set(
        `/mock/teams/my-team/inboxes/member-${index}.json`,
        JSON.stringify([
          {
            from: `member-${index}`,
            text: 'x'.repeat(950_000),
            timestamp: `2026-01-01T00:00:${String(index).padStart(2, '0')}.000Z`,
            read: false,
            messageId: `m-${index}`,
          },
        ])
      );
    }

    for (let index = 0; index < memberCount; index++) {
      await reader.getMessagesFor('my-team', `member-${index}`);
    }
    await reader.getMessagesFor('my-team', 'member-0');

    expect(hoisted.readFile).toHaveBeenCalledTimes(memberCount + 1);
  });

  it('re-reads getMessagesFor results when the inbox file signature changes', async () => {
    const inboxPath = '/mock/teams/my-team/inboxes/alice.json';
    hoisted.files.set(
      inboxPath,
      JSON.stringify([
        {
          from: 'alice',
          text: 'first',
          timestamp: '2026-01-01T00:00:00.000Z',
          read: false,
          messageId: 'm-1',
        },
      ])
    );
    expect((await reader.getMessagesFor('my-team', 'alice'))[0]?.text).toBe('first');

    hoisted.files.set(
      inboxPath,
      JSON.stringify([
        {
          from: 'alice',
          text: 'second',
          timestamp: '2026-01-01T00:00:01.000Z',
          read: false,
          messageId: 'm-2',
        },
      ])
    );

    expect((await reader.getMessagesFor('my-team', 'alice'))[0]?.text).toBe('second');
    expect(hoisted.readFile).toHaveBeenCalledTimes(2);
  });

  it('does not let getMessages recipient backfill mutate cached member inbox rows', async () => {
    hoisted.dirs.set(inboxDir, ['alice.json']);
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/alice.json',
      JSON.stringify([
        {
          from: 'alice',
          text: 'legacy recipient',
          timestamp: '2026-01-01T00:00:00.000Z',
          read: false,
          messageId: 'm-1',
        },
      ])
    );

    const merged = await reader.getMessages('my-team');
    const direct = await reader.getMessagesFor('my-team', 'alice');

    expect(merged[0]?.to).toBe('alice');
    expect(direct[0]?.to).toBeUndefined();
    expect(hoisted.readFile).toHaveBeenCalledTimes(1);
  });

  it('generates deterministic messageId for legacy inbox rows without messageId', async () => {
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/alice.json',
      JSON.stringify([
        {
          from: 'alice',
          text: 'legacy',
          timestamp: '2026-01-01T00:00:00.000Z',
          read: false,
        },
        {
          from: 'alice',
          text: 'supported',
          timestamp: '2026-01-01T01:00:00.000Z',
          read: false,
          messageId: 'm-1',
        },
      ])
    );

    const messages = await reader.getMessagesFor('my-team', 'alice');
    expect(messages).toHaveLength(2);
    const legacy = messages.find((m) => m.text === 'legacy');
    expect(legacy).toBeDefined();
    expect(legacy!.messageId).toBe('inbox-3d4d01c54fc0dc52');
    const supported = messages.find((m) => m.text === 'supported');
    expect(supported).toBeDefined();
    expect(supported!.messageId).toBe('m-1');
  });

  it('preserves task comment notification semantic kind', async () => {
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/alice.json',
      JSON.stringify([
        {
          from: 'bob',
          to: 'team-lead',
          text: 'Notification payload',
          timestamp: '2026-01-01T02:00:00.000Z',
          read: false,
          messageId: 'm-task-comment',
          source: 'system_notification',
          messageKind: 'task_comment_notification',
          summary: 'Comment on #abcd1234',
        },
      ])
    );

    const messages = await reader.getMessagesFor('my-team', 'alice');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: 'm-task-comment',
      source: 'system_notification',
      messageKind: 'task_comment_notification',
      summary: 'Comment on #abcd1234',
    });
  });

  it('preserves member-work-sync payload hash without changing visible message fields', async () => {
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/alice.json',
      JSON.stringify([
        {
          from: 'system',
          to: 'alice',
          text: 'Please reconcile current work.',
          timestamp: '2026-01-01T02:30:00.000Z',
          read: false,
          messageId: 'member-work-sync:my-team:alice:agenda',
          source: 'system_notification',
          messageKind: 'member_work_sync_nudge',
          workSyncIntent: 'agenda_sync',
          workSyncPayloadHash: 'sha256:work-sync',
        },
      ])
    );

    const messages = await reader.getMessagesFor('my-team', 'alice');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: 'member-work-sync:my-team:alice:agenda',
      messageKind: 'member_work_sync_nudge',
      workSyncIntent: 'agenda_sync',
      workSyncPayloadHash: 'sha256:work-sync',
    });
  });

  it('preserves task-stall remediation semantic kind', async () => {
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/alice.json',
      JSON.stringify([
        {
          from: 'system',
          to: 'alice',
          text: 'Please continue the stalled task or report a blocker.',
          timestamp: '2026-01-01T02:45:00.000Z',
          read: false,
          messageId: 'task-stall:my-team:alice:task-a',
          source: 'system_notification',
          messageKind: 'task_stall_remediation',
        },
      ])
    );

    const messages = await reader.getMessagesFor('my-team', 'alice');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: 'task-stall:my-team:alice:task-a',
      messageKind: 'task_stall_remediation',
    });
  });

  it('preserves agent error semantic kind from the team lead inbox', async () => {
    hoisted.files.set(
      '/mock/teams/my-team/inboxes/team-lead.json',
      JSON.stringify([
        {
          from: 'bob',
          to: 'team-lead',
          text: 'bob hit a mailbox turn execution error. API Error: Credit balance is too low',
          timestamp: '2026-01-01T03:00:00.000Z',
          read: false,
          messageId: 'm-agent-error',
          messageKind: 'agent_error',
          summary: 'Mailbox turn execution failed',
        },
      ])
    );

    const messages = await reader.getMessagesFor('my-team', 'team-lead');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: 'm-agent-error',
      to: 'team-lead',
      messageKind: 'agent_error',
      summary: 'Mailbox turn execution failed',
    });
  });
});
