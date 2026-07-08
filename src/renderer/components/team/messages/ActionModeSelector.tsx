import { useAppTranslation } from '@features/localization/renderer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip';
import { cn } from '@renderer/lib/utils';

import type { AgentActionMode } from '@shared/types';

export type ActionMode = AgentActionMode;

interface ActionModeSelectorProps {
  value: ActionMode;
  onChange: (mode: ActionMode) => void;
  showDelegate: boolean;
  disabled?: boolean;
}

// "Do" is intentionally NOT a selectable chip. For a team, Delegate is the
// active default (the composer flips 'do' -> 'delegate' when teammates exist),
// and within Delegate mode the lead still auto-handles trivial one-step tasks
// itself. "Ask" (read-only) and "Delegate" are the two visible modes.
export const ActionModeSelector = ({
  value,
  onChange,
  showDelegate,
  disabled = false,
}: ActionModeSelectorProps): React.JSX.Element => {
  const { t } = useAppTranslation('team');
  const modeConfig: {
    mode: ActionMode;
    label: string;
    tooltip: string;
    activeClass: string;
    tooltipClass: string;
  }[] = [
    {
      mode: 'ask',
      label: t('messages.actionMode.ask'),
      tooltip: t('messages.actionMode.askTooltip'),
      activeClass: 'bg-blue-600 text-white',
      tooltipClass: 'bg-blue-600 border-blue-700 text-white',
    },
    {
      mode: 'delegate',
      label: t('messages.actionMode.delegate'),
      tooltip: t('messages.actionMode.delegateTooltip'),
      activeClass: 'bg-amber-500/80 text-white',
      tooltipClass: 'bg-amber-500/80 border-amber-600 text-white',
    },
  ];
  const modes = showDelegate ? modeConfig : modeConfig.filter((m) => m.mode !== 'delegate');

  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={300}>
      <div
        className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]"
        role="radiogroup"
        aria-label={t('messages.actionMode.label')}
      >
        {modes.map((cfg, idx) => {
          const isActive = value === cfg.mode;
          const isFirst = idx === 0;
          const isLast = idx === modes.length - 1;

          return (
            <Tooltip key={cfg.mode} disableHoverableContent>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-medium transition-colors',
                    isFirst && 'rounded-l-full',
                    isLast && 'rounded-r-full',
                    disabled && 'cursor-not-allowed opacity-50',
                    isActive
                      ? cfg.activeClass
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  )}
                  disabled={disabled}
                  onClick={() => onChange(cfg.mode)}
                >
                  {cfg.label}
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className={cn(cfg.tooltipClass, 'data-[state=closed]:animate-none')}
              >
                {cfg.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
