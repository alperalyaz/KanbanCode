import {
  getDefaultCreateTeamMemberConfigs,
  getNextSuggestedMemberName,
  resolveMemberNameLocale,
} from '@renderer/components/team/members/memberNameSets';
import { describe, expect, it } from 'vitest';

describe('memberNameSets', () => {
  it('resolves only supported locales', () => {
    expect(resolveMemberNameLocale('tr')).toBe('tr');
    expect(resolveMemberNameLocale('en')).toBe('en');
    expect(resolveMemberNameLocale(undefined)).toBe('en');
  });

  it('suggests English fantasy names for the English locale', () => {
    expect(getNextSuggestedMemberName([], 'en')).toBe('frodo');
    expect(getNextSuggestedMemberName(['frodo', 'sam'], 'en')).toBe('aragorn');
  });

  it('suggests Turkish folktale hero names for the Turkish locale', () => {
    expect(getNextSuggestedMemberName([], 'tr')).toBe('koroglu');
    expect(getNextSuggestedMemberName(['koroglu', 'alpamis'], 'tr')).toBe('bogac');
  });

  it('keeps locale-specific default create-team members', () => {
    expect(getDefaultCreateTeamMemberConfigs('en').map((member) => member.name)).toEqual([
      'eowyn',
      'aragorn',
      'legolas',
      'gimli',
    ]);
    expect(getDefaultCreateTeamMemberConfigs('tr').map((member) => member.name)).toEqual([
      'selcan',
      'koroglu',
      'alpamis',
      'bogac',
    ]);
  });

  it('creates numeric suffixes when a themed name is already taken', () => {
    expect(getNextSuggestedMemberName(['frodo'], 'en')).toBe('sam');
    expect(getNextSuggestedMemberName(['frodo', 'sam', 'aragorn', 'legolas', 'gimli', 'gandalf'], 'en')).toBe(
      'galadriel'
    );
    expect(getNextSuggestedMemberName(['frodo', 'frodo-2'], 'en')).toBe('sam');
  });
});
