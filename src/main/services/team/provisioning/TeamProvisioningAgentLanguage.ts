import { resolveLanguageName } from '@shared/utils/agentLanguage';

export function getSystemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return process.env.LANG?.split('.')[0]?.replace('_', '-') ?? 'en';
  }
}

export function getConfiguredAgentLanguageName(): string {
  // TEMPORARY: agents are locked to English while the app UI is English-only
  // (see LocalizationProvider). Models are most reliable in English and this
  // keeps UI + agents + startup intro consistent. To restore config/OS-based
  // agent language later, replace the line below with:
  //   const config = ConfigManager.getInstance().getConfig();
  //   const langCode = config.general.agentLanguage || 'system';
  //   return resolveLanguageName(langCode, getSystemLocale());
  return resolveLanguageName('en', 'en');
}

export function getAgentLanguageInstruction(): string {
  const languageName = getConfiguredAgentLanguageName();
  return (
    `LANGUAGE POLICY (STRICT, applies to every turn): You MUST write ALL prose in ${languageName} — ` +
    `every message to the user, every message to teammates or the lead, every status update, ` +
    `summary, task subject, and task description. This includes technical explanations, plans, ` +
    `and review notes: do NOT switch to English for technical or code-related content. ` +
    `Only literal code, identifiers, file paths, and tool/command names keep their original form; ` +
    `the surrounding prose stays in ${languageName}. If you catch yourself writing in another ` +
    `language, restate it in ${languageName}.`
  );
}
