/**
 * Telemetry removed.
 *
 * KanbanCode no longer includes Sentry or any crash/performance telemetry.
 * These are inert no-op shims kept only so existing callers keep compiling —
 * nothing is collected, initialized, or sent anywhere.
 */

export function syncRendererTelemetry(_enabled: boolean): void {
  // no-op: telemetry removed
}

export function initSentryRenderer(): void {
  // no-op: telemetry removed
}

export function isSentryRendererActive(): boolean {
  return false;
}

export function addNavigationBreadcrumb(_from: string, _to: string): void {
  // no-op: telemetry removed
}

export function addRendererBreadcrumb(
  _category: string,
  _message: string,
  _data?: Record<string, unknown>
): void {
  // no-op: telemetry removed
}

export function captureRendererException(_error: Error, _context?: Record<string, unknown>): void {
  // no-op: telemetry removed
}
