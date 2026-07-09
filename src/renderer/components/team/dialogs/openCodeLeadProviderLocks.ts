import type { MemberDraft } from '@renderer/components/team/members/membersEditorTypes';
import type { TeamProviderId } from '@shared/types';
import type { TFunction } from 'i18next';

const OPENCODE_LEAD_LOCKED_PROVIDERS = [
  'anthropic',
  'codex',
  'gemini',
] as const satisfies readonly TeamProviderId[];

/**
 * When the team lead is OpenCode, mixed-provider teammates are unsupported.
 * Disable non-OpenCode provider tabs on teammate model selectors.
 */
export function buildOpenCodeLeadTeammateProviderDisabledReasons(
  t: TFunction
): Partial<Record<TeamProviderId, string>> {
  const reason = t('modelSelector.openCodeLead.teammateProviderDisabled');
  return Object.fromEntries(
    OPENCODE_LEAD_LOCKED_PROVIDERS.map((providerId) => [providerId, reason])
  ) as Partial<Record<TeamProviderId, string>>;
}

export function buildOpenCodeLeadTeammateProviderDisabledBadges(
  t: TFunction
): Partial<Record<TeamProviderId, string>> {
  const badge = t('modelSelector.openCodeLead.teammateProviderBadge');
  return Object.fromEntries(
    OPENCODE_LEAD_LOCKED_PROVIDERS.map((providerId) => [providerId, badge])
  ) as Partial<Record<TeamProviderId, string>>;
}

/**
 * Coerce explicit non-OpenCode teammate provider overrides to OpenCode when the
 * lead is OpenCode, so the roster cannot stay in an unsupported mixed state.
 */
export function coerceTeammatesToOpenCodeForOpenCodeLead(members: MemberDraft[]): {
  members: MemberDraft[];
  changed: boolean;
} {
  let changed = false;
  const nextMembers = members.map((member) => {
    if (member.removedAt) {
      return member;
    }
    const providerId = member.providerId;
    if (!providerId || providerId === 'opencode') {
      return member;
    }
    changed = true;
    return {
      ...member,
      providerId: 'opencode' as const,
      providerBackendId: undefined,
      model: '',
      effort: undefined,
      fastMode: undefined,
    };
  });
  return { members: nextMembers, changed };
}
