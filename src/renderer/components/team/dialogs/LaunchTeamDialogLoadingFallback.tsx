import React from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Loader2 } from 'lucide-react';

type LaunchTeamDialogLoadingMode = 'launch' | 'relaunch';

interface LaunchTeamDialogLoadingFallbackProps {
  readonly mode: LaunchTeamDialogLoadingMode;
  readonly teamName?: string;
  readonly onClose: () => void;
}

export const LaunchTeamDialogLoadingFallback = ({
  mode,
  teamName,
  onClose,
}: LaunchTeamDialogLoadingFallbackProps): React.JSX.Element => {
  const { t } = useAppTranslation('team');
  const { t: tCommon } = useAppTranslation('common');

  const title = mode === 'relaunch' ? t('launch.title.relaunch') : t('launch.title.launch');

  const description =
    mode === 'relaunch'
      ? t('launch.description.relaunchPrefix')
      : t('launch.description.launchPrefix');

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-[52rem]">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          <DialogDescription className="text-xs">
            {description} <span className="font-mono font-medium">{teamName}</span>{' '}
            {mode === 'relaunch'
              ? t('launch.description.relaunchSuffix')
              : t('launch.description.launchSuffix')}
          </DialogDescription>
        </DialogHeader>
        <div
          className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2 text-xs text-[var(--color-text-muted)]"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
          <span>{tCommon('states.loading')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
