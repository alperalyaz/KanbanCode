/**
 * Tracks whether the main window is worth updating (visible and not minimized).
 *
 * Background maintenance pollers (process health, branch status, telemetry)
 * consult this to skip work while nobody can see the result. Blur alone does
 * NOT count as inactive — a visible-but-unfocused window should keep updating.
 *
 * When no window has been registered (standalone/server mode, tests), the
 * tracker reports active so polling behaves exactly as before.
 */

import type { BrowserWindow } from 'electron';

let trackedWindow: BrowserWindow | null = null;
let windowInteractive = true;

function updateFromWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    windowInteractive = true;
    return;
  }
  windowInteractive = win.isVisible() && !win.isMinimized();
}

export function trackMainWindowVisibility(win: BrowserWindow | null): void {
  trackedWindow = win;
  if (!win) {
    // No window to observe (shutdown/standalone) — never stall background work.
    windowInteractive = true;
    return;
  }

  updateFromWindow(win);
  for (const event of ['minimize', 'restore', 'show', 'hide', 'maximize', 'unmaximize'] as const) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BrowserWindow.on has per-event overloads that reject a union of event names.
    (win as any).on(event, () => {
      if (trackedWindow === win) {
        updateFromWindow(win);
      }
    });
  }
  win.once('closed', () => {
    if (trackedWindow === win) {
      trackedWindow = null;
      windowInteractive = true;
    }
  });
}

/** True when the main window is visible (or when no window is tracked at all). */
export function isMainWindowInteractive(): boolean {
  return windowInteractive;
}
