import { createTeamDraftStorage } from '@renderer/services/createTeamDraftStorage';
import {
  setStoredCreateTeamModel,
  setStoredCreateTeamProvider,
  setStoredCreateTeamSkipPermissions,
} from '@renderer/services/createTeamPreferences';

import type { TeamProviderId } from '@shared/types';

const FIRST_RUN_COMPLETE_KEY = 'kanbancode:firstRunComplete';
const FIRST_RUN_DEFAULTS_APPLIED_KEY = 'kanbancode:firstRunDefaultsApplied';

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
