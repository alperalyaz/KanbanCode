import { describe, expect, it } from 'vitest';

import {
  buildDefaultRoleDutyHint,
  classifyTeamMemberRole,
  listReviewOrientedMemberNames,
  pickPreferredReviewerName,
} from '../teamMemberRoles';

describe('teamMemberRoles', () => {
  it('classifies common English and Turkish role presets', () => {
    expect(classifyTeamMemberRole('Architect')).toBe('architect');
    expect(classifyTeamMemberRole('Mimar')).toBe('architect');
    expect(classifyTeamMemberRole('Developer')).toBe('developer');
    expect(classifyTeamMemberRole('Geliştirici')).toBe('developer');
    expect(classifyTeamMemberRole('QA')).toBe('qa');
    expect(classifyTeamMemberRole('Reviewer')).toBe('reviewer');
    expect(classifyTeamMemberRole('team-lead')).toBe('lead');
  });

  it('prefers QA over reviewer when picking a default reviewer', () => {
    expect(
      pickPreferredReviewerName([
        { name: 'Lider', role: 'team-lead' },
        { name: 'Beberuhi', role: 'architect' },
        { name: 'Hacivat', role: 'developer' },
        { name: 'Tiryaki', role: 'qa' },
        { name: 'Karagöz', role: 'reviewer' },
      ])
    ).toBe('Tiryaki');
  });

  it('lists review-oriented members and builds QA duty hints', () => {
    expect(
      listReviewOrientedMemberNames([
        { name: 'Tiryaki', role: 'qa' },
        { name: 'Hacivat', role: 'developer' },
        { name: 'Old', role: 'qa', removedAt: 1 },
      ])
    ).toEqual(['Tiryaki']);

    expect(buildDefaultRoleDutyHint('qa')).toContain('review/test');
    expect(buildDefaultRoleDutyHint('developer')).toContain('implement');
  });
});
