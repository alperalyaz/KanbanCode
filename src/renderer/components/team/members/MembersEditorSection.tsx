import React, { useMemo, useRef, useState } from 'react';

import { useAppTranslation } from '@features/localization/renderer';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Label } from '@renderer/components/ui/label';
import { CUSTOM_ROLE, NO_ROLE } from '@renderer/constants/teamRoles';
import { cn } from '@renderer/lib/utils';
import { isTeamEffortLevel } from '@shared/utils/effortLevels';
import { migrateProviderBackendId } from '@shared/utils/providerBackend';
import { normalizeTeamMemberMcpPolicy } from '@shared/utils/teamMemberMcpPolicy';
import { GitBranch, Plug, Plus } from 'lucide-react';

import { MemberDraftRow } from './MemberDraftRow';
import {
  getNextSuggestedMemberName,
  resolveMemberNameLocale,
  canonicalizeThemedMemberName,
} from './memberNameSets';
import {
  buildMemberDraftColorMap,
  buildMemberDraftSuggestions,
  createMemberDraft,
} from './membersEditorUtils';

import type { MemberDraft } from './membersEditorTypes';
import type { InlineChip } from '@renderer/types/inlineChip';
import type { MentionSuggestion } from '@renderer/types/mention';
import type { EffortLevel, TeamProviderId } from '@shared/types';

function cloneMcpPolicy(policy: MemberDraft['mcpPolicy']): MemberDraft['mcpPolicy'] {
  const normalized = normalizeTeamMemberMcpPolicy(policy);
  if (!normalized) {
    return undefined;
  }
  return {
    mode: normalized.mode,
    ...(normalized.scopes ? { scopes: { ...normalized.scopes } } : {}),
    ...(normalized.serverNames ? { serverNames: [...normalized.serverNames] } : {}),
  };
}

function forceActiveMembersToAgentTeamsMcp(drafts: MemberDraft[]): MemberDraft[] {
  return drafts.map((member) =>
    member.removedAt ? member : { ...member, mcpPolicy: { mode: 'appOnly' as const } }
  );
}

export interface MembersEditorSectionProps {
  members: MemberDraft[];
  onChange: (members: MemberDraft[]) => void;
  fieldError?: string;
  validateMemberName?: (name: string) => string | null;
  showWorkflow?: boolean;
  /** Prefix for draft persistence keys (e.g. 'createTeam' or 'editTeam:team-alpha') */
  draftKeyPrefix?: string;
  /** Project path for @file mentions in workflow */
  projectPath?: string | null;
  /** Task suggestions for #task references in workflow */
  taskSuggestions?: MentionSuggestion[];
  /** Team suggestions for @@team mentions in workflow */
  teamSuggestions?: MentionSuggestion[];
  /** Called before workflow mention suggestions are needed. */
  onWorkflowSuggestionsNeeded?: () => void;
  /** Extra content rendered right below the "Members" label row */
  headerExtra?: React.ReactNode;
  /** When true, hides member rows and action buttons (label + headerExtra still visible) */
  hideContent?: boolean;
  /** Existing team members — used to reserve their colors so drafts get the next available ones */
  existingMembers?: readonly { name: string; color?: string; removedAt?: number | string | null }[];
  /** Pre-resolved member colors from the live Team view. */
  existingMemberColorMap?: ReadonlyMap<string, string>;
  /** Default provider to use for newly added member rows. */
  defaultProviderId?: TeamProviderId;
  /** When true, provider/model controls stay read-only for existing rows. */
  lockProviderModel?: boolean;
  /** When true, existing teammate names stay read-only while the team is live. */
  lockExistingMemberIdentity?: boolean;
  identityLockReason?: string;
  inheritedProviderId?: TeamProviderId;
  inheritedModel?: string;
  inheritedEffort?: EffortLevel;
  limitContext?: boolean;
  inheritModelSettingsByDefault?: boolean;
  forceInheritedModelSettings?: boolean;
  modelLockReason?: string;
  softDeleteMembers?: boolean;
  memberWarningById?: Record<string, string | null | undefined>;
  memberInfoById?: Record<string, string | null | undefined>;
  disableGeminiOption?: boolean;
  memberModelIssueById?: Record<string, string | null | undefined>;
  modelAdvisoryReasonByProvider?: Partial<
    Record<TeamProviderId, Partial<Record<string, string | null | undefined>>>
  >;
  modelIssueReasonByProvider?: Partial<
    Record<TeamProviderId, Partial<Record<string, string | null | undefined>>>
  >;
  modelUnavailableReasonByProvider?: Partial<
    Record<TeamProviderId, Partial<Record<string, string | null | undefined>>>
  >;
  disableAddMember?: boolean;
  addMemberLockReason?: string;
  /** When true, renders the "Add member" button as a prominent full-width primary CTA. */
  emphasizeAddMember?: boolean;
  showWorktreeIsolationControls?: boolean;
  teammateWorktreeDefault?: boolean;
  worktreeIsolationDisabledReason?: string | null;
  onTeammateWorktreeDefaultChange?: (enabled: boolean) => void;
  /** Extra classes for the scrollable member-row container (e.g. fixed max height). */
  memberListClassName?: string;
  onOpenProviderSettings?: (providerId: TeamProviderId) => void;
}

export const MembersEditorSection = ({
  members,
  onChange,
  fieldError,
  validateMemberName,
  showWorkflow = false,
  draftKeyPrefix,
  projectPath,
  taskSuggestions,
  teamSuggestions,
  onWorkflowSuggestionsNeeded,
  headerExtra,
  hideContent = false,
  existingMembers,
  existingMemberColorMap,
  defaultProviderId = 'anthropic',
  lockProviderModel = false,
  lockExistingMemberIdentity = false,
  identityLockReason,
  inheritedProviderId,
  inheritedModel,
  inheritedEffort,
  limitContext = false,
  inheritModelSettingsByDefault = false,
  forceInheritedModelSettings = false,
  modelLockReason,
  softDeleteMembers = false,
  memberWarningById,
  memberInfoById,
  disableGeminiOption = false,
  memberModelIssueById,
  modelAdvisoryReasonByProvider,
  modelIssueReasonByProvider,
  modelUnavailableReasonByProvider,
  disableAddMember = false,
  addMemberLockReason,
  emphasizeAddMember = false,
  showWorktreeIsolationControls = false,
  teammateWorktreeDefault = false,
  worktreeIsolationDisabledReason,
  onTeammateWorktreeDefaultChange,
  memberListClassName,
  onOpenProviderSettings,
}: MembersEditorSectionProps): React.JSX.Element => {
  const { t, resolvedLanguage } = useAppTranslation('team');
  const memberNameLocale = resolveMemberNameLocale(resolvedLanguage);
  const [agentTeamsMcpLockedForAll, setAgentTeamsMcpLockedForAll] = useState(false);
  const previousMcpPolicyByMemberIdRef = useRef<Map<string, MemberDraft['mcpPolicy']>>(new Map());

  const emitMembersChange = (nextMembers: MemberDraft[]): void => {
    onChange(
      agentTeamsMcpLockedForAll ? forceActiveMembersToAgentTeamsMcp(nextMembers) : nextMembers
    );
  };

  const updateMemberName = (memberId: string, name: string): void => {
    emitMembersChange(members.map((c) => (c.id === memberId ? { ...c, name } : c)));
  };

  const finalizeMemberName = (memberId: string, name: string): void => {
    const canonical = canonicalizeThemedMemberName(name, memberNameLocale);
    if (canonical !== name) {
      updateMemberName(memberId, canonical);
    }
  };

  const updateMemberRole = (memberId: string, roleSelection: string): void => {
    const resolvedRole = roleSelection === NO_ROLE ? '' : roleSelection;
    emitMembersChange(
      members.map((c) =>
        c.id === memberId
          ? {
              ...c,
              roleSelection: resolvedRole,
              customRole: resolvedRole === CUSTOM_ROLE ? c.customRole : '',
            }
          : c
      )
    );
  };

  const updateMemberCustomRole = (memberId: string, customRole: string): void => {
    emitMembersChange(members.map((c) => (c.id === memberId ? { ...c, customRole } : c)));
  };

  const updateMemberWorkflow = (memberId: string, workflow: string): void => {
    emitMembersChange(members.map((c) => (c.id === memberId ? { ...c, workflow } : c)));
  };

  const updateMemberWorkflowChips = (memberId: string, workflowChips: InlineChip[]): void => {
    emitMembersChange(members.map((c) => (c.id === memberId ? { ...c, workflowChips } : c)));
  };

  const updateMemberProvider = (memberId: string, providerId: TeamProviderId): void => {
    emitMembersChange(
      members.map((c) =>
        c.id === memberId
          ? (() => {
              const previousProviderId = c.providerId ?? inheritedProviderId;
              const providerChanged = previousProviderId !== providerId;
              return {
                ...c,
                providerId,
                providerBackendId: migrateProviderBackendId(providerId, c.providerBackendId),
                model: providerChanged ? '' : c.model,
                effort: providerChanged ? undefined : c.effort,
                fastMode: providerChanged ? undefined : c.fastMode,
              };
            })()
          : c
      )
    );
  };

  const updateMemberModel = (memberId: string, model: string): void => {
    emitMembersChange(members.map((c) => (c.id === memberId ? { ...c, model } : c)));
  };

  const updateMemberEffort = (memberId: string, effort: string): void => {
    emitMembersChange(
      members.map((c) =>
        c.id === memberId
          ? {
              ...c,
              effort: isTeamEffortLevel(effort) ? effort : undefined,
            }
          : c
      )
    );
  };

  const updateMemberIsolation = (memberId: string, enabled: boolean): void => {
    if (enabled && worktreeIsolationDisabledReason) {
      return;
    }
    emitMembersChange(
      members.map((c) =>
        c.id === memberId ? { ...c, isolation: enabled ? 'worktree' : undefined } : c
      )
    );
  };

  const updateMemberMcpPolicy = (memberId: string, mcpPolicy: MemberDraft['mcpPolicy']): void => {
    if (agentTeamsMcpLockedForAll) {
      return;
    }
    emitMembersChange(
      members.map((c) =>
        c.id === memberId ? { ...c, mcpPolicy: normalizeTeamMemberMcpPolicy(mcpPolicy) } : c
      )
    );
  };

  const updateAgentTeamsMcpLock = (enabled: boolean): void => {
    if (enabled) {
      const previous = new Map<string, MemberDraft['mcpPolicy']>();
      for (const member of members) {
        previous.set(member.id, cloneMcpPolicy(member.mcpPolicy));
      }
      previousMcpPolicyByMemberIdRef.current = previous;
      setAgentTeamsMcpLockedForAll(true);
      onChange(forceActiveMembersToAgentTeamsMcp(members));
      return;
    }

    setAgentTeamsMcpLockedForAll(false);
    const previous = previousMcpPolicyByMemberIdRef.current;
    onChange(
      members.map((member) => ({
        ...member,
        mcpPolicy: cloneMcpPolicy(previous.get(member.id)),
      }))
    );
    previous.clear();
  };

  const updateTeammateWorktreeDefault = (enabled: boolean): void => {
    if (enabled && worktreeIsolationDisabledReason) {
      return;
    }
    onTeammateWorktreeDefaultChange?.(enabled);
    emitMembersChange(
      members.map((member) =>
        member.removedAt ? member : { ...member, isolation: enabled ? 'worktree' : undefined }
      )
    );
  };

  const removeMember = (memberId: string): void => {
    if (!softDeleteMembers) {
      emitMembersChange(members.filter((c) => c.id !== memberId));
      return;
    }
    emitMembersChange(
      members.map((member) =>
        member.id === memberId ? { ...member, removedAt: member.removedAt ?? Date.now() } : member
      )
    );
  };

  const restoreMember = (memberId: string): void => {
    emitMembersChange(
      members.map((member) => (member.id === memberId ? { ...member, removedAt: null } : member))
    );
  };

  const activeMembers = members.filter((member) => !member.removedAt);
  const removedMembers = members.filter((member) => member.removedAt);
  const activeWorktreeMemberCount = activeMembers.filter(
    (member) => member.isolation === 'worktree'
  ).length;
  const allActiveMembersUseWorktrees =
    activeMembers.length > 0 && activeWorktreeMemberCount === activeMembers.length;
  const someActiveMembersUseWorktrees = activeWorktreeMemberCount > 0;
  const teammateWorktreeDefaultChecked: boolean | 'indeterminate' = allActiveMembersUseWorktrees
    ? true
    : someActiveMembersUseWorktrees
      ? 'indeterminate'
      : false;
  const newMemberUsesWorktree =
    allActiveMembersUseWorktrees || (activeMembers.length === 0 && teammateWorktreeDefault);
  const worktreeDefaultDisabled = Boolean(
    worktreeIsolationDisabledReason && !allActiveMembersUseWorktrees
  );

  const addMember = (): void => {
    const suggestedName = getNextSuggestedMemberName(
      members.map((member) => member.name),
      memberNameLocale
    );
    emitMembersChange([
      ...members,
      createMemberDraft(
        inheritModelSettingsByDefault
          ? {
              name: suggestedName,
              isolation: newMemberUsesWorktree ? 'worktree' : undefined,
            }
          : {
              name: suggestedName,
              providerId: defaultProviderId,
              isolation: newMemberUsesWorktree ? 'worktree' : undefined,
            }
      ),
    ]);
  };

  const names = activeMembers.map((m) => m.name.trim().toLocaleLowerCase('tr')).filter(Boolean);
  const hasDuplicates = new Set(names).size !== names.length;
  const memberColorMap = useMemo(
    () => buildMemberDraftColorMap(members, existingMembers, existingMemberColorMap),
    [members, existingMembers, existingMemberColorMap]
  );
  const worktreeDefaultControlId = useMemo(
    () =>
      `teammate-worktree-default-${(draftKeyPrefix ?? 'default').replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    [draftKeyPrefix]
  );
  const agentTeamsMcpDefaultControlId = useMemo(
    () =>
      `teammate-agent-teams-mcp-default-${(draftKeyPrefix ?? 'default').replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    [draftKeyPrefix]
  );

  const mentionSuggestions = useMemo(
    () => buildMemberDraftSuggestions(members, memberColorMap),
    [members, memberColorMap]
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{t('members.editor.title')}</Label>
        {!hideContent && (
          <div className={cn('flex gap-2', emphasizeAddMember && 'w-full')}>
            <Button
              variant={emphasizeAddMember ? 'default' : 'outline'}
              size="sm"
              className={cn('gap-1.5', emphasizeAddMember && 'w-full justify-center')}
              onClick={addMember}
              disabled={disableAddMember}
              title={disableAddMember ? addMemberLockReason : undefined}
            >
              <Plus className="size-3.5" />
              {t('members.editor.addMember')}
            </Button>
          </div>
        )}
      </div>
      {headerExtra}
      {!hideContent ? (
        <div className="space-y-1 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
          <p>{t('roleSelect.selectionHint')}</p>
        </div>
      ) : null}
      {!hideContent && (
        <>
          {disableAddMember && addMemberLockReason ? (
            <p className="text-[11px] text-[var(--color-text-muted)]">{addMemberLockReason}</p>
          ) : null}
          <div
            className={
              showWorktreeIsolationControls
                ? 'overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]'
                : undefined
            }
          >
            {showWorktreeIsolationControls ? (
              <div
                className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-2.5 py-2"
                title={worktreeIsolationDisabledReason ?? undefined}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Checkbox
                    id={worktreeDefaultControlId}
                    checked={teammateWorktreeDefaultChecked}
                    disabled={worktreeDefaultDisabled}
                    onCheckedChange={(checked) => updateTeammateWorktreeDefault(checked === true)}
                  />
                  <Label
                    htmlFor={worktreeDefaultControlId}
                    className="flex min-w-0 cursor-pointer items-center gap-1.5 text-xs font-normal text-[var(--color-text-secondary)]"
                  >
                    <GitBranch className="size-3.5 shrink-0" />
                    <span className="truncate">{t('members.editor.runInSeparateWorktrees')}</span>
                  </Label>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Checkbox
                    id={agentTeamsMcpDefaultControlId}
                    checked={agentTeamsMcpLockedForAll}
                    onCheckedChange={(checked) => updateAgentTeamsMcpLock(checked === true)}
                  />
                  <Label
                    htmlFor={agentTeamsMcpDefaultControlId}
                    className="flex cursor-pointer items-center gap-1.5 text-xs font-normal text-[var(--color-text-secondary)]"
                  >
                    <Plug className="size-3.5 shrink-0" />
                    <span className="whitespace-nowrap">
                      {t('members.editor.agentTeamsMcpOnly')}
                    </span>
                  </Label>
                </div>
              </div>
            ) : null}
            <div
              className={cn(
                'space-y-2',
                showWorktreeIsolationControls && 'p-2',
                memberListClassName
              )}
            >
              {activeMembers.map((member, index) => (
                <MemberDraftRow
                  key={member.id}
                  member={member}
                  index={index}
                  resolvedColor={memberColorMap.get(member.id)}
                  nameError={validateMemberName?.(member.name) ?? null}
                  onNameChange={updateMemberName}
                  onNameBlur={finalizeMemberName}
                  onRoleChange={updateMemberRole}
                  onCustomRoleChange={updateMemberCustomRole}
                  onRemove={removeMember}
                  showWorkflow={showWorkflow}
                  onWorkflowChange={showWorkflow ? updateMemberWorkflow : undefined}
                  onWorkflowChipsChange={showWorkflow ? updateMemberWorkflowChips : undefined}
                  onProviderChange={updateMemberProvider}
                  onModelChange={updateMemberModel}
                  onEffortChange={updateMemberEffort}
                  showWorktreeIsolationControls={showWorktreeIsolationControls}
                  worktreeIsolationDisabledReason={worktreeIsolationDisabledReason}
                  onWorktreeIsolationChange={updateMemberIsolation}
                  onMcpPolicyChange={updateMemberMcpPolicy}
                  agentTeamsMcpLocked={agentTeamsMcpLockedForAll}
                  inheritedProviderId={inheritedProviderId}
                  inheritedModel={inheritedModel}
                  inheritedEffort={inheritedEffort}
                  limitContext={limitContext}
                  forceInheritedModelSettings={forceInheritedModelSettings}
                  draftKeyPrefix={draftKeyPrefix}
                  projectPath={projectPath}
                  mentionSuggestions={mentionSuggestions}
                  taskSuggestions={taskSuggestions}
                  teamSuggestions={teamSuggestions}
                  onWorkflowSuggestionsNeeded={onWorkflowSuggestionsNeeded}
                  lockProviderModel={lockProviderModel}
                  lockIdentity={lockExistingMemberIdentity && Boolean(member.originalName?.trim())}
                  identityLockReason={identityLockReason}
                  modelLockReason={modelLockReason}
                  warningText={memberWarningById?.[member.id] ?? null}
                  infoText={memberInfoById?.[member.id] ?? null}
                  disableGeminiOption={disableGeminiOption}
                  modelIssueText={memberModelIssueById?.[member.id] ?? null}
                  modelAdvisoryReasonByProvider={modelAdvisoryReasonByProvider}
                  modelIssueReasonByProvider={modelIssueReasonByProvider}
                  modelUnavailableReasonByProvider={modelUnavailableReasonByProvider}
                  onOpenProviderSettings={onOpenProviderSettings}
                />
              ))}
              {softDeleteMembers && removedMembers.length > 0 ? (
                <div className="pt-2">
                  <div className="mb-2 text-[10px] text-[var(--color-text-muted)]">
                    {t('members.editor.removedCount', { count: removedMembers.length })}
                  </div>
                  <div className="space-y-2">
                    {removedMembers.map((member, index) => (
                      <MemberDraftRow
                        key={member.id}
                        member={member}
                        index={activeMembers.length + index}
                        resolvedColor={memberColorMap.get(member.id)}
                        nameError={null}
                        onNameChange={updateMemberName}
                        onNameBlur={finalizeMemberName}
                        onRoleChange={updateMemberRole}
                        onCustomRoleChange={updateMemberCustomRole}
                        onRemove={removeMember}
                        onRestore={restoreMember}
                        showWorkflow={showWorkflow}
                        onWorkflowChange={showWorkflow ? updateMemberWorkflow : undefined}
                        onWorkflowChipsChange={showWorkflow ? updateMemberWorkflowChips : undefined}
                        onProviderChange={updateMemberProvider}
                        onModelChange={updateMemberModel}
                        onEffortChange={updateMemberEffort}
                        showWorktreeIsolationControls={showWorktreeIsolationControls}
                        onWorktreeIsolationChange={updateMemberIsolation}
                        onMcpPolicyChange={updateMemberMcpPolicy}
                        agentTeamsMcpLocked={agentTeamsMcpLockedForAll}
                        inheritedProviderId={inheritedProviderId}
                        inheritedModel={inheritedModel}
                        inheritedEffort={inheritedEffort}
                        limitContext={limitContext}
                        forceInheritedModelSettings={forceInheritedModelSettings}
                        draftKeyPrefix={draftKeyPrefix}
                        projectPath={projectPath}
                        mentionSuggestions={mentionSuggestions}
                        taskSuggestions={taskSuggestions}
                        teamSuggestions={teamSuggestions}
                        onWorkflowSuggestionsNeeded={onWorkflowSuggestionsNeeded}
                        lockProviderModel
                        modelLockReason={t('members.editor.removedModelLockReason')}
                        isRemoved
                        warningText={null}
                        disableGeminiOption={disableGeminiOption}
                        modelIssueText={null}
                        onOpenProviderSettings={onOpenProviderSettings}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {hasDuplicates ? (
            <p className="text-[11px]" style={{ color: 'var(--field-error-text)' }}>
              {t('members.editor.memberNamesUnique')}
            </p>
          ) : fieldError ? (
            <p className="text-[11px]" style={{ color: 'var(--field-error-text)' }}>
              {fieldError}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

export type { MemberDraft } from './membersEditorTypes';
export {
  buildMemberDraftColorMap,
  buildMemberDraftSuggestions,
  buildMembersFromDrafts,
  clearMemberModelOverrides,
  createMemberDraft,
  createMemberDraftsFromInputs,
  filterEditableMemberInputs,
  getMemberDraftRole,
  normalizeLeadProviderForMode,
  normalizeMemberDraftForProviderMode,
  normalizeProviderForMode,
  validateMemberNameInline,
} from './membersEditorUtils';
