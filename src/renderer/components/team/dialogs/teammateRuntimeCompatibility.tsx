import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '@renderer/api';
import { parseCliArgs } from '@shared/utils/cliArgsParser';
import { migrateProviderBackendId } from '@shared/utils/providerBackend';
import { normalizeOptionalTeamProviderId } from '@shared/utils/teamProvider';

import type { TmuxStatus } from '@features/tmux-installer/contracts';
import type { TeamProviderId } from '@shared/types';

type TeammateRuntimeIssueReason =
  | 'mixed-provider'
  | 'codex-native-runtime'
  | 'explicit-tmux-mode'
  | 'explicit-in-process-mode'
  | 'opencode-led-mixed-unsupported';

interface RuntimeMemberInput {
  id?: string;
  name: string;
  providerId?: TeamProviderId;
  providerBackendId?: string | null;
  removedAt?: number | string | null;
}

interface RuntimeIssue {
  reason: TeammateRuntimeIssueReason;
  memberId?: string;
  memberName?: string;
  memberProviderId?: TeamProviderId;
}

export interface TeammateRuntimeCompatibility {
  visible: boolean;
  blocksSubmission: boolean;
  checking: boolean;
  providerNoticeProviderId: TeamProviderId | null;
  title: string;
  message: string;
  details: string[];
  tmuxDetail: string | null;
  memberWarningById: Record<string, string>;
}

type RuntimeCompatibilityTranslationKey =
  | 'runtimeCompatibility.providers.anthropic'
  | 'runtimeCompatibility.providers.codex'
  | 'runtimeCompatibility.providers.gemini'
  | 'runtimeCompatibility.providers.opencode'
  | 'runtimeCompatibility.details.mixedProvidersNamed'
  | 'runtimeCompatibility.details.mixedProviders'
  | 'runtimeCompatibility.details.openCodeLedMixedNamed'
  | 'runtimeCompatibility.details.openCodeLedMixed'
  | 'runtimeCompatibility.details.codexNativeNamed'
  | 'runtimeCompatibility.details.codexNative'
  | 'runtimeCompatibility.details.explicitTmux'
  | 'runtimeCompatibility.details.explicitInProcess'
  | 'runtimeCompatibility.details.fixOpenCodeLead'
  | 'runtimeCompatibility.details.fixInProcess'
  | 'runtimeCompatibility.details.fixTmux'
  | 'runtimeCompatibility.member.mixedProvider'
  | 'runtimeCompatibility.member.codexNative'
  | 'runtimeCompatibility.member.openCodeLedMixed'
  | 'runtimeCompatibility.title.checkingTmux'
  | 'runtimeCompatibility.title.openCodeLedMixed'
  | 'runtimeCompatibility.title.inProcessBlocked'
  | 'runtimeCompatibility.title.tmuxNotReady'
  | 'runtimeCompatibility.message.checkingTmux'
  | 'runtimeCompatibility.message.openCodeLedMixed'
  | 'runtimeCompatibility.message.inProcessBlocked'
  | 'runtimeCompatibility.message.tmuxNotReady';

type RuntimeCompatibilityTranslate = (
  key: RuntimeCompatibilityTranslationKey,
  options?: Record<string, unknown>
) => string;

interface AnalyzeTeammateRuntimeCompatibilityInput {
  leadProviderId: TeamProviderId;
  leadProviderBackendId?: string | null;
  members: readonly RuntimeMemberInput[];
  soloTeam?: boolean;
  extraCliArgs?: string;
  tmuxStatus: TmuxStatus | null;
  tmuxStatusLoading: boolean;
  tmuxStatusError: string | null;
  /** i18n translator scoped to the `team` namespace (e.g. useAppTranslation('team').t). */
  t: RuntimeCompatibilityTranslate;
}

export interface TmuxRuntimeReadiness {
  status: TmuxStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const PROVIDER_LABEL_KEYS: Record<TeamProviderId, RuntimeCompatibilityTranslationKey> = {
  anthropic: 'runtimeCompatibility.providers.anthropic',
  codex: 'runtimeCompatibility.providers.codex',
  gemini: 'runtimeCompatibility.providers.gemini',
  opencode: 'runtimeCompatibility.providers.opencode',
};

function getProviderLabel(t: RuntimeCompatibilityTranslate, providerId: TeamProviderId): string {
  return t(PROVIDER_LABEL_KEYS[providerId]);
}

function getExplicitTeammateMode(
  rawExtraCliArgs: string | undefined
): 'auto' | 'tmux' | 'in-process' | null {
  const tokens = parseCliArgs(rawExtraCliArgs);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    // eslint-disable-next-line security/detect-possible-timing-attacks -- parsing UI CLI flags, not comparing secrets
    if (token === '--teammate-mode') {
      const value = tokens[index + 1];
      return value === 'auto' || value === 'tmux' || value === 'in-process' ? value : null;
    }
    if (token.startsWith('--teammate-mode=')) {
      const value = token.slice('--teammate-mode='.length);
      return value === 'auto' || value === 'tmux' || value === 'in-process' ? value : null;
    }
  }
  return null;
}

function isTmuxRuntimeReady(status: TmuxStatus | null): boolean {
  return status?.effective.available === true && status.effective.runtimeReady === true;
}

function getTmuxDetail(status: TmuxStatus | null, error: string | null): string | null {
  if (error) {
    return error;
  }
  return status?.effective.detail ?? status?.wsl?.statusDetail ?? status?.error ?? null;
}

function summarizeIssueNames(
  issues: readonly RuntimeIssue[],
  reason: TeammateRuntimeIssueReason
): string {
  const names = issues
    .filter((issue) => issue.reason === reason)
    .map((issue) => issue.memberName)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) {
    return '';
  }
  if (names.length <= 3) {
    return names.join(', ');
  }
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

export function analyzeTeammateRuntimeCompatibility({
  leadProviderId,
  leadProviderBackendId,
  members,
  soloTeam = false,
  extraCliArgs,
  tmuxStatus,
  tmuxStatusLoading,
  tmuxStatusError,
  t,
}: AnalyzeTeammateRuntimeCompatibilityInput): TeammateRuntimeCompatibility {
  const activeMembers = soloTeam
    ? []
    : members.filter((member) => member.removedAt == null && member.name.trim().length > 0);
  const explicitTeammateMode = getExplicitTeammateMode(extraCliArgs);
  const leadBackendId = migrateProviderBackendId(leadProviderId, leadProviderBackendId);
  const issues: RuntimeIssue[] = [];

  if (explicitTeammateMode === 'tmux' && activeMembers.length > 0) {
    issues.push({ reason: 'explicit-tmux-mode' });
  }

  for (const member of activeMembers) {
    const memberProviderId = normalizeOptionalTeamProviderId(member.providerId) ?? leadProviderId;
    const memberName = member.name.trim();
    if (memberProviderId !== leadProviderId) {
      if (leadProviderId !== 'opencode' && memberProviderId === 'opencode') {
        continue;
      }
      if (leadProviderId === 'opencode') {
        issues.push({
          reason: 'opencode-led-mixed-unsupported',
          memberId: member.id,
          memberName,
          memberProviderId,
        });
        continue;
      }
      issues.push({
        reason: 'mixed-provider',
        memberId: member.id,
        memberName,
        memberProviderId,
      });
      continue;
    }

    const memberBackendId = migrateProviderBackendId(
      memberProviderId,
      member.providerBackendId ?? leadBackendId
    );
    if (memberProviderId === 'codex' && memberBackendId === 'codex-native') {
      issues.push({
        reason: 'codex-native-runtime',
        memberId: member.id,
        memberName,
        memberProviderId,
      });
    }
  }

  const requiresSeparateProcess = issues.some(
    (issue) => issue.reason === 'mixed-provider' || issue.reason === 'codex-native-runtime'
  );
  if (explicitTeammateMode === 'in-process' && requiresSeparateProcess) {
    issues.push({ reason: 'explicit-in-process-mode' });
  }

  if (issues.length === 0) {
    return {
      visible: false,
      blocksSubmission: false,
      checking: false,
      providerNoticeProviderId: null,
      title: '',
      message: '',
      details: [],
      tmuxDetail: null,
      memberWarningById: {},
    };
  }

  const tmuxReady = isTmuxRuntimeReady(tmuxStatus);
  const hasOpenCodeLeadMixedUnsupported = issues.some(
    (issue) => issue.reason === 'opencode-led-mixed-unsupported'
  );
  const hasExplicitTmux = issues.some((issue) => issue.reason === 'explicit-tmux-mode');
  const hasExplicitInProcess = issues.some((issue) => issue.reason === 'explicit-in-process-mode');
  if (!hasOpenCodeLeadMixedUnsupported && !hasExplicitTmux && !hasExplicitInProcess) {
    return {
      visible: false,
      blocksSubmission: false,
      checking: false,
      providerNoticeProviderId: null,
      title: '',
      message: '',
      details: [],
      tmuxDetail: null,
      memberWarningById: {},
    };
  }

  if (tmuxReady && hasExplicitTmux && !hasOpenCodeLeadMixedUnsupported && !hasExplicitInProcess) {
    return {
      visible: false,
      blocksSubmission: false,
      checking: false,
      providerNoticeProviderId: null,
      title: '',
      message: '',
      details: [],
      tmuxDetail: null,
      memberWarningById: {},
    };
  }

  const checking =
    hasExplicitTmux &&
    !hasOpenCodeLeadMixedUnsupported &&
    !hasExplicitInProcess &&
    tmuxStatusLoading &&
    !tmuxStatus;
  const blocksSubmission = true;
  const hasMixedProviders = issues.some((issue) => issue.reason === 'mixed-provider');
  const hasCodexNative = issues.some((issue) => issue.reason === 'codex-native-runtime');
  const details: string[] = [];
  const memberWarningById: Record<string, string> = {};
  const leadLabel = getProviderLabel(t, leadProviderId);

  if (hasMixedProviders) {
    const names = summarizeIssueNames(issues, 'mixed-provider');
    details.push(
      names
        ? t('runtimeCompatibility.details.mixedProvidersNamed', {
            names,
            lead: leadLabel,
          })
        : t('runtimeCompatibility.details.mixedProviders')
    );
  }
  if (hasOpenCodeLeadMixedUnsupported) {
    const names = summarizeIssueNames(issues, 'opencode-led-mixed-unsupported');
    details.push(
      names
        ? t('runtimeCompatibility.details.openCodeLedMixedNamed', { names })
        : t('runtimeCompatibility.details.openCodeLedMixed')
    );
  }
  if (hasCodexNative) {
    const names = summarizeIssueNames(issues, 'codex-native-runtime');
    details.push(
      names
        ? t('runtimeCompatibility.details.codexNativeNamed', { names })
        : t('runtimeCompatibility.details.codexNative')
    );
  }
  if (hasExplicitTmux) {
    details.push(t('runtimeCompatibility.details.explicitTmux'));
  }
  if (hasExplicitInProcess) {
    details.push(t('runtimeCompatibility.details.explicitInProcess'));
  }
  if (hasOpenCodeLeadMixedUnsupported) {
    details.push(t('runtimeCompatibility.details.fixOpenCodeLead'));
  } else if (hasExplicitInProcess) {
    details.push(t('runtimeCompatibility.details.fixInProcess'));
  } else {
    details.push(t('runtimeCompatibility.details.fixTmux'));
  }

  for (const issue of issues) {
    if (!issue.memberId || !issue.memberName) {
      continue;
    }
    const memberProviderLabel = getProviderLabel(t, issue.memberProviderId ?? leadProviderId);
    if (issue.reason === 'mixed-provider') {
      memberWarningById[issue.memberId] = t('runtimeCompatibility.member.mixedProvider', {
        name: issue.memberName,
        provider: memberProviderLabel,
        lead: leadLabel,
      });
    } else if (issue.reason === 'codex-native-runtime') {
      memberWarningById[issue.memberId] = t('runtimeCompatibility.member.codexNative', {
        name: issue.memberName,
      });
    } else if (issue.reason === 'opencode-led-mixed-unsupported') {
      memberWarningById[issue.memberId] = t('runtimeCompatibility.member.openCodeLedMixed', {
        name: issue.memberName,
        provider: memberProviderLabel,
      });
    }
  }

  return {
    visible: blocksSubmission || checking,
    blocksSubmission,
    checking,
    providerNoticeProviderId: hasOpenCodeLeadMixedUnsupported ? 'opencode' : null,
    title: checking
      ? t('runtimeCompatibility.title.checkingTmux')
      : hasOpenCodeLeadMixedUnsupported
        ? t('runtimeCompatibility.title.openCodeLedMixed')
        : hasExplicitInProcess
          ? t('runtimeCompatibility.title.inProcessBlocked')
          : t('runtimeCompatibility.title.tmuxNotReady'),
    message: checking
      ? t('runtimeCompatibility.message.checkingTmux')
      : hasOpenCodeLeadMixedUnsupported
        ? t('runtimeCompatibility.message.openCodeLedMixed')
        : hasExplicitInProcess
          ? t('runtimeCompatibility.message.inProcessBlocked')
          : t('runtimeCompatibility.message.tmuxNotReady'),
    details,
    tmuxDetail: hasOpenCodeLeadMixedUnsupported ? null : getTmuxDetail(tmuxStatus, tmuxStatusError),
    memberWarningById,
  };
}

export function useTmuxRuntimeReadiness(enabled: boolean): TmuxRuntimeReadiness {
  const [status, setStatus] = useState<TmuxStatus | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (typeof api.tmux?.getStatus !== 'function') {
        throw new Error('tmux status API is not available. Restart the app.');
      }
      const nextStatus = await api.tmux.getStatus();
      setStatus(nextStatus);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load tmux status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    if (typeof api.tmux?.onProgress !== 'function') {
      return undefined;
    }
    return api.tmux.onProgress(() => {
      void refresh();
    });
  }, [enabled, refresh]);

  const effectiveLoading = enabled && (loading || (!status && !error));

  return useMemo(
    () => ({
      status,
      loading: effectiveLoading,
      error,
      refresh,
    }),
    [effectiveLoading, error, refresh, status]
  );
}
