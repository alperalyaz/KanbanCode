import {
  applyFirstRunCreateTeamDefaults,
  bootstrapFirstRunExperience,
  FIRST_RUN_DEFAULT_MODEL,
  FIRST_RUN_DEFAULT_PROVIDER,
  hasCompletedFirstRun,
  isFirstRunExperienceActive,
  markFirstRunComplete,
  shouldDeferCreatePreflight,
  shouldExpandProviderBannerOnDashboard,
  shouldShowFirstRunOnboarding,
  shouldShowSimplifiedCreateDialog,
} from '@renderer/services/firstRunExperience';
import {
  getStoredCreateTeamModel,
  getStoredCreateTeamProvider,
  getStoredCreateTeamSkipPermissions,
} from '@renderer/services/createTeamPreferences';
import { afterEach, describe, expect, it } from 'vitest';

describe('firstRunExperience', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('tracks first-run completion and onboarding visibility', () => {
    expect(isFirstRunExperienceActive()).toBe(true);
    expect(shouldShowFirstRunOnboarding(false)).toBe(true);
    expect(shouldExpandProviderBannerOnDashboard(false)).toBe(true);
    expect(shouldShowSimplifiedCreateDialog(false)).toBe(true);
    expect(shouldDeferCreatePreflight()).toBe(true);

    markFirstRunComplete();

    expect(hasCompletedFirstRun()).toBe(true);
    expect(isFirstRunExperienceActive()).toBe(false);
    expect(shouldShowFirstRunOnboarding(false)).toBe(false);
    expect(shouldShowSimplifiedCreateDialog(false)).toBe(false);
    expect(shouldDeferCreatePreflight()).toBe(false);
  });

  it('applies OpenCode defaults once during bootstrap', () => {
    bootstrapFirstRunExperience({ hasTeams: false });

    expect(getStoredCreateTeamProvider()).toBe(FIRST_RUN_DEFAULT_PROVIDER);
    expect(getStoredCreateTeamModel(FIRST_RUN_DEFAULT_PROVIDER)).toBe(FIRST_RUN_DEFAULT_MODEL);
    expect(getStoredCreateTeamSkipPermissions()).toBe(false);

    localStorage.setItem('createTeam:lastSelectedProvider', 'anthropic');
    applyFirstRunCreateTeamDefaults();

    expect(getStoredCreateTeamProvider()).toBe('anthropic');
  });

  it('marks first run complete when teams already exist', () => {
    bootstrapFirstRunExperience({ hasTeams: true });

    expect(hasCompletedFirstRun()).toBe(true);
    expect(shouldShowFirstRunOnboarding(false)).toBe(false);
  });

  it('does not simplify create dialog when copying an existing team', () => {
    expect(shouldShowSimplifiedCreateDialog(true)).toBe(false);
  });
});
