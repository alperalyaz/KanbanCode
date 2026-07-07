/**
 * Telemetry removed.
 *
 * KanbanCode no longer includes Sentry or any crash/performance telemetry.
 * These are inert no-op shims kept only so existing callers keep compiling —
 * nothing is collected, initialized, or sent anywhere.
 */

export interface SentryTelemetryContext {
  userId: string;
  tags: Record<string, string>;
}

export function syncTelemetryFlag(_enabled: boolean): void {
  // no-op: telemetry removed
}

export async function getCurrentSentryTelemetryContext(): Promise<SentryTelemetryContext | null> {
  return null;
}

export function addMainBreadcrumb(
  _category: string,
  _message: string,
  _data?: Record<string, unknown>
): void {
  // no-op: telemetry removed
}

export function startMainSpan<T>(_name: string, _op: string, fn: () => T): T {
  return fn();
}
