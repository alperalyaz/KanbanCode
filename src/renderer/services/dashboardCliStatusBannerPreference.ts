const DASHBOARD_CLI_STATUS_BANNER_COLLAPSED_KEY = 'dashboard:cli-status-banner-collapsed';

export function loadDashboardCliStatusBannerCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_CLI_STATUS_BANNER_COLLAPSED_KEY);
    if (stored === null) {
      return true;
    }
    return stored === 'true';
  } catch {
    return true;
  }
}

export function saveDashboardCliStatusBannerCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(
      DASHBOARD_CLI_STATUS_BANNER_COLLAPSED_KEY,
      collapsed ? 'true' : 'false'
    );
  } catch {
    // Ignore storage failures and keep the dashboard responsive.
  }
}
