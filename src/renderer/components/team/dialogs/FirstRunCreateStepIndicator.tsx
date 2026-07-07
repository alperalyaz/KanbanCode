import React from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { cn } from '@renderer/lib/utils';

interface FirstRunCreateStepIndicatorProps {
  currentStep: 1 | 2 | 3;
  className?: string;
}

const STEPS = [
  { id: 1, key: 'name' },
  { id: 2, key: 'project' },
  { id: 3, key: 'model' },
] as const;

export function FirstRunCreateStepIndicator({
  currentStep,
  className,
}: Readonly<FirstRunCreateStepIndicatorProps>): React.JSX.Element {
  const { t } = useAppTranslation('team');

  return (
    <div
      className={cn('rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3', className)}
    >
      <p className="mb-3 text-xs font-medium text-indigo-800 dark:text-indigo-200">
        {t('create.firstRun.intro')}
      </p>
      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((step) => {
          const active = step.id === currentStep;
          const complete = step.id < currentStep;
          return (
            <li
              key={step.id}
              className={cn(
                'rounded-md border px-3 py-2 text-xs',
                active
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100'
                  : complete
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200'
                    : 'border-border bg-surface-overlay text-text-muted'
              )}
            >
              <span className="font-semibold">{step.id}.</span>{' '}
              {t(`create.firstRun.steps.${step.key}`)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
