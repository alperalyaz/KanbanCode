/** Turkish letters allowed in member ids alongside ASCII. */
export const TEAM_MEMBER_NAME_EXTRA_CHARS = 'çğıöşüÇĞİÖŞÜ';

const TEAM_MEMBER_NAME_CHAR_CLASS = `a-zA-Z0-9._${TEAM_MEMBER_NAME_EXTRA_CHARS}`;

export const TEAM_MEMBER_NAME_PATTERN = new RegExp(
  `^[${TEAM_MEMBER_NAME_CHAR_CLASS}][${TEAM_MEMBER_NAME_CHAR_CLASS}-]{0,127}$`
);

export const TEAM_MEMBER_NAME_FORMAT_HINT =
  'Start with alphanumeric, use only [a-zA-Z0-9._-çğıöşüÇĞİÖŞÜ], max 128 chars';

export function parseNumericSuffixName(name: string): { base: string; suffix: number } | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const match = /^(.+)-(\d+)$/.exec(trimmed);
  if (!match?.[1] || !match[2]) return null;
  const suffix = Number(match[2]);
  if (!Number.isFinite(suffix)) return null;
  return { base: match[1], suffix };
}

export function validateTeamMemberNameFormat(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.length < 1 || trimmed.length > 128) {
    return TEAM_MEMBER_NAME_FORMAT_HINT;
  }
  if (!TEAM_MEMBER_NAME_PATTERN.test(trimmed)) {
    return TEAM_MEMBER_NAME_FORMAT_HINT;
  }
  return null;
}

/**
 * Claude CLI auto-suffixes teammate names when a name already exists in config.json
 * (e.g. "alice" → "alice-2"). We treat "-2+" as an auto-suffix only when the base
 * name also exists among the current set of names.
 *
 * Important: do NOT treat "-1" as auto-suffix; it's commonly intentional ("dev-1").
 */
export function createCliAutoSuffixNameGuard(
  allNames: Iterable<string>
): (name: string) => boolean {
  const trimmed: string[] = [];
  const seen = new Set<string>();
  for (const n of allNames) {
    if (typeof n !== 'string') continue;
    const t = n.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    trimmed.push(t);
  }

  const allLower = new Set(trimmed.map((n) => n.toLowerCase()));

  return (name: string): boolean => {
    const info = parseNumericSuffixName(name);
    if (!info) return true;
    if (info.suffix < 2) return true;
    return !allLower.has(info.base.toLowerCase());
  };
}

/**
 * Chars the underlying CLI keeps verbatim in an agent identifier. Everything
 * else is collapsed to '-' (case preserved, one dash per char, no collapsing)
 * when the CLI registers a teammate in config.json / creates its inbox file.
 */
const CLI_ASCII_SLUG_REPLACE_PATTERN = /[^a-zA-Z0-9]/g;

/**
 * A char that the CLI cannot keep verbatim in an agent id and would slug to
 * '-'. Deliberately narrower than the slug pattern: '.', '-' and '_' are valid
 * in member ids ("ops.bot", "dev-1"), so a name that only contains those must
 * NOT be treated as a sluggable origin — otherwise "ops.bot" would wrongly hide
 * a legitimately distinct "ops-bot".
 */
const NON_ASCII_SLUGGABLE_PATTERN = /[^a-zA-Z0-9._-]/;

/**
 * Compute the ASCII slug the underlying CLI derives from a member name:
 * every non-alphanumeric char becomes a single '-', case preserved.
 * e.g. "Köroğlu" -> "K-ro-lu", "Boğaç" -> "Bo-a-".
 */
export function toCliAsciiSlug(name: string): string {
  return name.trim().replace(CLI_ASCII_SLUG_REPLACE_PATTERN, '-');
}

/**
 * The underlying Claude CLI sanitizes non-ASCII teammate names to an ASCII
 * slug when it registers the agent (config.json members / inbox file name),
 * while our own members.meta.json keeps the human-entered name. A member named
 * "Köroğlu" therefore also surfaces as "K-ro-lu", producing a duplicate roster
 * entry.
 *
 * This guard hides the ASCII-slug twin whenever its non-ASCII origin is also
 * present, keeping the human-entered (e.g. Turkish) name visible. It only fires
 * when the origin actually contains a non-identifier character, so legitimate
 * ASCII names that merely contain '.', '-' or '_' are never collapsed. Matching
 * is case-insensitive to tolerate CLI casing differences.
 */
export function createCliAsciiSlugTwinNameGuard(
  allNames: Iterable<string>
): (name: string) => boolean {
  const present = new Set<string>();
  const presentLower = new Set<string>();
  for (const n of allNames) {
    if (typeof n !== 'string') continue;
    const t = n.trim();
    if (!t) continue;
    present.add(t);
    presentLower.add(t.toLowerCase());
  }

  const twinLowerKeys = new Set<string>();
  for (const origin of present) {
    // Only names with a genuinely non-identifier char (Turkish letters, spaces,
    // ...) get slugged by the CLI into a distinct twin.
    if (!NON_ASCII_SLUGGABLE_PATTERN.test(origin)) continue;
    const slug = toCliAsciiSlug(origin);
    const slugLower = slug.toLowerCase();
    // No-op slug or self-match (astronomically unlikely) — nothing to hide.
    if (slugLower === origin.toLowerCase()) continue;
    // Only hide the twin when it is actually present alongside its origin.
    if (!presentLower.has(slugLower)) continue;
    twinLowerKeys.add(slugLower);
  }

  return (name: string): boolean => !twinLowerKeys.has(name.trim().toLowerCase());
}

const PROVISIONER_SUFFIX = '-provisioner';

/**
 * Claude CLI creates temporary "{name}-provisioner" agents during team provisioning
 * to spawn real teammates. These are always internal artifacts — never real teammates.
 *
 * Unlike numeric suffixes (alice-2) which can be intentional, "-provisioner" is a
 * hardcoded CLI pattern that should never be exposed to the user. We unconditionally
 * hide any name ending with "-provisioner" regardless of whether the base name exists.
 */
export function createCliProvisionerNameGuard(
  _allNames: Iterable<string>
): (name: string) => boolean {
  return (name: string): boolean => {
    const lower = name.trim().toLowerCase();
    if (!lower.endsWith(PROVISIONER_SUFFIX)) return true;
    const base = lower.slice(0, -PROVISIONER_SUFFIX.length);
    // Keep bare "-provisioner" (no base) — that's not a CLI artifact pattern
    return !base;
  };
}
