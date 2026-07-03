import {
  loadDashboardCliStatusBannerCollapsed,
  saveDashboardCliStatusBannerCollapsed,
} from '@renderer/services/dashboardCliStatusBannerPreference';
import { afterEach, describe, expect, it } from 'vitest';

describe('dashboardCliStatusBannerPreference', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to collapsed when no preference is stored', () => {
    expect(loadDashboardCliStatusBannerCollapsed()).toBe(true);
  });

  it('persists expanded and collapsed preferences', () => {
    saveDashboardCliStatusBannerCollapsed(false);
    expect(loadDashboardCliStatusBannerCollapsed()).toBe(false);

    saveDashboardCliStatusBannerCollapsed(true);
    expect(loadDashboardCliStatusBannerCollapsed()).toBe(true);
  });
});
