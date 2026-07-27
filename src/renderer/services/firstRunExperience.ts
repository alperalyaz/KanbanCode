import { createTeamDraftStorage } from '@renderer/services/createTeamDraftStorage';
import {
  setStoredCreateTeamModel,
  setStoredCreateTeamProvider,
  setStoredCreateTeamSkipPermissions,
} from '@renderer/services/createTeamPreferences';

import type { TeamProviderId } from '@shared/types';

const FIRST_RUN_COMPLETE_KEY = 'kanbancode:firstRunComplete';
const FIRST_RUN_DEFAULTS_APPLIED_KEY = 'kanbancode:firstRunDefaultsApplied';
/** Set once the user explicitly opens the advanced create options. */
const ADVANCED_CREATE_MODE_KEY = 'kanbancode:advancedCreateModePreferred';

export const FIRST_RUN_DEFAULT_PROVIDER: TeamProviderId = 'opencode';
export const FIRST_RUN_DEFAULT_MODEL = 'opencode/big-pickle';

function readFlag(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    if (value) {
      globalThis.localStorage?.setItem(key, value.toString());
    } else {
      globalThis.localStorage?.removeItem(key);
    }
  } catch {
    // Ignore storage failures in renderer helpers.
  }
}

export function hasCompletedFirstRun(): boolean {
  return readFlag(FIRST_RUN_COMPLETE_KEY);
}

export function markFirstRunComplete(): void {
  writeFlag(FIRST_RUN_COMPLETE_KEY, true);
}

export function isFirstRunExperienceActive(): boolean {
  return !hasCompletedFirstRun();
}

export function shouldShowFirstRunOnboarding(hasTeams: boolean): boolean {
  return isFirstRunExperienceActive() && !hasTeams;
}

export function shouldExpandProviderBannerOnDashboard(hasTeams: boolean): boolean {
  return shouldShowFirstRunOnboarding(hasTeams);
}

export function shouldDeferCreatePreflight(): boolean {
  return isFirstRunExperienceActive();
}

export function shouldShowSimplifiedCreateDialog(hasCopySource: boolean): boolean {
  return isFirstRunExperienceActive() && !hasCopySource;
}

/**
 * "One-click team" mode: the create dialog asks only for a team name and a
 * project, and everything else (provider, model, roles) uses the free
 * OpenCode defaults. This is the default for EVERY team creation — not just
 * the first run — so an amateur user can get a working team without paying
 * for anything or understanding provider/model settings.
 *
 * Copying an existing team always shows the full form, and once a user
 * explicitly opens the advanced options we remember that preference.
 */
export function shouldUseSimpleCreateMode(hasCopySource: boolean): boolean {
  if (hasCopySource) {
    return false;
  }
  return !readFlag(ADVANCED_CREATE_MODE_KEY);
}

/** Remember that this user prefers the full create form from now on. */
export function markAdvancedCreateModePreferred(): void {
  writeFlag(ADVANCED_CREATE_MODE_KEY, true);
}

/** Return to the simplified one-click create form. */
export function clearAdvancedCreateModePreference(): void {
  writeFlag(ADVANCED_CREATE_MODE_KEY, false);
}

/**
 * Free OpenCode default is launchable as soon as the runtime is present.
 * Do not block first-run on full model-catalog hydration (30–90s cold start).
 */
export function isFirstRunFreeModelReady(options: {
  runtimeReady: boolean;
  modelListedInCatalog: boolean;
}): boolean {
  return options.runtimeReady || options.modelListedInCatalog;
}

export type FirstRunConnectPath = 'free' | 'connect';

const FIRST_RUN_CONNECT_PATH_KEY = 'kanbancode:firstRunConnectPath';

export function getFirstRunConnectPath(): FirstRunConnectPath | null {
  try {
    const value = globalThis.localStorage?.getItem(FIRST_RUN_CONNECT_PATH_KEY);
    if (value === 'free' || value === 'connect') {
      return value;
    }
  } catch {
    // Ignore storage failures.
  }
  return null;
}

export function setFirstRunConnectPath(path: FirstRunConnectPath): void {
  try {
    globalThis.localStorage?.setItem(FIRST_RUN_CONNECT_PATH_KEY, path);
  } catch {
    // Ignore storage failures.
  }
}

export function applyFirstRunCreateTeamDefaults(): void {
  if (readFlag(FIRST_RUN_DEFAULTS_APPLIED_KEY)) {
    return;
  }

  setStoredCreateTeamProvider(FIRST_RUN_DEFAULT_PROVIDER);
  setStoredCreateTeamModel(FIRST_RUN_DEFAULT_PROVIDER, FIRST_RUN_DEFAULT_MODEL);
  setStoredCreateTeamSkipPermissions(false);
  writeFlag(FIRST_RUN_DEFAULTS_APPLIED_KEY, true);
}

export async function resetFirstRunCreateTeamDraft(): Promise<void> {
  if (!isFirstRunExperienceActive()) {
    return;
  }

  try {
    await createTeamDraftStorage.deleteSnapshot();
  } catch {
    // Draft reset is best-effort for first-run hygiene.
  }
}

export function bootstrapFirstRunExperience(options: { hasTeams: boolean }): void {
  if (options.hasTeams) {
    markFirstRunComplete();
    return;
  }

  if (!isFirstRunExperienceActive()) {
    return;
  }

  applyFirstRunCreateTeamDefaults();
}
