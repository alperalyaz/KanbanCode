import {
  getStoredCreateTeamModel,
  getStoredCreateTeamProvider,
  getStoredCreateTeamSkipPermissions,
} from '@renderer/services/createTeamPreferences';
import {
  applyFirstRunCreateTeamDefaults,
  bootstrapFirstRunExperience,
  FIRST_RUN_DEFAULT_MODEL,
  FIRST_RUN_DEFAULT_PROVIDER,
  getFirstRunConnectPath,
  hasCompletedFirstRun,
  isFirstRunExperienceActive,
  isFirstRunFreeModelReady,
  markFirstRunComplete,
  setFirstRunConnectPath,
  shouldDeferCreatePreflight,
  shouldExpandProviderBannerOnDashboard,
  shouldShowFirstRunOnboarding,
  shouldShowSimplifiedCreateDialog,
} from '@renderer/services/firstRunExperience';
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

  it('treats free model as ready when OpenCode runtime is present', () => {
    expect(isFirstRunFreeModelReady({ runtimeReady: true, modelListedInCatalog: false })).toBe(
      true
    );
    expect(isFirstRunFreeModelReady({ runtimeReady: false, modelListedInCatalog: true })).toBe(
      true
    );
    expect(isFirstRunFreeModelReady({ runtimeReady: false, modelListedInCatalog: false })).toBe(
      false
    );
  });

  it('persists connect-and-go path selection', () => {
    expect(getFirstRunConnectPath()).toBeNull();
    setFirstRunConnectPath('connect');
    expect(getFirstRunConnectPath()).toBe('connect');
    setFirstRunConnectPath('free');
    expect(getFirstRunConnectPath()).toBe('free');
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
