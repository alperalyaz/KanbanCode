// ── Cross-Team Message Protocol ──────────────────────────────────────────────
// Single source of truth for the cross-team message prefix format.
// Used by: CrossTeamService (main), crossTeam.js (controller), ActivityItem (renderer), tests.

/** Prefix tag that wraps cross-team metadata in stored message text. */
export const CROSS_TEAM_PREFIX_TAG = 'Cross-team from';

/** Build the full prefix line: `[Cross-team from team.member | depth:N]` */
export function formatCrossTeamPrefix(from: string, chainDepth: number): string {
  return `[${CROSS_TEAM_PREFIX_TAG} ${from} | depth:${chainDepth}]`;
}

/** Format the full message text with prefix + body. */
export function formatCrossTeamText(from: string, chainDepth: number, text: string): string {
  return `${formatCrossTeamPrefix(from, chainDepth)}\n${text}`;
}

/**
 * Regex that matches the cross-team prefix line at the start of a message.
 * Captures nothing — use `.replace(CROSS_TEAM_PREFIX_RE, '')` to strip it.
 */
export const CROSS_TEAM_PREFIX_RE = /^\[Cross-team from [^\]]+\]\n?/;

/** Strip the cross-team prefix from message text (for UI display). */
export function stripCrossTeamPrefix(text: string): string {
  return text.replace(CROSS_TEAM_PREFIX_RE, '');
}

// ── Source discriminators ────────────────────────────────────────────────────

/** Incoming cross-team message (written to target team's inbox). */
export const CROSS_TEAM_SOURCE = 'cross_team' as const;

/** Outgoing cross-team message copy (written to sender team's inbox). */
export const CROSS_TEAM_SENT_SOURCE = 'cross_team_sent' as const;
