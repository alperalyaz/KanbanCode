import { ConfigManager } from '@main/services/infrastructure/ConfigManager';
import { resolveLanguageName } from '@shared/utils/agentLanguage';

export function getSystemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return process.env.LANG?.split('.')[0]?.replace('_', '-') ?? 'en';
  }
}

/**
 * The default/fallback language for agents, resolved from the user's config
 * (`general.agentLanguage`, default 'system') or the OS locale. This is NOT a
 * hard lock — agents primarily mirror the user's language (see the instruction
 * below); this only sets the starting default before the user has written.
 *
 * NOTE: this is deliberately independent of the app UI locale. The UI is
 * temporarily English-only, but the agents must still speak the human's
 * language (e.g. reply in Turkish when the user writes Turkish).
 */
export function getConfiguredAgentLanguageName(): string {
  try {
    const config = ConfigManager.getInstance().getConfig();
    const langCode = config.general.agentLanguage || 'system';
    return resolveLanguageName(langCode, getSystemLocale());
  } catch {
    return resolveLanguageName('system', getSystemLocale());
  }
}

export function getAgentLanguageInstruction(): string {
  const defaultLanguageName = getConfiguredAgentLanguageName();
  return (
    `LANGUAGE POLICY (applies to every turn): MIRROR THE HUMAN USER'S LANGUAGE. ` +
    `Write your prose in the SAME language the user writes to you in — if the user writes in ` +
    `Turkish, reply in Turkish; if in English, reply in English; match whatever language they use, ` +
    `switching if they switch. This applies to every message to the user, every message to ` +
    `teammates or the lead, every status update, summary, task subject, and task description, ` +
    `including technical explanations, plans, and review notes — so the human can follow the whole ` +
    `conversation. Only literal code, identifiers, file paths, and tool/command names keep their ` +
    `original form; the surrounding prose follows the user's language. ` +
    `Until the user has written anything, default to ${defaultLanguageName}.`
  );
}
