import {
  collectAgentIdIdentityAliases,
  collectMemberNameIdentityAliases,
  isOpenCodeOverlayMemberRemoved,
  matchesExactTeamMemberName,
  matchesMemberNameOrBase,
  matchesObservedAgentIdForExpected,
  matchesObservedMemberNameForExpected,
  matchesTeamMemberIdentity,
  namesMatchCaseInsensitive,
} from '@main/services/team/provisioning/TeamProvisioningMemberIdentity';
import { describe, expect, it } from 'vitest';

describe('TeamProvisioningMemberIdentity', () => {
  it('matches a member name against its auto-suffixed variants', () => {
    expect(matchesMemberNameOrBase('Builder', 'Builder')).toBe(true);
    expect(matchesMemberNameOrBase('Builder-2', 'Builder')).toBe(true);
    expect(matchesMemberNameOrBase('Builder-10', 'Builder')).toBe(true);
    expect(matchesMemberNameOrBase('Builder-1', 'Builder')).toBe(false);
    expect(matchesMemberNameOrBase('Builder 2', 'Builder')).toBe(false);
    expect(matchesMemberNameOrBase('Builder-2', 'builder')).toBe(false);
    expect(matchesMemberNameOrBase('Reviewer-2', 'Builder')).toBe(false);
  });

  it('matches team member identity in either direction', () => {
    expect(matchesTeamMemberIdentity('Builder-2', 'Builder')).toBe(true);
    expect(matchesTeamMemberIdentity('Builder', 'Builder-2')).toBe(true);
    expect(matchesTeamMemberIdentity('Builder-2', 'Builder-3')).toBe(false);
  });

  it('keeps observed-name matching one-directional', () => {
    expect(matchesObservedMemberNameForExpected('Builder-2', 'Builder')).toBe(true);
    expect(matchesObservedMemberNameForExpected('Builder', 'Builder-2')).toBe(false);
  });

  it('matches CLI ASCII-slug twins for Turkish member names', () => {
    expect(collectMemberNameIdentityAliases('Karagöz')).toEqual(['Karagöz', 'Karag-z']);
    expect(matchesObservedMemberNameForExpected('Karag-z', 'Karagöz')).toBe(true);
    expect(matchesObservedMemberNameForExpected('Karagöz', 'Karagöz')).toBe(true);
    expect(matchesObservedMemberNameForExpected('Karagöz', 'Karag-z')).toBe(false);
  });

  it('does not alias a slug when another expected member owns that slug', () => {
    expect(collectMemberNameIdentityAliases('Karagöz', ['Karagöz', 'Karag-z'])).toEqual([
      'Karagöz',
    ]);
    expect(matchesObservedMemberNameForExpected('Karag-z', 'Karagöz', ['Karagöz', 'Karag-z'])).toBe(
      false
    );
  });

  it('builds agent-id aliases for process matching', () => {
    expect(
      collectAgentIdIdentityAliases({
        agentId: 'Karagöz@codex-takimi',
        memberName: 'Karagöz',
        teamName: 'codex-takimi',
      })
    ).toEqual(['Karagöz@codex-takimi', 'Karag-z@codex-takimi']);
    expect(
      matchesObservedAgentIdForExpected({
        observedAgentId: 'Karag-z@codex-takimi',
        expectedAgentId: 'Karagöz@codex-takimi',
        memberName: 'Karagöz',
        teamName: 'codex-takimi',
      })
    ).toBe(true);
  });

  it('matches exact team member names case-insensitively after trimming', () => {
    expect(matchesExactTeamMemberName(' Builder ', 'builder')).toBe(true);
    expect(matchesExactTeamMemberName('', 'builder')).toBe(false);
    expect(matchesExactTeamMemberName('Builder-2', 'Builder')).toBe(false);
  });

  it('detects removed OpenCode overlay members case-insensitively', () => {
    expect(namesMatchCaseInsensitive(' Builder ', 'builder')).toBe(true);
    expect(namesMatchCaseInsensitive('Builder-2', 'Builder')).toBe(false);
    expect(
      isOpenCodeOverlayMemberRemoved(
        [
          { name: 'Reviewer', removedAt: undefined },
          { name: ' Builder ', removedAt: 123 },
        ],
        'builder'
      )
    ).toBe(true);
    expect(isOpenCodeOverlayMemberRemoved([{ name: 'Builder' }], 'builder')).toBe(false);
    expect(isOpenCodeOverlayMemberRemoved([{ removedAt: 123 }], 'builder')).toBe(false);
  });
});
