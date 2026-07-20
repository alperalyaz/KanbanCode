import { describe, expect, it } from 'vitest';

import {
  buildRemovedMemberReassignmentLeadNotice,
  listReassignmentCandidates,
  planRemovedMemberReassignments,
  selectPendingReassignmentsToAutoStart,
} from '../../../../src/main/services/team/RemovedMemberTaskReassigner';

describe('RemovedMemberTaskReassigner', () => {
  it('prefers healthy remaining teammates and skips the lead', () => {
    const candidates = listReassignmentCandidates({
      removedMemberName: 'Karagöz',
      remainingMembers: [
        { name: 'Lider', role: 'team-lead' },
        { name: 'Karagöz', role: 'developer', removedAt: Date.now() },
        { name: 'Beberuhi', role: 'architect' },
        { name: 'Hacivat', role: 'developer' },
        { name: 'Tiryaki', role: 'qa' },
      ],
      spawnStatuses: {
        Beberuhi: { status: 'online', runtimeAlive: true, updatedAt: 't' },
        Hacivat: { status: 'online', runtimeAlive: true, updatedAt: 't' },
        Tiryaki: { status: 'error', runtimeAlive: false, hardFailure: true, updatedAt: 't' },
      },
    });

    expect(candidates).toEqual(['Beberuhi', 'Hacivat']);
  });

  it('plans least-loaded reassignment with in_progress first', () => {
    const plan = planRemovedMemberReassignments({
      removedMemberName: 'Karagöz',
      remainingMembers: [
        { name: 'Lider', role: 'team-lead' },
        { name: 'Beberuhi', role: 'architect' },
        { name: 'Hacivat', role: 'developer' },
      ],
      tasks: [
        {
          id: 'todo-1',
          displayId: 'aaaa1111',
          subject: 'Todo A',
          status: 'pending',
          owner: 'Karagöz',
        },
        {
          id: 'ip-1',
          displayId: 'c553a99c',
          subject: 'Backend review',
          status: 'in_progress',
          owner: 'Karagöz',
        },
        {
          id: 'todo-2',
          displayId: 'bbbb2222',
          subject: 'Todo B',
          status: 'pending',
          owner: 'Karagöz',
        },
        {
          id: 'other',
          displayId: 'cccc3333',
          subject: 'Other',
          status: 'pending',
          owner: 'Hacivat',
        },
      ],
    });

    expect(plan[0]).toMatchObject({
      taskId: 'ip-1',
      status: 'in_progress',
      toOwner: 'Beberuhi',
    });
    expect(plan.map((item) => item.toOwner)).toEqual(['Beberuhi', 'Beberuhi', 'Hacivat']);
  });

  it('builds an auto-reassign lead notice', () => {
    const notice = buildRemovedMemberReassignmentLeadNotice({
      removedMemberName: 'Karagöz',
      reassignments: [
        {
          taskId: 'ip-1',
          displayId: 'c553a99c',
          subject: 'Backend review',
          status: 'in_progress',
          fromOwner: 'Karagöz',
          toOwner: 'Beberuhi',
        },
      ],
    });

    expect(notice).toContain('AUTO-REASSIGNED');
    expect(notice).toContain('@Karagöz');
    expect(notice).toContain('#c553a99c');
    expect(notice).toContain('@Beberuhi');
    expect(notice).toContain('ownership is already fixed');
    expect(notice).toContain('do NOT write a cleanup essay');
  });

  it('auto-starts only unblocked pending work for owners without an in_progress handoff', () => {
    const selected = selectPendingReassignmentsToAutoStart({
      reassignments: [
        {
          taskId: 'ip-1',
          status: 'in_progress',
          fromOwner: 'Karagöz',
          toOwner: 'Beberuhi',
        },
        {
          taskId: 'p-1',
          status: 'pending',
          fromOwner: 'Karagöz',
          toOwner: 'Beberuhi',
        },
        {
          taskId: 'p-2',
          status: 'pending',
          fromOwner: 'Karagöz',
          toOwner: 'Hacivat',
        },
        {
          taskId: 'p-3',
          status: 'pending',
          fromOwner: 'Karagöz',
          toOwner: 'Tiryaki',
        },
      ],
      tasks: [
        { id: 'ip-1', status: 'in_progress', owner: 'Beberuhi' },
        { id: 'p-1', status: 'pending', owner: 'Beberuhi' },
        { id: 'p-2', status: 'pending', owner: 'Hacivat', blockedBy: ['ip-1'] },
        { id: 'p-3', status: 'pending', owner: 'Tiryaki' },
      ],
    });

    expect(selected.map((item) => item.taskId)).toEqual(['p-3']);
  });
});
