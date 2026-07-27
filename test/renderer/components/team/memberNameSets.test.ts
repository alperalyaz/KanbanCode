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

  it('suggests English call-sign names with proper capitalization', () => {
    expect(getNextSuggestedMemberName([], 'en')).toBe('Atlas');
    expect(getNextSuggestedMemberName(['Atlas', 'Orion'], 'en')).toBe('Vega');
    expect(getNextSuggestedMemberName(['atlas', 'orion'], 'en')).toBe('Vega');
  });

  it('suggests Turkish call-sign names with diacritics and capitalization', () => {
    expect(getNextSuggestedMemberName([], 'tr')).toBe('Poyraz');
    expect(getNextSuggestedMemberName(['Poyraz', 'Şahin'], 'tr')).toBe('Bora');
    expect(getNextSuggestedMemberName(['poyraz', 'sahin'], 'tr')).toBe('Bora');
    expect(getNextSuggestedMemberName(['poyraz', 'şahin'], 'tr')).toBe('Bora');
  });

  it('keeps locale-specific default create-team members', () => {
    expect(getDefaultCreateTeamMemberConfigs('en').map((member) => member.name)).toEqual([
      'Atlas',
      'Orion',
      'Vega',
      'Lyra',
    ]);
    expect(getDefaultCreateTeamMemberConfigs('tr').map((member) => member.name)).toEqual([
      'Poyraz',
      'Şahin',
      'Bora',
      'Kartal',
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
    expect(getNextSuggestedMemberName(['Atlas'], 'en')).toBe('Orion');
    expect(
      getNextSuggestedMemberName(
        ['Atlas', 'Orion', 'Vega', 'Lyra', 'Rigel', 'Nova'],
        'en'
      )
    ).toBe('Altair');
    expect(getNextSuggestedMemberName(['Atlas', 'Atlas-2'], 'en')).toBe('Orion');
  });

  it('detects and remaps legacy default create-team member names', () => {
    expect(isLegacyDefaultCreateTeamMemberNames(['alice', 'tom', 'bob', 'jack'])).toBe(true);
    expect(isLegacyDefaultCreateTeamMemberNames(['Alice', 'Tom', 'Bob', 'Jack'])).toBe(true);
    expect(isLegacyDefaultCreateTeamMemberNames(['Atlas', 'Orion', 'Vega', 'Lyra'])).toBe(false);

    expect(remapLegacyDefaultCreateTeamMemberNames(['alice', 'tom', 'bob', 'jack'], 'tr')).toEqual([
      'Poyraz',
      'Şahin',
      'Bora',
      'Kartal',
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
    expect(remapThemedMemberNames(['altair', 'sirius', 'polaris', 'draco'], 'en')).toEqual([
      'Altair',
      'Sirius',
      'Polaris',
      'Draco',
    ]);
    expect(remapThemedMemberNames(['atlas', 'orion'], 'en')).toEqual(['Atlas', 'Orion']);
  });
});
