import { describe, expect, it } from 'vitest';

import {
  buildUnhealthyOwnerLeadNoticeText,
  isActiveOwnedTaskForUnhealthyOwner,
  listHealthyTeammateNames,
} from '../../../../../src/main/services/team/stallMonitor/UnhealthyOwnerLeadNotifier';

describe('UnhealthyOwnerLeadNotifier', () => {
  it('detects pending and in_progress ownership only', () => {
    expect(
      isActiveOwnedTaskForUnhealthyOwner(
        { id: 'a', status: 'in_progress', owner: 'Karagöz' },
        'Karagöz'
      )
    ).toBe(true);
    expect(
      isActiveOwnedTaskForUnhealthyOwner(
        { id: 'b', status: 'pending', owner: 'Karagöz' },
        'Karagöz'
      )
    ).toBe(true);
    expect(
      isActiveOwnedTaskForUnhealthyOwner(
        { id: 'c', status: 'completed', owner: 'Karagöz' },
        'Karagöz'
      )
    ).toBe(false);
    expect(
      isActiveOwnedTaskForUnhealthyOwner(
        { id: 'd', status: 'in_progress', owner: 'Beberuhi' },
        'Karagöz'
      )
    ).toBe(false);
  });

  it('lists healthy non-lead teammates', () => {
    const healthy = listHealthyTeammateNames({
      members: [
        { name: 'Lider', role: 'team-lead' },
        { name: 'Karagöz', role: 'developer' },
        { name: 'Beberuhi', role: 'developer' },
        { name: 'Hacivat', role: 'developer' },
      ],
      unhealthyMemberName: 'Karagöz',
      isHealthy: (name) => name === 'Beberuhi' || name === 'Hacivat',
    });

    expect(healthy).toEqual(['Beberuhi', 'Hacivat']);
  });

  it('builds a reassignment notice only when active owned work exists', () => {
    const message = buildUnhealthyOwnerLeadNoticeText({
      unhealthyMemberName: 'Karagöz',
      reason: 'stale runtime',
      healthyTeammates: ['Beberuhi', 'Hacivat'],
      ownedTasks: [
        {
          id: 'c553a99c-1111-2222-3333-444455556666',
          displayId: 'c553a99c',
          subject: 'Backend review',
          status: 'in_progress',
          owner: 'Karagöz',
        },
        {
          id: 'deadbeef-1111-2222-3333-444455556666',
          displayId: 'deadbeef',
          subject: 'Done work',
          status: 'completed',
          owner: 'Karagöz',
        },
      ],
    });

    expect(message).toContain('System notice: teammate @Karagöz is unhealthy');
    expect(message).toContain('stale runtime');
    expect(message).toContain('task_set_owner their pending AND in_progress');
    expect(message).toContain('@Beberuhi');
    expect(message).toContain('@Hacivat');
    expect(message).toContain('#c553a99c');
    expect(message).toContain('[in_progress]');
    expect(message).not.toContain('#deadbeef');
  });

  it('returns null when the unhealthy member owns no active work', () => {
    expect(
      buildUnhealthyOwnerLeadNoticeText({
        unhealthyMemberName: 'Karagöz',
        reason: 'stale runtime',
        healthyTeammates: ['Beberuhi'],
        ownedTasks: [
          {
            id: 'x',
            status: 'completed',
            owner: 'Karagöz',
          },
        ],
      })
    ).toBeNull();
  });
});
