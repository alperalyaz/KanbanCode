/**
 * Soft classification of free-form team member role strings for assignment / review.
 * Roles are user-editable text; match common presets and Turkish/English synonyms.
 */

export type TeamMemberRoleKind = 'lead' | 'architect' | 'developer' | 'qa' | 'reviewer' | 'other';

function normalizeRole(role: string | null | undefined): string {
  return role?.trim().toLowerCase() ?? '';
}

export function classifyTeamMemberRole(role: string | null | undefined): TeamMemberRoleKind {
  const value = normalizeRole(role);
  if (!value) return 'other';

  if (
    value.includes('team-lead') ||
    value === 'lead' ||
    value.includes('team lead') ||
    value.includes('lider') ||
    value.includes('leader') ||
    value.includes('orchestrat')
  ) {
    return 'lead';
  }
  if (
    value.includes('architect') ||
    value.includes('mimar') ||
    value.includes('planner') ||
    value.includes('designer')
  ) {
    return 'architect';
  }
  if (
    value === 'qa' ||
    value.includes('quality') ||
    value.includes('test') ||
    value.includes('tester') ||
    value.includes('doğrulama') ||
    value.includes('dogrulama')
  ) {
    return 'qa';
  }
  if (
    value.includes('reviewer') ||
    value.includes('review') ||
    value.includes('inceleyen') ||
    value.includes('denetçi') ||
    value.includes('denetci')
  ) {
    return 'reviewer';
  }
  if (
    value.includes('developer') ||
    value.includes('engineer') ||
    value.includes('implement') ||
    value.includes('coder') ||
    value.includes('geliştir') ||
    value.includes('gelistir') ||
    value.includes('yazılım') ||
    value.includes('yazilim')
  ) {
    return 'developer';
  }
  return 'other';
}

export function isReviewOrientedRole(role: string | null | undefined): boolean {
  const kind = classifyTeamMemberRole(role);
  return kind === 'qa' || kind === 'reviewer';
}

export function isImplementationOrientedRole(role: string | null | undefined): boolean {
  const kind = classifyTeamMemberRole(role);
  return kind === 'developer' || kind === 'other' || kind === 'architect';
}

/**
 * Prefer dedicated QA, then reviewer-role members, excluding lead/removed.
 */
export function pickPreferredReviewerName(
  members: ReadonlyArray<{ name?: string | null; role?: string | null; removedAt?: unknown }>
): string | null {
  const active = members.filter((member) => {
    const name = member.name?.trim();
    if (!name) return false;
    if (member.removedAt != null) return false;
    const kind = classifyTeamMemberRole(member.role);
    return kind !== 'lead';
  });

  const qa = active.find((member) => classifyTeamMemberRole(member.role) === 'qa');
  if (qa?.name?.trim()) return qa.name.trim();

  const reviewer = active.find((member) => classifyTeamMemberRole(member.role) === 'reviewer');
  if (reviewer?.name?.trim()) return reviewer.name.trim();

  return null;
}

export function listReviewOrientedMemberNames(
  members: ReadonlyArray<{ name?: string | null; role?: string | null; removedAt?: unknown }>
): string[] {
  return members
    .filter((member) => member.removedAt == null && isReviewOrientedRole(member.role))
    .map((member) => member.name?.trim())
    .filter((name): name is string => Boolean(name));
}

export function buildDefaultRoleDutyHint(role: string | null | undefined): string | null {
  switch (classifyTeamMemberRole(role)) {
    case 'architect':
      return 'Role duty: plan structure, split work, guard scope. Prefer design/decomposition over bulk implementation when developers exist.';
    case 'developer':
      return 'Role duty: implement assigned tasks with focused code changes.';
    case 'qa':
      return 'Role duty: after substantial implementation is completed, review/test changes against acceptance criteria via the review flow (review_start → review_approve or review_request_changes). Do not sit idle while completed work waits without review.';
    case 'reviewer':
      return 'Role duty: review completed tasks, inspect diffs, and approve or request changes. Do not sit idle while completed work waits without review.';
    default:
      return null;
  }
}
