import type { TranslationNamespace } from '@features/localization/contracts';
import type { TFunction } from 'i18next';

type AppTranslator = TFunction<TranslationNamespace, undefined>;

/**
 * Maps raw OpenCode prepare advisory strings into short UI copy.
 * Keeps unknown reasons intact so new diagnostics still surface.
 *
 * Expects a `team`-scoped translator (`useAppTranslation('team').t`).
 */
export function localizeOpenCodeModelAdvisoryReason(
  reason: string | null | undefined,
  t: AppTranslator
): string | null {
  const trimmed = reason?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes('ping not confirmed')) {
    return t('modelSelector.advisory.pingNotConfirmed');
  }
  if (lower.includes('compatible') && lower.includes('deep verification')) {
    return t('modelSelector.advisory.compatibilityPending');
  }

  return trimmed;
}

export function getOpenCodeModelAdvisoryBadgeLabel(
  reason: string | null | undefined,
  t: AppTranslator
): string {
  const lower = reason?.trim().toLowerCase() ?? '';
  if (lower.includes('ping not confirmed')) {
    return t('modelSelector.advisory.pingNotConfirmed');
  }
  if (lower.includes('compatible') && lower.includes('deep verification')) {
    return t('modelSelector.advisory.compatibilityPending');
  }
  return t('modelSelector.advisory.note');
}
