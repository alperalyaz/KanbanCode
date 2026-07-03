import type { ResolvedAppLocale } from '@features/localization/contracts';

/** Fantasy-companion themed name pools used when suggesting new teammate ids. */
const MEMBER_NAME_SETS_BY_LOCALE = {
  en: [
    ['frodo', 'sam', 'aragorn', 'legolas', 'gimli', 'gandalf'],
    ['galadriel', 'eowyn', 'arwen', 'faramir', 'boromir', 'bilbo'],
    ['thorin', 'balin', 'bard', 'kili', 'fili', 'dwalin'],
    ['aslan', 'lucy', 'edmund', 'peter', 'susan', 'caspian'],
  ],
  tr: [
    ['köroğlu', 'alpamış', 'boğaç', 'ayvaz', 'selcan', 'dede'],
    ['salur', 'yiğen', 'uzun', 'baybora', 'melik', 'kara'],
    ['asena', 'alp', 'eren', 'mert', 'baran', 'aslı'],
    ['deniz', 'arda', 'kaan', 'ege', 'bora', 'nilay'],
  ],
} as const satisfies Record<ResolvedAppLocale, readonly (readonly string[])[]>;

/** Legacy ASCII spellings migrated to proper Turkish diacritics. */
const ASCII_TURKISH_MEMBER_NAME_MIGRATION: Readonly<Record<string, string>> = {
  koroglu: 'köroğlu',
  alpamis: 'alpamış',
  bogac: 'boğaç',
  yigen: 'yiğen',
  asli: 'aslı',
};

export interface DefaultCreateTeamMemberConfig {
  name: string;
  roleSelection: string;
  workflowKind?: 'reviewer';
}

const DEFAULT_CREATE_TEAM_MEMBERS_BY_LOCALE: Record<
  ResolvedAppLocale,
  readonly DefaultCreateTeamMemberConfig[]
> = {
  en: [
    { name: 'eowyn', roleSelection: 'reviewer', workflowKind: 'reviewer' },
    { name: 'aragorn', roleSelection: 'developer' },
    { name: 'legolas', roleSelection: 'developer' },
    { name: 'gimli', roleSelection: 'developer' },
  ],
  tr: [
    { name: 'selcan', roleSelection: 'reviewer', workflowKind: 'reviewer' },
    { name: 'köroğlu', roleSelection: 'developer' },
    { name: 'alpamış', roleSelection: 'developer' },
    { name: 'boğaç', roleSelection: 'developer' },
  ],
};

export function resolveMemberNameLocale(language?: string | null): ResolvedAppLocale {
  return language === 'tr' ? 'tr' : 'en';
}

export function getMemberNameSets(
  locale: ResolvedAppLocale = 'en'
): readonly (readonly string[])[] {
  return MEMBER_NAME_SETS_BY_LOCALE[locale];
}

export function getDefaultCreateTeamMemberConfigs(
  locale: ResolvedAppLocale = 'en'
): readonly DefaultCreateTeamMemberConfig[] {
  return DEFAULT_CREATE_TEAM_MEMBERS_BY_LOCALE[locale];
}

const LEGACY_DEFAULT_CREATE_TEAM_MEMBER_NAMES = ['alice', 'tom', 'bob', 'jack'] as const;

const ASCII_TURKISH_DEFAULT_CREATE_TEAM_MEMBER_NAMES = [
  'selcan',
  'koroglu',
  'alpamis',
  'bogac',
] as const;

export function isLegacyDefaultCreateTeamMemberNames(names: readonly string[]): boolean {
  if (names.length !== LEGACY_DEFAULT_CREATE_TEAM_MEMBER_NAMES.length) {
    return false;
  }

  const normalized = names.map(normalizeMemberName);
  return LEGACY_DEFAULT_CREATE_TEAM_MEMBER_NAMES.every(
    (legacyName, index) => normalized[index] === legacyName
  );
}

export function isAsciiTurkishDefaultCreateTeamMemberNames(names: readonly string[]): boolean {
  if (names.length !== ASCII_TURKISH_DEFAULT_CREATE_TEAM_MEMBER_NAMES.length) {
    return false;
  }

  const normalized = names.map(normalizeMemberName);
  return ASCII_TURKISH_DEFAULT_CREATE_TEAM_MEMBER_NAMES.every(
    (legacyName, index) => normalized[index] === legacyName
  );
}

export function remapLegacyDefaultCreateTeamMemberNames(
  names: readonly string[],
  locale: ResolvedAppLocale = 'en'
): readonly string[] {
  if (!isLegacyDefaultCreateTeamMemberNames(names)) {
    return names;
  }

  return getDefaultCreateTeamMemberConfigs(locale).map((member) => member.name);
}

export function remapAsciiTurkishMemberNames(names: readonly string[]): readonly string[] {
  let changed = false;
  const remapped = names.map((name) => {
    const migrated = ASCII_TURKISH_MEMBER_NAME_MIGRATION[normalizeMemberName(name)];
    if (migrated && migrated !== name) {
      changed = true;
      return migrated;
    }
    return name;
  });
  return changed ? remapped : names;
}

function normalizeMemberName(name: string): string {
  return name.trim().toLocaleLowerCase('tr');
}

function canonicalMemberNameForMatching(name: string, locale: ResolvedAppLocale): string {
  const normalized = normalizeMemberName(name);
  if (locale === 'tr') {
    return normalizeMemberName(ASCII_TURKISH_MEMBER_NAME_MIGRATION[normalized] ?? normalized);
  }
  return normalized;
}

function belongsToBaseName(name: string, baseName: string, locale: ResolvedAppLocale): boolean {
  const normalized = canonicalMemberNameForMatching(name, locale);
  const base = canonicalMemberNameForMatching(baseName, locale);
  return normalized === base || normalized.startsWith(`${base}-`);
}

function getPreferredNameSet(
  existingNames: readonly string[],
  locale: ResolvedAppLocale
): readonly string[] {
  const memberNameSets = getMemberNameSets(locale);

  for (const nameSet of memberNameSets) {
    if (
      nameSet.some((candidate) =>
        existingNames.some((name) => belongsToBaseName(name, candidate, locale))
      )
    ) {
      return nameSet;
    }
  }

  return memberNameSets[0];
}

function createUniqueName(baseName: string, existingNames: readonly string[]): string {
  const normalizedExisting = new Set(existingNames.map(normalizeMemberName));
  if (!normalizedExisting.has(normalizeMemberName(baseName))) {
    return baseName;
  }

  let suffix = 2;
  while (normalizedExisting.has(normalizeMemberName(`${baseName}-${suffix}`))) {
    suffix += 1;
  }

  return `${baseName}-${suffix}`;
}

function expandNormalizedMemberNames(
  names: readonly string[],
  locale: ResolvedAppLocale
): Set<string> {
  const expanded = new Set<string>();
  for (const name of names) {
    const normalized = normalizeMemberName(name);
    expanded.add(normalized);
    expanded.add(canonicalMemberNameForMatching(name, locale));

    if (locale === 'tr') {
      for (const [ascii, turkish] of Object.entries(ASCII_TURKISH_MEMBER_NAME_MIGRATION)) {
        if (normalizeMemberName(turkish) === normalized || ascii === normalized) {
          expanded.add(ascii);
          expanded.add(normalizeMemberName(turkish));
        }
      }
    }
  }
  return expanded;
}

export function getNextSuggestedMemberName(
  existingNames: readonly string[],
  locale: ResolvedAppLocale = 'en'
): string {
  const normalizedExisting = new Set(
    [...expandNormalizedMemberNames(existingNames, locale)].filter(Boolean)
  );
  const memberNameSets = getMemberNameSets(locale);
  const preferredSet = getPreferredNameSet(existingNames, locale);

  for (const candidate of preferredSet) {
    if (!normalizedExisting.has(normalizeMemberName(candidate))) {
      return candidate;
    }
  }

  for (const nameSet of memberNameSets) {
    for (const candidate of nameSet) {
      if (!normalizedExisting.has(normalizeMemberName(candidate))) {
        return candidate;
      }
    }
  }

  const fallbackBaseName = preferredSet[existingNames.length % preferredSet.length] ?? 'agent';
  return createUniqueName(fallbackBaseName, existingNames);
}

export const MEMBER_NAME_SETS = MEMBER_NAME_SETS_BY_LOCALE.en;
