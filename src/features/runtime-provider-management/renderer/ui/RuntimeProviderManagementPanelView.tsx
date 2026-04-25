import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Play,
  RefreshCcw,
  Search,
  Star,
  Trash2,
} from 'lucide-react';

import {
  formatProviderState,
  formatRuntimeState,
  getProviderAction,
  getProviderModelsLabel,
} from '../../core/domain';

import type {
  RuntimeProviderManagementActions,
  RuntimeProviderManagementState,
} from '../hooks/useRuntimeProviderManagement';
import type {
  RuntimeProviderConnectionDto,
  RuntimeProviderModelDto,
  RuntimeProviderModelTestResultDto,
} from '@features/runtime-provider-management/contracts';
import type { JSX } from 'react';

interface RuntimeProviderManagementPanelViewProps {
  readonly state: RuntimeProviderManagementState;
  readonly actions: RuntimeProviderManagementActions;
  readonly disabled: boolean;
}

interface ProviderActionsProps {
  readonly provider: RuntimeProviderConnectionDto;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onStartConnect: () => void;
  readonly onUse: () => void;
  readonly onSetDefault: () => void;
  readonly onForget: () => void;
}

interface ProviderRowProps {
  readonly provider: RuntimeProviderConnectionDto;
  readonly state: RuntimeProviderManagementState;
  readonly active: boolean;
  readonly formOpen: boolean;
  readonly apiKeyValue: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly actions: RuntimeProviderManagementActions;
}

function stateClassName(provider: RuntimeProviderConnectionDto): string {
  switch (provider.state) {
    case 'connected':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
    case 'available':
      return 'border-sky-400/25 bg-sky-400/10 text-sky-200';
    case 'error':
      return 'border-red-400/25 bg-red-400/10 text-red-200';
    case 'ignored':
      return 'border-zinc-400/25 bg-zinc-400/10 text-zinc-300';
    case 'not-connected':
      return 'border-white/10 bg-white/[0.04] text-[var(--color-text-muted)]';
  }
}

function RuntimeSummary({
  state,
  onRefresh,
  disabled,
}: Pick<RuntimeProviderManagementPanelViewProps, 'state' | 'disabled'> & {
  onRefresh: () => void;
}): JSX.Element {
  const runtime = state.view?.runtime;
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: 'var(--color-border-subtle)',
        backgroundColor: 'rgba(255, 255, 255, 0.025)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            OpenCode runtime
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="border-white/10">
              {runtime ? formatRuntimeState(runtime) : state.loading ? 'Loading' : 'Unavailable'}
            </Badge>
            {runtime?.version ? (
              <span style={{ color: 'var(--color-text-secondary)' }}>v{runtime.version}</span>
            ) : null}
            {state.view?.defaultModel ? (
              <span className="break-all" style={{ color: 'var(--color-text-secondary)' }}>
                Default: {state.view.defaultModel}
              </span>
            ) : null}
          </div>
          {state.view?.diagnostics.length ? (
            <div
              className="mt-2 space-y-1 text-[11px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {state.view.diagnostics.slice(0, 3).map((diagnostic) => (
                <div key={diagnostic}>{diagnostic}</div>
              ))}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || state.loading}
          onClick={onRefresh}
        >
          {state.loading ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="mr-1 size-3.5" />
          )}
          Refresh
        </Button>
      </div>
    </div>
  );
}

function ProviderActions({
  provider,
  busy,
  disabled,
  onStartConnect,
  onUse,
  onSetDefault,
  onForget,
}: ProviderActionsProps): JSX.Element {
  const connect = getProviderAction(provider, 'connect');
  const use = getProviderAction(provider, 'use');
  const setDefault = getProviderAction(provider, 'set-default');
  const forget = getProviderAction(provider, 'forget');
  const configure = getProviderAction(provider, 'configure');

  if (connect) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || busy || !connect.enabled}
        title={connect.disabledReason ?? undefined}
        onClick={onStartConnect}
      >
        {busy ? (
          <Loader2 className="mr-1 size-3.5 animate-spin" />
        ) : (
          <KeyRound className="mr-1 size-3.5" />
        )}
        {connect.label}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {use ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy || !use.enabled}
          title={use.disabledReason ?? undefined}
          onClick={onUse}
        >
          <Play className="mr-1 size-3.5" />
          {use.label}
        </Button>
      ) : null}
      {setDefault ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || busy || !setDefault.enabled}
          title={setDefault.disabledReason ?? undefined}
          onClick={onSetDefault}
        >
          <Star className="mr-1 size-3.5" />
          {setDefault.label}
        </Button>
      ) : null}
      {forget ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || busy || !forget.enabled}
          title={forget.disabledReason ?? undefined}
          onClick={onForget}
        >
          {busy ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Trash2 className="mr-1 size-3.5" />
          )}
          {forget.label}
        </Button>
      ) : null}
      {configure ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled
          title={configure.disabledReason ?? undefined}
        >
          {configure.label}
        </Button>
      ) : null}
      {!use && !setDefault && !forget && !configure ? (
        <span className="text-xs text-[var(--color-text-muted)]">No actions</span>
      ) : null}
    </div>
  );
}

function ProviderRow({
  provider,
  state,
  active,
  formOpen,
  apiKeyValue,
  busy,
  disabled,
  actions,
}: ProviderRowProps): JSX.Element {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: active ? 'rgba(96, 165, 250, 0.4)' : 'var(--color-border-subtle)',
        backgroundColor: active ? 'rgba(96, 165, 250, 0.055)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="grid w-full grid-cols-[1fr_auto] items-start gap-3">
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => actions.selectProvider(provider.providerId)}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {provider.displayName}
            </span>
            {provider.recommended ? <Badge variant="secondary">Recommended</Badge> : null}
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] ${stateClassName(provider)}`}
            >
              {formatProviderState(provider)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {getProviderModelsLabel(provider)}
            </span>
            {provider.defaultModelId ? (
              <span className="break-all" style={{ color: 'var(--color-text-secondary)' }}>
                Default: {provider.defaultModelId}
              </span>
            ) : null}
            {provider.ownership.map((owner) => (
              <Badge
                key={owner}
                variant="outline"
                className="border-white/10 px-1.5 py-0 text-[10px]"
              >
                {owner}
              </Badge>
            ))}
          </div>
          {provider.detail ? (
            <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {provider.detail}
            </div>
          ) : null}
        </button>
        <div className="flex justify-end">
          <ProviderActions
            provider={provider}
            busy={busy}
            disabled={disabled}
            onStartConnect={() => actions.startConnect(provider.providerId)}
            onUse={() => actions.openModelPicker(provider.providerId, 'use')}
            onSetDefault={() => actions.openModelPicker(provider.providerId, 'runtime-default')}
            onForget={() => void actions.forgetProvider(provider.providerId)}
          />
        </div>
      </div>

      {formOpen ? (
        <div
          className="mt-3 rounded-md border p-3"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`runtime-provider-key-${provider.providerId}`} className="text-xs">
              {provider.displayName} API key
            </Label>
            <Input
              id={`runtime-provider-key-${provider.providerId}`}
              type="password"
              value={apiKeyValue}
              disabled={disabled || busy}
              onChange={(event) => actions.setApiKeyValue(event.target.value)}
              placeholder="Paste API key"
              className="h-9 text-sm"
              autoFocus
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={actions.cancelConnect}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled || busy || !apiKeyValue.trim()}
              onClick={() => void actions.submitConnect(provider.providerId)}
            >
              {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              Save key
            </Button>
          </div>
        </div>
      ) : null}

      {active && provider.state === 'connected' && provider.modelCount > 0 ? (
        <ProviderModelList
          state={state}
          actions={actions}
          provider={provider}
          disabled={disabled || busy}
        />
      ) : null}
    </div>
  );
}

function ModelBadges({ model }: { readonly model: RuntimeProviderModelDto }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="border-white/10 px-1.5 py-0 text-[10px]">
        {model.sourceLabel}
      </Badge>
      {model.free ? (
        <Badge className="bg-emerald-400/15 px-1.5 py-0 text-[10px] text-emerald-200">free</Badge>
      ) : null}
      {model.default ? (
        <Badge className="bg-amber-400/15 px-1.5 py-0 text-[10px] text-amber-200">default</Badge>
      ) : null}
    </div>
  );
}

function ModelResult({
  result,
}: {
  readonly result: RuntimeProviderModelTestResultDto | undefined;
}): JSX.Element | null {
  if (!result) {
    return null;
  }
  return (
    <div className={`mt-2 text-xs ${result.ok ? 'text-emerald-200' : 'text-red-200'}`}>
      {result.message}
    </div>
  );
}

function ModelRow({
  provider,
  model,
  selected,
  disabled,
  testing,
  savingDefault,
  result,
  actions,
  mode,
}: {
  readonly provider: RuntimeProviderConnectionDto;
  readonly model: RuntimeProviderModelDto;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly testing: boolean;
  readonly savingDefault: boolean;
  readonly result: RuntimeProviderModelTestResultDto | undefined;
  readonly actions: RuntimeProviderManagementActions;
  readonly mode: RuntimeProviderManagementState['modelPickerMode'];
}): JSX.Element {
  const useButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={() => actions.useModelForNewTeams(model.modelId)}
    >
      Use for new teams
    </Button>
  );
  const setDefaultButton = (
    <Button
      type="button"
      size="sm"
      variant={model.default ? 'ghost' : 'outline'}
      disabled={disabled || savingDefault}
      onClick={() => void actions.setDefaultModel(provider.providerId, model.modelId)}
    >
      {savingDefault ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
      Set OpenCode default
    </Button>
  );

  return (
    <div
      className="rounded-md border p-3"
      style={{
        borderColor: selected ? 'rgba(96, 165, 250, 0.45)' : 'var(--color-border-subtle)',
        backgroundColor: selected ? 'rgba(96, 165, 250, 0.06)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => actions.selectModel(model.modelId)}
        >
          <div className="break-all text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {model.displayName}
          </div>
          <div className="mt-1 break-all text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {model.modelId}
          </div>
          <div className="mt-2">
            <ModelBadges model={model} />
          </div>
        </button>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || testing}
            onClick={() => void actions.testModel(provider.providerId, model.modelId)}
          >
            {testing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Test
          </Button>
          {mode === 'runtime-default' ? setDefaultButton : useButton}
          {mode === 'runtime-default' ? useButton : setDefaultButton}
        </div>
      </div>
      <ModelResult result={result} />
    </div>
  );
}

function ProviderModelList({
  state,
  actions,
  provider,
  disabled,
}: {
  readonly state: RuntimeProviderManagementState;
  readonly actions: RuntimeProviderManagementActions;
  readonly provider: RuntimeProviderConnectionDto;
  readonly disabled: boolean;
}): JSX.Element {
  const pickerOpen = state.modelPickerProviderId === provider.providerId;

  return (
    <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[var(--color-text-muted)]" />
        <Input
          value={state.modelQuery}
          disabled={disabled || state.modelsLoading}
          onChange={(event) => actions.setModelQuery(event.target.value)}
          placeholder="Search models"
          className="h-9 pl-9 text-sm"
        />
      </div>

      {state.modelsError ? (
        <div className="rounded-md border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          {state.modelsError}
        </div>
      ) : null}

      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {!pickerOpen || state.modelsLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="size-4 animate-spin" />
            Loading models
          </div>
        ) : null}
        {pickerOpen && !state.modelsLoading && state.models.length === 0 && !state.modelsError ? (
          <div className="text-sm text-[var(--color-text-muted)]">No models found.</div>
        ) : null}
        {pickerOpen
          ? state.models.map((model) => (
              <ModelRow
                key={model.modelId}
                provider={provider}
                model={model}
                selected={state.selectedModelId === model.modelId}
                disabled={disabled}
                testing={state.testingModelId === model.modelId}
                savingDefault={state.savingDefaultModelId === model.modelId}
                result={state.modelResults[model.modelId]}
                actions={actions}
                mode={state.modelPickerMode}
              />
            ))
          : null}
      </div>
    </div>
  );
}

export function RuntimeProviderManagementPanelView({
  state,
  actions,
  disabled,
}: RuntimeProviderManagementPanelViewProps): JSX.Element {
  const selectedProviderId = state.selectedProviderId ?? state.providers[0]?.providerId ?? null;

  return (
    <div className="space-y-3">
      <RuntimeSummary state={state} disabled={disabled} onRefresh={() => void actions.refresh()} />

      {state.error ? (
        <div
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
          style={{
            borderColor: 'rgba(248, 113, 113, 0.25)',
            backgroundColor: 'rgba(248, 113, 113, 0.06)',
            color: '#fca5a5',
          }}
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      {state.successMessage ? (
        <div
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
          style={{
            borderColor: 'rgba(74, 222, 128, 0.25)',
            backgroundColor: 'rgba(74, 222, 128, 0.08)',
            color: '#86efac',
          }}
        >
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          <span>{state.successMessage}</span>
        </div>
      ) : null}

      <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
        {state.providers.map((provider) => (
          <ProviderRow
            key={provider.providerId}
            provider={provider}
            state={state}
            active={provider.providerId === selectedProviderId}
            formOpen={state.activeFormProviderId === provider.providerId}
            apiKeyValue={state.apiKeyValue}
            busy={state.savingProviderId === provider.providerId}
            disabled={disabled || state.loading}
            actions={actions}
          />
        ))}
      </div>

      {!state.loading && state.providers.length === 0 ? (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
          }}
        >
          No OpenCode providers reported by the managed runtime.
        </div>
      ) : null}
    </div>
  );
}
