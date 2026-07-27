import {
  getDefaultCreateTeamMemberConfigs,
  getNextSuggestedMemberName,
  isAsciiTurkishDefaultCreateTeamMemberNames,
  isLegacyDefaultCreateTeamMemberNames,
  remapAsciiTurkishMemberNames,
  remapLegacyDefaultCreateTeamMemberNames,
  remapThemedMemberNames,
  resolveMemberNameLocale,
} from '@renderer/components/team/members/memberNameSets';
import { describe, expect, it } from 'vitest';

describe('memberNameSets', () => {
  it('resolves only supported locales', () => {
    expect(resolveMemberNameLocale('tr')).toBe('tr');
    expect(resolveMemberNameLocale('en')).toBe('en');
    expect(resolveMemberNameLocale(undefined)).toBe('en');
  });

  it('suggests English fantasy names with proper capitalization', () => {
    expect(getNextSuggestedMemberName([], 'en')).toBe('Frodo');
    expect(getNextSuggestedMemberName(['Frodo', 'Sam'], 'en')).toBe('Aragorn');
    expect(getNextSuggestedMemberName(['frodo', 'sam'], 'en')).toBe('Aragorn');
  });

  it('suggests Turkish folk-humour names with diacritics and capitalization', () => {
    expect(getNextSuggestedMemberName([], 'tr')).toBe('Karagöz');
    expect(getNextSuggestedMemberName(['Karagöz', 'Hacivat'], 'tr')).toBe('Beberuhi');
    expect(getNextSuggestedMemberName(['karagoz', 'hacivat'], 'tr')).toBe('Beberuhi');
    expect(getNextSuggestedMemberName(['karagöz', 'hacivat'], 'tr')).toBe('Beberuhi');
  });

  it('keeps locale-specific default create-team members', () => {
    expect(getDefaultCreateTeamMemberConfigs('en').map((member) => member.name)).toEqual([
      'Gandalf',
      'Aragorn',
      'Legolas',
      'Gimli',
    ]);
    expect(getDefaultCreateTeamMemberConfigs('tr').map((member) => member.name)).toEqual([
      'Beberuhi',
      'Karagöz',
      'Hacivat',
      'Tiryaki',
    ]);
  });

  it('starts every locale with an architect, two developers and a QA reviewer', () => {
    for (const locale of ['en', 'tr'] as const) {
      expect(getDefaultCreateTeamMemberConfigs(locale).map((m) => m.roleSelection)).toEqual([
        'architect',
        'developer',
        'developer',
        'qa',
      ]);
      expect(getDefaultCreateTeamMemberConfigs(locale).at(-1)?.workflowKind).toBe('reviewer');
    }
  });

  it('creates numeric suffixes when a themed name is already taken', () => {
    expect(getNextSuggestedMemberName(['Frodo'], 'en')).toBe('Sam');
    expect(
      getNextSuggestedMemberName(
        ['Frodo', 'Sam', 'Aragorn', 'Legolas', 'Gimli', 'Gandalf'],
        'en'
      )
    ).toBe('Galadriel');
    expect(getNextSuggestedMemberName(['Frodo', 'Frodo-2'], 'en')).toBe('Sam');
  });

  it('detects and remaps legacy default create-team member names', () => {
    expect(isLegacyDefaultCreateTeamMemberNames(['alice', 'tom', 'bob', 'jack'])).toBe(true);
    expect(isLegacyDefaultCreateTeamMemberNames(['Alice', 'Tom', 'Bob', 'Jack'])).toBe(true);
    expect(isLegacyDefaultCreateTeamMemberNames(['Frodo', 'Sam', 'Aragorn', 'Legolas'])).toBe(false);

    expect(remapLegacyDefaultCreateTeamMemberNames(['alice', 'tom', 'bob', 'jack'], 'tr')).toEqual([
      'Beberuhi',
      'Karagöz',
      'Hacivat',
      'Tiryaki',
    ]);
  });

  it('remaps ASCII and lowercase Turkish themed names to canonical capitalization', () => {
    expect(isAsciiTurkishDefaultCreateTeamMemberNames(['selcan', 'koroglu', 'alpamis', 'bogac'])).toBe(
      true
    );
    expect(remapAsciiTurkishMemberNames(['selcan', 'koroglu', 'alpamis', 'bogac'])).toEqual([
      'Selcan',
      'Köroğlu',
      'Alpamış',
      'Boğaç',
    ]);
    expect(remapThemedMemberNames(['köroğlu', 'boğaç', 'aslı'], 'tr')).toEqual([
      'Köroğlu',
      'Boğaç',
      'Aslı',
    ]);
    expect(remapThemedMemberNames(['eowyn', 'aragorn', 'legolas', 'gimli'], 'en')).toEqual([
      'Eowyn',
      'Aragorn',
      'Legolas',
      'Gimli',
    ]);
    expect(remapThemedMemberNames(['frodo', 'aragorn'], 'en')).toEqual(['Frodo', 'Aragorn']);
  });
});
