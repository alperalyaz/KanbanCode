/**
 * Maps raw OpenCode prepare advisory strings into short UI copy.
 * Keeps unknown reasons intact so new diagnostics still surface.
 *
 * Expects a `team`-scoped translator (`useAppTranslation('team').t`).
 */
type OpenCodeModelAdvisoryTranslationKey =
  | 'modelSelector.advisory.pingNotConfirmed'
  | 'modelSelector.advisory.compatibilityPending'
  | 'modelSelector.advisory.note';

type OpenCodeModelAdvisoryTranslator = (key: OpenCodeModelAdvisoryTranslationKey) => string;

export function localizeOpenCodeModelAdvisoryReason(
  reason: string | null | undefined,
  t: OpenCodeModelAdvisoryTranslator
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
  t: OpenCodeModelAdvisoryTranslator
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
