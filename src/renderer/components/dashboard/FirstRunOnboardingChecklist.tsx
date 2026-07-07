import React, { useMemo } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { Button } from '@renderer/components/ui/button';
import {
  FIRST_RUN_DEFAULT_MODEL,
  FIRST_RUN_DEFAULT_PROVIDER,
  isFirstRunExperienceActive,
} from '@renderer/services/firstRunExperience';
import { useStore } from '@renderer/store';
import { requestProviderRuntimeChecks } from '@renderer/utils/requestProviderRuntimeChecks';
import { CheckCircle2, Circle, Loader2, Rocket, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

interface ChecklistStep {
  id: string;
  label: string;
  detail?: string;
  done: boolean;
  loading?: boolean;
}

interface FirstRunOnboardingChecklistProps {
  hasTeams: boolean;
}

export function FirstRunOnboardingChecklist({
  hasTeams,
}: Readonly<FirstRunOnboardingChecklistProps>): React.JSX.Element | null {
  const { t } = useAppTranslation('dashboard');
  const {
    cliStatus,
    cliStatusLoading,
    cliProviderStatusLoading,
    openCodeRuntimeStatus,
    openTeamsTabAndCreate,
  } = useStore(
    useShallow((state) => ({
      cliStatus: state.cliStatus,
      cliStatusLoading: state.cliStatusLoading,
      cliProviderStatusLoading: state.cliProviderStatusLoading,
      openCodeRuntimeStatus: state.openCodeRuntimeStatus,
      openTeamsTabAndCreate: state.openTeamsTabAndCreate,
    }))
  );

  const show = isFirstRunExperienceActive() && !hasTeams;
  const openCodeProvider = cliStatus?.providers.find(
    (provider) => provider.providerId === FIRST_RUN_DEFAULT_PROVIDER
  );
  const openCodeRuntimeReady =
    openCodeRuntimeStatus?.installed === true ||
    openCodeProvider?.backend?.kind === 'opencode-cli' ||
    Boolean(openCodeProvider?.models?.length);
  const openCodeModelReady = Boolean(
    openCodeProvider?.models?.includes(FIRST_RUN_DEFAULT_MODEL) ||
    openCodeProvider?.modelCatalog?.models.some((model) => model.id === FIRST_RUN_DEFAULT_MODEL)
  );
  const providerChecksLoading =
    cliStatusLoading ||
    cliProviderStatusLoading[FIRST_RUN_DEFAULT_PROVIDER] === true ||
    openCodeProvider?.modelCatalogRefreshState === 'loading';

  const steps = useMemo<ChecklistStep[]>(
    () => [
      {
        id: 'runtime',
        label: t('firstRun.steps.runtime'),
        detail: t('firstRun.steps.runtimeDetail'),
        done: openCodeRuntimeReady,
        loading: providerChecksLoading && !openCodeRuntimeReady,
      },
      {
        id: 'model',
        label: t('firstRun.steps.model'),
        detail: t('firstRun.steps.modelDetail'),
        done: openCodeModelReady,
        loading: providerChecksLoading && openCodeRuntimeReady && !openCodeModelReady,
      },
      {
        id: 'team',
        label: t('firstRun.steps.team'),
        detail: t('firstRun.steps.teamDetail'),
        done: false,
      },
    ],
    [openCodeModelReady, openCodeRuntimeReady, providerChecksLoading, t]
  );

  if (!show) {
    return null;
  }

  return (
    <section className="mb-5 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-200">
            <Sparkles className="size-4 shrink-0" />
            <span>{t('firstRun.title')}</span>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
            {t('firstRun.description')}
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0"
          onClick={() => {
            void requestProviderRuntimeChecks({ force: true });
            openTeamsTabAndCreate();
          }}
        >
          <Rocket className="mr-2 size-4" />
          {t('firstRun.quickStart')}
        </Button>
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.id}
            className="border-border/80 bg-surface-raised/70 rounded-lg border px-3 py-3"
          >
            <div className="flex items-start gap-2">
              {step.loading ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-indigo-500" />
              ) : step.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-text-muted" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{step.label}</p>
                {step.detail ? (
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">{step.detail}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
