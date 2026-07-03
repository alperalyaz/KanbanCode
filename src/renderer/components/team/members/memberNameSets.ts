import type { ResolvedAppLocale } from '@features/localization/contracts';

function capitalizeMemberName(name: string, locale: ResolvedAppLocale): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return trimmed;
  }

  const localeTag = locale === 'tr' ? 'tr' : 'en';
  const lower = trimmed.toLocaleLowerCase(localeTag);
  const first = lower.charAt(0).toLocaleUpperCase(localeTag);
  return `${first}${lower.slice(1)}`;
}

/** Fantasy-companion themed name pools used when suggesting new teammate ids. */
const MEMBER_NAME_SETS_BY_LOCALE = {
  en: [
    ['Frodo', 'Sam', 'Aragorn', 'Legolas', 'Gimli', 'Gandalf'],
    ['Galadriel', 'Eowyn', 'Arwen', 'Faramir', 'Boromir', 'Bilbo'],
    ['Thorin', 'Balin', 'Bard', 'Kili', 'Fili', 'Dwalin'],
    ['Aslan', 'Lucy', 'Edmund', 'Peter', 'Susan', 'Caspian'],
  ],
  tr: [
    ['Köroğlu', 'Alpamış', 'Boğaç', 'Ayvaz', 'Selcan', 'Dede'],
    ['Salur', 'Yiğen', 'Uzun', 'Baybora', 'Melik', 'Kara'],
    ['Asena', 'Alp', 'Eren', 'Mert', 'Baran', 'Aslı'],
    ['Deniz', 'Arda', 'Kaan', 'Ege', 'Bora', 'Nilay'],
  ],
} as const satisfies Record<ResolvedAppLocale, readonly (readonly string[])[]>;

/** Legacy ASCII spellings migrated to proper Turkish display names. */
const ASCII_TURKISH_MEMBER_NAME_MIGRATION: Readonly<Record<string, string>> = {
  koroglu: 'Köroğlu',
  alpamis: 'Alpamış',
  bogac: 'Boğaç',
  yigen: 'Yiğen',
  asli: 'Aslı',
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
    { name: 'Eowyn', roleSelection: 'reviewer', workflowKind: 'reviewer' },
    { name: 'Aragorn', roleSelection: 'developer' },
    { name: 'Legolas', roleSelection: 'developer' },
    { name: 'Gimli', roleSelection: 'developer' },
  ],
  tr: [
    { name: 'Selcan', roleSelection: 'reviewer', workflowKind: 'reviewer' },
    { name: 'Köroğlu', roleSelection: 'developer' },
    { name: 'Alpamış', roleSelection: 'developer' },
    { name: 'Boğaç', roleSelection: 'developer' },
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

function buildCanonicalThemedMemberNameMap(
  locale: ResolvedAppLocale
): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};

  for (const nameSet of getMemberNameSets(locale)) {
    for (const name of nameSet) {
      map[normalizeMemberName(name)] = name;
    }
  }

  if (locale === 'tr') {
    for (const [ascii, canonical] of Object.entries(ASCII_TURKISH_MEMBER_NAME_MIGRATION)) {
      map[ascii] = canonical;
      map[normalizeMemberName(canonical)] = canonical;
    }
  }

  return map;
}

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

export function isDefaultTurkishCreateTeamMemberNames(names: readonly string[]): boolean {
  const defaults = getDefaultCreateTeamMemberConfigs('tr').map((member) => member.name);
  if (names.length !== defaults.length) {
    return false;
  }

  const normalized = names.map(normalizeMemberName);
  return defaults.every(
    (defaultName, index) => normalized[index] === normalizeMemberName(defaultName)
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
  return remapThemedMemberNames(names, 'tr');
}

export function remapThemedMemberNames(
  names: readonly string[],
  locale: ResolvedAppLocale
): readonly string[] {
  const canonicalByKey = buildCanonicalThemedMemberNameMap(locale);
  let changed = false;

  const remapped = names.map((name) => {
    const canonical = canonicalByKey[normalizeMemberName(name)];
    if (canonical && canonical !== name) {
      changed = true;
      return canonical;
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
  const canonicalByKey = buildCanonicalThemedMemberNameMap(locale);
  return normalizeMemberName(canonicalByKey[normalized] ?? normalized);
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
  const canonicalByKey = buildCanonicalThemedMemberNameMap(locale);

  for (const name of names) {
    const normalized = normalizeMemberName(name);
    expanded.add(normalized);
    expanded.add(canonicalMemberNameForMatching(name, locale));

    if (locale === 'tr') {
      for (const [ascii, canonical] of Object.entries(ASCII_TURKISH_MEMBER_NAME_MIGRATION)) {
        if (
          normalizeMemberName(canonical) === normalized ||
          ascii === normalized ||
          canonicalByKey[normalized] === canonical
        ) {
          expanded.add(ascii);
          expanded.add(normalizeMemberName(canonical));
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

  const fallbackBaseName = preferredSet[existingNames.length % preferredSet.length] ?? 'Agent';
  return createUniqueName(capitalizeMemberName(fallbackBaseName, locale), existingNames);
}

export const MEMBER_NAME_SETS = MEMBER_NAME_SETS_BY_LOCALE.en;
