import React, { useEffect } from 'react';

import { LocalizationProvider } from '@features/localization/renderer';
import { TooltipProvider } from '@renderer/components/ui/tooltip';

import { ConfirmDialog } from './components/common/ConfirmDialog';
import { ContextSwitchOverlay } from './components/common/ContextSwitchOverlay';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { TabbedLayout } from './components/layout/TabbedLayout';
import { ToolApprovalSheet } from './components/team/ToolApprovalSheet';
import { useThemeController } from './hooks/useTheme';
import { useStore } from './store';

declare global {
  interface Window {
    __claudeTeamsSplashStartedAt?: number;
  }
}

// Keep the splash visible briefly so a fast startup doesn't flash it.
const SPLASH_MIN_DURATION_MS = 300;
const SPLASH_FADE_MS = 240;

export const App = (): React.JSX.Element => {
  // Initialize theme on app load
  useThemeController();
  const appConfig = useStore((s) => s.appConfig);

  // Dismiss the static preload splash once the app has mounted.
  useEffect(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      const startedAt = window.__claudeTeamsSplashStartedAt ?? performance.now();
      const elapsed = performance.now() - startedAt;
      const exitDelay = Math.max(SPLASH_MIN_DURATION_MS - elapsed, 0);
      let removeTimer: number | undefined;

      const exitTimer = window.setTimeout(() => {
        splash.classList.add('splash-exiting');
        removeTimer = window.setTimeout(() => {
          splash.remove();
        }, SPLASH_FADE_MS);
      }, exitDelay);

      return () => {
        window.clearTimeout(exitTimer);
        if (removeTimer !== undefined) {
          window.clearTimeout(removeTimer);
        }
      };
    }

    return undefined;
  }, []);

  return (
    <LocalizationProvider appConfig={appConfig}>
      <ErrorBoundary>
        <TooltipProvider delayDuration={150} skipDelayDuration={1500}>
          <ContextSwitchOverlay />
          <TabbedLayout />
          <ConfirmDialog />
          <ToolApprovalSheet />
        </TooltipProvider>
      </ErrorBoundary>
    </LocalizationProvider>
  );
};
