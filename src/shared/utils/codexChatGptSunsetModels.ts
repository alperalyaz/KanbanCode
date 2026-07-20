/**
 * Codex models OpenAI sunset for ChatGPT-account auth (subscription).
 * They may still work with API-key auth for a while, but launching them with
 * ChatGPT login fails with:
 *   The '<model>' model is not supported when using Codex with a ChatGPT account.
 *
 * Keep this list in sync with OpenAI's ChatGPT Codex sunsets.
 */
export const CODEX_CHATGPT_SUNSET_MODELS = new Set([
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
]);

export const CODEX_CHATGPT_FALLBACK_MODEL = 'gpt-5.5';

export function normalizeCodexModelId(modelId: string | null | undefined): string {
  return modelId?.trim().toLowerCase() ?? '';
}

export function isCodexChatGptSunsetModel(modelId: string | null | undefined): boolean {
  const normalized = normalizeCodexModelId(modelId);
  return normalized.length > 0 && CODEX_CHATGPT_SUNSET_MODELS.has(normalized);
}

/**
 * Remap a selected Codex model when the account is ChatGPT subscription auth.
 * Returns the original model when it is still usable, otherwise a safe fallback.
 */
export function remapCodexModelForChatGptAccount(
  modelId: string | null | undefined,
  fallbackModelId: string | null | undefined = CODEX_CHATGPT_FALLBACK_MODEL
): string | null {
  const trimmed = modelId?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  if (!isCodexChatGptSunsetModel(trimmed)) {
    return trimmed;
  }
  const fallback = fallbackModelId?.trim() || CODEX_CHATGPT_FALLBACK_MODEL;
  if (!fallback || isCodexChatGptSunsetModel(fallback)) {
    return CODEX_CHATGPT_FALLBACK_MODEL;
  }
  return fallback;
}
