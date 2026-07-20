import { isDefaultProviderModelSelection } from '@shared/utils/providerModelSelection';

/**
 * Codex models OpenAI has sunset for ChatGPT-account auth (subscription).
 * They may still work with API-key auth for a while, but launching them with
 * ChatGPT login fails with:
 *   The '<model>' model is not supported when using Codex with a ChatGPT account.
 *
 * This set is only a safety net for models the live Codex catalog still lists
 * (or config.toml still defaults to) after ChatGPT stopped accepting them.
 * Preferred resolution always follows the live app-server catalog order/default.
 */
export const CODEX_CHATGPT_SUNSET_MODELS = new Set([
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
]);

/**
 * Offline last resort when the live Codex catalog is empty/unavailable.
 * Keep in sync with `createStaticCodexModelCatalogModels()` `isDefault`.
 * Launch normally uses live `defaultLaunchModel` / first safe catalog model.
 */
export function getCodexChatGptOfflineFallbackModel(): string {
  return 'gpt-5.5';
}

/** @deprecated Use getCodexChatGptOfflineFallbackModel(). */
export const CODEX_CHATGPT_FALLBACK_MODEL = getCodexChatGptOfflineFallbackModel();

export function normalizeCodexModelId(modelId: string | null | undefined): string {
  return modelId?.trim().toLowerCase() ?? '';
}

type CodexUnavailableModelIds = readonly (string | null | undefined)[] | ReadonlySet<string>;

export function isCodexChatGptSunsetModel(modelId: string | null | undefined): boolean {
  const normalized = normalizeCodexModelId(modelId);
  return normalized.length > 0 && CODEX_CHATGPT_SUNSET_MODELS.has(normalized);
}

export function isCodexChatGptBlockedModel(
  modelId: string | null | undefined,
  unavailableModelIds?: CodexUnavailableModelIds
): boolean {
  const trimmed = modelId?.trim() ?? '';
  if (!trimmed || isDefaultProviderModelSelection(trimmed)) {
    return true;
  }
  if (isCodexChatGptSunsetModel(trimmed)) {
    return true;
  }
  if (!unavailableModelIds) {
    return false;
  }
  const normalized = normalizeCodexModelId(trimmed);
  if (Array.isArray(unavailableModelIds)) {
    return unavailableModelIds.some(
      (entry: string | null | undefined) => normalizeCodexModelId(entry) === normalized
    );
  }
  for (const entry of unavailableModelIds) {
    if (normalizeCodexModelId(entry) === normalized) {
      return true;
    }
  }
  return false;
}

/**
 * Remap a selected Codex model when the account is ChatGPT subscription auth.
 * Returns the original model when it is still usable, otherwise a safe fallback.
 */
export function remapCodexModelForChatGptAccount(
  modelId: string | null | undefined,
  fallbackModelId: string | null | undefined = getCodexChatGptOfflineFallbackModel(),
  unavailableModelIds?: CodexUnavailableModelIds
): string | null {
  const trimmed = modelId?.trim() ?? '';
  if (!trimmed || isDefaultProviderModelSelection(trimmed)) {
    return null;
  }
  if (!isCodexChatGptBlockedModel(trimmed, unavailableModelIds)) {
    return trimmed;
  }
  return pickCodexChatGptSafeModel([fallbackModelId], fallbackModelId, unavailableModelIds);
}

/**
 * Pick the first ChatGPT-safe Codex model from candidates.
 * Prefer live catalog defaults/order; only fall back to the offline default
 * when every candidate is missing or blocked.
 */
export function pickCodexChatGptSafeModel(
  candidates: readonly (string | null | undefined)[],
  fallbackModelId: string | null | undefined = getCodexChatGptOfflineFallbackModel(),
  unavailableModelIds?: CodexUnavailableModelIds
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !isCodexChatGptBlockedModel(trimmed, unavailableModelIds)) {
      return trimmed;
    }
  }
  const fallback = fallbackModelId?.trim() || getCodexChatGptOfflineFallbackModel();
  if (fallback && !isCodexChatGptBlockedModel(fallback, unavailableModelIds)) {
    return fallback;
  }
  return getCodexChatGptOfflineFallbackModel();
}

/**
 * Resolve the ChatGPT launch model from the live Codex catalog first.
 * Order: explicit safe selection → catalog default → first safe catalog model → offline fallback.
 */
export function resolveCodexChatGptLaunchModel(params: {
  selectedModel?: string | null;
  catalogDefault?: string | null;
  catalogModels?: readonly {
    id?: string | null;
    launchModel?: string | null;
    hidden?: boolean;
  }[];
  unavailableModelIds?: CodexUnavailableModelIds;
}): string {
  const catalogIds =
    params.catalogModels
      ?.filter((model) => model.hidden !== true)
      .map((model) => model.launchModel?.trim() || model.id?.trim() || null) ?? [];

  return pickCodexChatGptSafeModel(
    [params.selectedModel, params.catalogDefault, ...catalogIds],
    getCodexChatGptOfflineFallbackModel(),
    params.unavailableModelIds
  );
}
