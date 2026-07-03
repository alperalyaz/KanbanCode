import {
  getDefaultCreateTeamMemberConfigs,
  getNextSuggestedMemberName,
  isAsciiTurkishDefaultCreateTeamMemberNames,
  isLegacyDefaultCreateTeamMemberNames,
  remapAsciiTurkishMemberNames,
  remapLegacyDefaultCreateTeamMemberNames,
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

  it('suggests Turkish folktale hero names with diacritics for the Turkish locale', () => {
    expect(getNextSuggestedMemberName([], 'tr')).toBe('köroğlu');
    expect(getNextSuggestedMemberName(['köroğlu', 'alpamış'], 'tr')).toBe('boğaç');
    expect(getNextSuggestedMemberName(['koroglu', 'alpamis'], 'tr')).toBe('boğaç');
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
      'köroğlu',
      'alpamış',
      'boğaç',
    ]);
  });

  it('creates numeric suffixes when a themed name is already taken', () => {
    expect(getNextSuggestedMemberName(['frodo'], 'en')).toBe('sam');
    expect(getNextSuggestedMemberName(['frodo', 'sam', 'aragorn', 'legolas', 'gimli', 'gandalf'], 'en')).toBe(
      'galadriel'
    );
    expect(getNextSuggestedMemberName(['frodo', 'frodo-2'], 'en')).toBe('sam');
  });

  it('detects and remaps legacy default create-team member names', () => {
    expect(isLegacyDefaultCreateTeamMemberNames(['alice', 'tom', 'bob', 'jack'])).toBe(true);
    expect(isLegacyDefaultCreateTeamMemberNames(['Alice', 'Tom', 'Bob', 'Jack'])).toBe(true);
    expect(isLegacyDefaultCreateTeamMemberNames(['frodo', 'sam', 'aragorn', 'legolas'])).toBe(false);

    expect(remapLegacyDefaultCreateTeamMemberNames(['alice', 'tom', 'bob', 'jack'], 'tr')).toEqual([
      'selcan',
      'köroğlu',
      'alpamış',
      'boğaç',
    ]);
  });

  it('detects and remaps ASCII Turkish default member names', () => {
    expect(isAsciiTurkishDefaultCreateTeamMemberNames(['selcan', 'koroglu', 'alpamis', 'bogac'])).toBe(
      true
    );
    expect(remapAsciiTurkishMemberNames(['selcan', 'koroglu', 'alpamis', 'bogac'])).toEqual([
      'selcan',
      'köroğlu',
      'alpamış',
      'boğaç',
    ]);
  });
});
