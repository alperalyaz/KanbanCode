import React, { useMemo, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { Button } from '@renderer/components/ui/button';
import {
  FIRST_RUN_DEFAULT_MODEL,
  FIRST_RUN_DEFAULT_PROVIDER,
  type FirstRunConnectPath,
  getFirstRunConnectPath,
  isFirstRunExperienceActive,
  isFirstRunFreeModelReady,
  setFirstRunConnectPath,
} from '@renderer/services/firstRunExperience';
import { useStore } from '@renderer/store';
import { requestProviderRuntimeChecks } from '@renderer/utils/requestProviderRuntimeChecks';
import { CheckCircle2, Circle, KeyRound, Loader2, Rocket, Sparkles } from 'lucide-react';
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

export const FirstRunOnboardingChecklist = ({
  hasTeams,
}: Readonly<FirstRunOnboardingChecklistProps>): React.JSX.Element | null => {
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
  const [connectPath, setConnectPath] = useState<FirstRunConnectPath | null>(() =>
    getFirstRunConnectPath()
  );

  const show = isFirstRunExperienceActive() && !hasTeams;
  const openCodeProvider = cliStatus?.providers.find(
    (provider) => provider.providerId === FIRST_RUN_DEFAULT_PROVIDER
  );
  const openCodeRuntimeReady =
    openCodeRuntimeStatus?.installed === true ||
    openCodeProvider?.backend?.kind === 'opencode-cli' ||
    Boolean(openCodeProvider?.models?.length);
  const openCodeModelListed = Boolean(
    openCodeProvider?.models?.includes(FIRST_RUN_DEFAULT_MODEL) ||
    openCodeProvider?.modelCatalog?.models.some((model) => model.id === FIRST_RUN_DEFAULT_MODEL)
  );
  const openCodeModelReady = isFirstRunFreeModelReady({
    runtimeReady: openCodeRuntimeReady,
    modelListedInCatalog: openCodeModelListed,
  });
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
        detail: openCodeRuntimeReady
          ? t('firstRun.steps.modelReadyDetail')
          : t('firstRun.steps.modelDetail'),
        done: openCodeModelReady,
        loading: providerChecksLoading && !openCodeModelReady && !openCodeRuntimeReady,
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

  const startCreate = (path: FirstRunConnectPath): void => {
    setFirstRunConnectPath(path);
    setConnectPath(path);
    void requestProviderRuntimeChecks({ force: true });
    openTeamsTabAndCreate();
  };

  return (
    <section
      className="mb-5 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-5 shadow-sm"
      data-testid="first-run-onboarding-checklist"
    >
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
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          data-testid="first-run-path-free"
          onClick={() => startCreate('free')}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            connectPath === 'free'
              ? 'border-emerald-500/45 bg-emerald-500/10'
              : 'border-border/80 bg-surface-raised/70 hover:border-emerald-500/35'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <Rocket className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
            {t('firstRun.paths.free.title')}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
            {t('firstRun.paths.free.description')}
          </p>
        </button>
        <button
          type="button"
          data-testid="first-run-path-connect"
          onClick={() => startCreate('connect')}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            connectPath === 'connect'
              ? 'border-amber-500/45 bg-amber-500/10'
              : 'border-border/80 bg-surface-raised/70 hover:border-amber-500/35'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <KeyRound className="size-4 shrink-0 text-amber-600 dark:text-amber-300" />
            {t('firstRun.paths.connect.title')}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
            {t('firstRun.paths.connect.description')}
          </p>
        </button>
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

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => startCreate(connectPath ?? 'free')}
          data-testid="first-run-quick-start"
        >
          <Rocket className="mr-2 size-4" />
          {t('firstRun.quickStart')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void requestProviderRuntimeChecks({ force: true })}
        >
          {t('cliStatus.actions.checkNow')}
        </Button>
      </div>
    </section>
  );
};
