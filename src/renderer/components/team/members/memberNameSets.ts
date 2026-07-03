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
    ['koroglu', 'alpamis', 'bogac', 'ayvaz', 'selcan', 'dede'],
    ['salur', 'yigen', 'uzun', 'baybora', 'melik', 'kara'],
    ['asena', 'alp', 'eren', 'mert', 'baran', 'asli'],
    ['deniz', 'arda', 'kaan', 'ege', 'bora', 'nilay'],
  ],
} as const satisfies Record<ResolvedAppLocale, readonly (readonly string[])[]>;

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
    { name: 'koroglu', roleSelection: 'developer' },
    { name: 'alpamis', roleSelection: 'developer' },
    { name: 'bogac', roleSelection: 'developer' },
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

function normalizeMemberName(name: string): string {
  return name.trim().toLowerCase();
}

function belongsToBaseName(name: string, baseName: string): boolean {
  const normalized = normalizeMemberName(name);
  return normalized === baseName || normalized.startsWith(`${baseName}-`);
}

function getPreferredNameSet(
  existingNames: readonly string[],
  locale: ResolvedAppLocale
): readonly string[] {
  const memberNameSets = getMemberNameSets(locale);

  for (const nameSet of memberNameSets) {
    if (
      nameSet.some((candidate) => existingNames.some((name) => belongsToBaseName(name, candidate)))
    ) {
      return nameSet;
    }
  }

  return memberNameSets[0];
}

function createUniqueName(baseName: string, existingNames: readonly string[]): string {
  const normalizedExisting = new Set(existingNames.map(normalizeMemberName));
  if (!normalizedExisting.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (normalizedExisting.has(`${baseName}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseName}-${suffix}`;
}

export function getNextSuggestedMemberName(
  existingNames: readonly string[],
  locale: ResolvedAppLocale = 'en'
): string {
  const normalizedExisting = new Set(existingNames.map(normalizeMemberName).filter(Boolean));
  const memberNameSets = getMemberNameSets(locale);
  const preferredSet = getPreferredNameSet(existingNames, locale);

  for (const candidate of preferredSet) {
    if (!normalizedExisting.has(candidate)) {
      return candidate;
    }
  }

  for (const nameSet of memberNameSets) {
    for (const candidate of nameSet) {
      if (!normalizedExisting.has(candidate)) {
        return candidate;
      }
    }
  }

  const fallbackBaseName = preferredSet[existingNames.length % preferredSet.length] ?? 'agent';
  return createUniqueName(fallbackBaseName, existingNames);
}

export const MEMBER_NAME_SETS = MEMBER_NAME_SETS_BY_LOCALE.en;
