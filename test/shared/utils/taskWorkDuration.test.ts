import { describe, expect, it } from 'vitest';

import {
  calculateTaskImplementationDuration,
  formatTaskImplementationDuration,
  shouldShowTaskImplementationDuration,
} from '@shared/utils/taskWorkDuration';

describe('taskWorkDuration', () => {
  it('sums completed intervals and the current in-progress interval', () => {
    const duration = calculateTaskImplementationDuration(
      {
        status: 'in_progress',
        workIntervals: [
          {
            startedAt: '2026-05-08T10:00:00.000Z',
            completedAt: '2026-05-08T10:02:30.000Z',
          },
          { startedAt: '2026-05-08T10:05:00.000Z' },
        ],
      },
      Date.parse('2026-05-08T10:07:00.000Z')
    );

    expect(duration).toEqual({
      elapsedMs: 270_000,
      hasRunningInterval: true,
      countedIntervalCount: 2,
    });
    expect(shouldShowTaskImplementationDuration(duration)).toBe(true);
  });

  it('does not keep an open interval running after the task leaves in progress', () => {
    const duration = calculateTaskImplementationDuration(
      {
        status: 'completed',
        workIntervals: [
          {
            startedAt: '2026-05-08T10:00:00.000Z',
            completedAt: '2026-05-08T10:02:00.000Z',
          },
          { startedAt: '2026-05-08T10:05:00.000Z' },
        ],
      },
      Date.parse('2026-05-08T10:30:00.000Z')
    );

    expect(duration).toEqual({
      elapsedMs: 120_000,
      hasRunningInterval: false,
      countedIntervalCount: 1,
    });
  });

  it('merges overlapping intervals to avoid double counting malformed data', () => {
    const duration = calculateTaskImplementationDuration(
      {
        status: 'completed',
        workIntervals: [
          {
            startedAt: '2026-05-08T10:00:00.000Z',
            completedAt: '2026-05-08T10:10:00.000Z',
          },
          {
            startedAt: '2026-05-08T10:05:00.000Z',
            completedAt: '2026-05-08T10:12:00.000Z',
          },
        ],
      },
      Date.parse('2026-05-08T10:30:00.000Z')
    );

    expect(duration.elapsedMs).toBe(720_000);
    expect(duration.countedIntervalCount).toBe(2);
  });

  it('formats seconds, minutes, and hours for compact UI labels', () => {
    expect(formatTaskImplementationDuration(42_900)).toBe('42s');
    expect(formatTaskImplementationDuration(65_000)).toBe('1m 05s');
    expect(formatTaskImplementationDuration(7_260_000)).toBe('2h 01m');
  });
});
