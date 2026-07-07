const PRIMARY_DEFAULT_TEAM_SLUG = 'my-team';
const PRIMARY_DEFAULT_TEAM_LABEL = 'my-team';

const TEAM_NAME_SETS = [
  [
    PRIMARY_DEFAULT_TEAM_SLUG,
    'forge-labs',
    'atlas-hq',
    'relay-works',
    'beacon-desk',
    'vector-room',
  ],
  ['northstar-core', 'summit-ops', 'harbor-labs', 'pilot-desk', 'mission-control', 'launchpad'],
  ['quartz-forge', 'ember-collective', 'prism-works', 'cinder-labs', 'aurora-room', 'sable-ops'],
  ['delta-studio', 'comet-hub', 'orbit-core', 'kernel-crew', 'circuit-labs', 'flux-team'],
] as const;

function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase();
}

function belongsToBaseTeamName(name: string, baseName: string): boolean {
  const normalized = normalizeTeamName(name);
  return normalized === baseName || normalized.startsWith(`${baseName}-`);
}

function getPreferredTeamNameSet(existingNames: readonly string[]): readonly string[] {
  for (const nameSet of TEAM_NAME_SETS) {
    if (
      nameSet.some((candidate) =>
        existingNames.some((name) => belongsToBaseTeamName(name, candidate))
      )
    ) {
      return nameSet;
    }
  }

  return TEAM_NAME_SETS[0];
}

function createUniqueTeamName(baseName: string, existingNames: readonly string[]): string {
  const normalizedExisting = new Set(existingNames.map(normalizeTeamName).filter(Boolean));
  if (!normalizedExisting.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (normalizedExisting.has(`${baseName}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseName}-${suffix}`;
}

export function getNextSuggestedTeamName(existingNames: readonly string[]): string {
  const normalizedExisting = new Set(existingNames.map(normalizeTeamName).filter(Boolean));
  const preferredSet = getPreferredTeamNameSet(existingNames);

  for (const candidate of preferredSet) {
    if (!normalizedExisting.has(candidate)) {
      return candidate === PRIMARY_DEFAULT_TEAM_SLUG ? PRIMARY_DEFAULT_TEAM_LABEL : candidate;
    }
  }

  for (const nameSet of TEAM_NAME_SETS) {
    for (const candidate of nameSet) {
      if (!normalizedExisting.has(candidate)) {
        return candidate === PRIMARY_DEFAULT_TEAM_SLUG ? PRIMARY_DEFAULT_TEAM_LABEL : candidate;
      }
    }
  }

  const fallbackBaseName =
    preferredSet[existingNames.length % preferredSet.length] ?? PRIMARY_DEFAULT_TEAM_SLUG;
  const uniqueName = createUniqueTeamName(fallbackBaseName, existingNames);
  return uniqueName === PRIMARY_DEFAULT_TEAM_SLUG ? PRIMARY_DEFAULT_TEAM_LABEL : uniqueName;
}

export { TEAM_NAME_SETS };
