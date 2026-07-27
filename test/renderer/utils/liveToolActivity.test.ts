import { describe, expect, it } from 'vitest';

import {
  formatLiveToolLabel,
  selectPrimaryLiveTool,
  selectTeamRunningTools,
} from '@renderer/utils/liveToolActivity';

import type { ActiveToolCall } from '@shared/types';

function tool(partial: Partial<ActiveToolCall> & Pick<ActiveToolCall, 'toolUseId' | 'toolName'>): ActiveToolCall {
  return {
    memberName: 'team-lead',
    startedAt: '2026-07-09T18:00:00.000Z',
    state: 'running',
    source: 'runtime',
    ...partial,
  };
}

describe('liveToolActivity', () => {
  it('prefers the newest running tool', () => {
    const primary = selectPrimaryLiveTool({
      a: tool({
        toolUseId: 'a',
        toolName: 'Read',
        startedAt: '2026-07-09T18:00:00.000Z',
      }),
      b: tool({
        toolUseId: 'b',
        toolName: 'Bash',
        preview: 'ls',
        startedAt: '2026-07-09T18:01:00.000Z',
      }),
    });
    expect(primary?.toolUseId).toBe('b');
    expect(formatLiveToolLabel(primary!)).toContain('Bash');
  });

  it('falls back to finished tools when nothing is running', () => {
    const primary = selectPrimaryLiveTool(
      {},
      {
        a: tool({
          toolUseId: 'a',
          toolName: 'Edit',
          state: 'complete',
          finishedAt: '2026-07-09T18:02:00.000Z',
        }),
      }
    );
    expect(primary?.toolName).toBe('Edit');
  });

  it('lists running tools across the team newest-first', () => {
    const running = selectTeamRunningTools({
      lead: {
        a: tool({
          toolUseId: 'a',
          toolName: 'Read',
          memberName: 'lead',
          startedAt: '2026-07-09T18:00:00.000Z',
        }),
      },
      alice: {
        b: tool({
          toolUseId: 'b',
          toolName: 'Bash',
          memberName: 'alice',
          startedAt: '2026-07-09T18:03:00.000Z',
        }),
      },
    });
    expect(running.map((t) => t.toolUseId)).toEqual(['b', 'a']);
  });
});
