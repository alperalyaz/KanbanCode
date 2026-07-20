import type { TeamMessagesPanelMode } from '@renderer/types/teamMessagesPanelMode';

const MESSAGES_PANEL_MODE_STORAGE_KEY = 'team:messagesPanelMode';
const DEFAULT_MESSAGES_PANEL_MODE: TeamMessagesPanelMode = 'sidebar';

/**
 * Messages stay in the left sidebar only. Older relocate modes are migrated
 * back to sidebar so leftover localStorage prefs cannot reopen bottom-sheet UI.
 */
export function loadPersistedMessagesPanelMode(): TeamMessagesPanelMode {
  try {
    const persisted = localStorage.getItem(MESSAGES_PANEL_MODE_STORAGE_KEY);
    if (persisted != null && persisted !== DEFAULT_MESSAGES_PANEL_MODE) {
      localStorage.setItem(MESSAGES_PANEL_MODE_STORAGE_KEY, DEFAULT_MESSAGES_PANEL_MODE);
    }
  } catch {
    // ignore - best-effort UI preference persistence
  }
  return DEFAULT_MESSAGES_PANEL_MODE;
}

export function savePersistedMessagesPanelMode(mode: TeamMessagesPanelMode): void {
  void mode;
  try {
    localStorage.setItem(MESSAGES_PANEL_MODE_STORAGE_KEY, DEFAULT_MESSAGES_PANEL_MODE);
  } catch {
    // ignore - best-effort UI preference persistence
  }
}
