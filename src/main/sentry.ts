/**
 * Sentry initialisation for the Electron **main** process.
 *
 * Must be imported at the very top of `src/main/index.ts` (and `standalone.ts`)
 * so that Sentry captures errors from the earliest point possible.
 *
 * When `SENTRY_DSN` is not set (dev / self-builds), everything is a no-op.
 */

import * as Sentry from '@sentry/electron/main';
import {
  isValidDsn,
  SENTRY_ENVIRONMENT,
  SENTRY_RELEASE,
  TRACES_SAMPLE_RATE,
} from '@shared/utils/sentryConfig';

// ---------------------------------------------------------------------------
// Telemetry gate
// ---------------------------------------------------------------------------

// Module-level flag that `beforeSend` checks.
// Updated by `syncTelemetryFlag()` once ConfigManager is ready.
// Defaults to `true` so early crash reports are NOT silently dropped;
// if the user later turns telemetry off, the flag flips to `false`.
let telemetryAllowed = true;

/**
 * Call once ConfigManager is initialised to sync the opt-in flag.
 * Also call whenever the config changes (e.g. user toggles telemetry in Settings).
 */
export function syncTelemetryFlag(enabled: boolean): void {
  telemetryAllowed = enabled;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

const dsn = process.env.SENTRY_DSN;
let initialized = false;

if (isValidDsn(dsn)) {
  Sentry.init({
    dsn,
    release: SENTRY_RELEASE,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    sendDefaultPii: false,

    beforeSend(event) {
      return telemetryAllowed ? event : null;
    },
  });
  initialized = true;
}

// ---------------------------------------------------------------------------
// Public helpers (no-op when Sentry is not configured)
// ---------------------------------------------------------------------------

/** Record a breadcrumb visible in subsequent error events. */
export function addMainBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

/**
 * Wrap a synchronous or async function in a Sentry performance span.
 * Returns the function's return value transparently.
 */
export function startMainSpan<T>(name: string, op: string, fn: () => T): T {
  if (!initialized) return fn();
  return Sentry.startSpan({ name, op }, fn);
}
