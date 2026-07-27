import { parseNumericSuffixName, toCliAsciiSlug } from '@shared/utils/teamMemberName';

/**
 * Chars the CLI cannot keep verbatim in an agent id (Turkish letters, spaces,
 * etc.). Mirrors teamMemberName.ts NON_ASCII_SLUGGABLE_PATTERN so we only treat
 * names that the CLI actually rewrites as slug-alias candidates.
 */
const NON_ASCII_SLUGGABLE_PATTERN = /[^a-zA-Z0-9._-]/;

export function matchesMemberNameOrBase(candidateName: string, memberName: string): boolean {
  if (candidateName === memberName) {
    return true;
  }
  const parsed = parseNumericSuffixName(candidateName);
  return parsed !== null && parsed.suffix >= 2 && parsed.base === memberName;
}

export function matchesTeamMemberIdentity(leftName: string, rightName: string): boolean {
  return (
    matchesMemberNameOrBase(leftName, rightName) || matchesMemberNameOrBase(rightName, leftName)
  );
}

/**
 * CLI ASCII-slug aliases for a configured member name.
 *
 * The underlying CLI rewrites non-ASCII teammate names (e.g. "Karagöz" →
 * "Karag-z") in config.json / inbox filenames / --agent-id, while
 * members.meta.json keeps the human-entered Unicode name. The slug is only
 * treated as an alias when no other expected name is exactly that slug or
 * collapses to the same slug (collision-safe).
 */
export function collectMemberNameIdentityAliases(
  expectedName: string,
  allExpectedNames: readonly string[] = []
): string[] {
  const expected = expectedName.trim();
  if (!expected) {
    return [];
  }

  const aliases = new Set<string>([expected]);
  if (!NON_ASCII_SLUGGABLE_PATTERN.test(expected)) {
    return [...aliases];
  }

  const slug = toCliAsciiSlug(expected);
  if (!slug || slug === expected) {
    return [...aliases];
  }

  const collision = allExpectedNames.some((other) => {
    const candidate = other.trim();
    if (!candidate || candidate === expected) {
      return false;
    }
    return candidate === slug || toCliAsciiSlug(candidate) === slug;
  });
  if (!collision) {
    aliases.add(slug);
  }

  return [...aliases];
}

export function matchesObservedMemberNameForExpected(
  observedName: string,
  expectedName: string,
  allExpectedNames: readonly string[] = []
): boolean {
  const observed = observedName.trim();
  const expected = expectedName.trim();
  if (!observed || !expected) {
    return false;
  }

  for (const alias of collectMemberNameIdentityAliases(expected, allExpectedNames)) {
    if (matchesMemberNameOrBase(observed, alias)) {
      return true;
    }
  }
  return false;
}

/**
 * Agent-id aliases for process-table matching.
 * "Karagöz@team" also matches observed "Karag-z@team" when the slug is unique.
 */
export function collectAgentIdIdentityAliases(params: {
  agentId?: string;
  memberName?: string;
  teamName?: string;
  allExpectedNames?: readonly string[];
}): string[] {
  const ids = new Set<string>();
  const trimmedAgentId = params.agentId?.trim() ?? '';
  if (trimmedAgentId) {
    ids.add(trimmedAgentId);
  }

  const atIndex = trimmedAgentId.indexOf('@');
  const nameFromAgentId = atIndex > 0 ? trimmedAgentId.slice(0, atIndex) : '';
  const teamFromAgentId = atIndex > 0 ? trimmedAgentId.slice(atIndex + 1) : '';
  const memberName = (params.memberName?.trim() || nameFromAgentId).trim();
  const teamName = (params.teamName?.trim() || teamFromAgentId).trim();
  if (!memberName || !teamName) {
    return [...ids];
  }

  for (const alias of collectMemberNameIdentityAliases(memberName, params.allExpectedNames ?? [])) {
    ids.add(`${alias}@${teamName}`);
  }
  return [...ids];
}

export function matchesObservedAgentIdForExpected(params: {
  observedAgentId: string;
  expectedAgentId?: string;
  memberName?: string;
  teamName?: string;
  allExpectedNames?: readonly string[];
}): boolean {
  const observed = params.observedAgentId.trim();
  if (!observed) {
    return false;
  }
  return collectAgentIdIdentityAliases(params).includes(observed);
}

export function matchesExactTeamMemberName(candidateName: string, memberName: string): boolean {
  const left = candidateName.trim().toLowerCase();
  const right = memberName.trim().toLowerCase();
  return left.length > 0 && left === right;
}

export function namesMatchCaseInsensitive(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function isOpenCodeOverlayMemberRemoved(
  metaMembers: readonly { name?: string; removedAt?: unknown }[],
  memberName: string
): boolean {
  return metaMembers.some(
    (member) =>
      typeof member.name === 'string' &&
      namesMatchCaseInsensitive(member.name, memberName) &&
      member.removedAt != null
  );
}
