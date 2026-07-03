/**
 * Agent language configuration utilities.
 * Pure functions — no Electron or DOM dependencies.
 */

export const AGENT_LANGUAGE_PREFERENCES = ['system', 'en', 'tr'] as const;

export type AgentLanguagePreference = (typeof AGENT_LANGUAGE_PREFERENCES)[number];

export interface AgentLanguageOption {
  readonly value: AgentLanguagePreference;
  readonly label: string;
  readonly flag: string;
}

/** Supported agent communication languages (aligned with app UI locales). */
export const AGENT_LANGUAGE_OPTIONS: readonly AgentLanguageOption[] = [
  { value: 'system', label: 'System', flag: '\u{1F310}' },
  { value: 'en', label: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
  { value: 'tr', label: 'Turkish', flag: '\u{1F1F9}\u{1F1F7}' },
] as const;

export function isAgentLanguagePreference(value: unknown): value is AgentLanguagePreference {
  return (
    typeof value === 'string' &&
    AGENT_LANGUAGE_PREFERENCES.includes(value as AgentLanguagePreference)
  );
}

export function normalizeAgentLanguagePreference(value: unknown): AgentLanguagePreference {
  return isAgentLanguagePreference(value) ? value : 'system';
}

function extractPrimaryLanguage(locale: string): string {
  const normalized = locale.trim().replace('_', '-');
  const dash = normalized.indexOf('-');
  const primary = dash > 0 ? normalized.slice(0, dash) : normalized;
  return primary.toLowerCase();
}

function resolveSystemAgentLanguage(systemLocale?: string): 'en' | 'tr' {
  const primary = extractPrimaryLanguage(systemLocale ?? 'en');
  return primary === 'tr' ? 'tr' : 'en';
}

/**
 * Resolves an agent language preference to a human-readable language name
 * for bootstrap instructions.
 */
export function resolveLanguageName(code: string, systemLocale?: string): string {
  const normalized = normalizeAgentLanguagePreference(code);
  const resolved = normalized === 'system' ? resolveSystemAgentLanguage(systemLocale) : normalized;

  return resolved === 'tr' ? 'Turkish' : 'English';
}
