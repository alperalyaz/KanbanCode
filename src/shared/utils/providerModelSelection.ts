export const DEFAULT_PROVIDER_MODEL_SELECTION = '__provider_default__';

/**
 * True when the value means "use the provider runtime default", not a concrete model id.
 * Persisted team/member specs historically used the literal `"default"` sentinel in addition
 * to `__provider_default__`.
 */
export function isDefaultProviderModelSelection(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed === DEFAULT_PROVIDER_MODEL_SELECTION) {
    return true;
  }
  const normalized = trimmed.toLowerCase();
  return normalized === 'default' || normalized === '__default__';
}
