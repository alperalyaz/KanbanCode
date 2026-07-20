import {
  buildOpenCodeLeadTeammateProviderDisabledBadges,
  buildOpenCodeLeadTeammateProviderDisabledReasons,
  coerceTeammatesToOpenCodeForOpenCodeLead,
} from '@renderer/components/team/dialogs/openCodeLeadProviderLocks';
import { createMemberDraft } from '@renderer/components/team/members/membersEditorUtils';
import { describe, expect, it } from 'vitest';

const t = ((key: string) => key) as Parameters<
  typeof buildOpenCodeLeadTeammateProviderDisabledReasons
>[0];

describe('openCodeLeadProviderLocks', () => {
  it('disables Anthropic, Codex, and Gemini for OpenCode-led teammates', () => {
    expect(buildOpenCodeLeadTeammateProviderDisabledReasons(t)).toEqual({
      anthropic: 'modelSelector.openCodeLead.teammateProviderDisabled',
      codex: 'modelSelector.openCodeLead.teammateProviderDisabled',
      gemini: 'modelSelector.openCodeLead.teammateProviderDisabled',
    });
    expect(buildOpenCodeLeadTeammateProviderDisabledBadges(t)).toEqual({
      anthropic: 'modelSelector.openCodeLead.teammateProviderBadge',
      codex: 'modelSelector.openCodeLead.teammateProviderBadge',
      gemini: 'modelSelector.openCodeLead.teammateProviderBadge',
    });
  });

  it('coerces non-OpenCode teammate overrides to OpenCode', () => {
    const members = [
      createMemberDraft({
        id: '1',
        name: 'alice',
        providerId: 'anthropic',
        model: 'claude-sonnet-4-6',
        effort: 'medium',
      }),
      createMemberDraft({
        id: '2',
        name: 'bob',
        providerId: 'opencode',
        model: 'big-pickle',
      }),
      createMemberDraft({
        id: '3',
        name: 'carol',
        providerId: 'codex',
        model: 'gpt-5.4',
        removedAt: Date.now(),
      }),
    ];

    const result = coerceTeammatesToOpenCodeForOpenCodeLead(members);
    expect(result.changed).toBe(true);
    expect(result.members[0]).toMatchObject({
      id: '1',
      providerId: 'opencode',
      model: '',
      effort: undefined,
    });
    expect(result.members[1]).toBe(members[1]);
    expect(result.members[2]).toBe(members[2]);
  });

  it('is a no-op when every active teammate is already OpenCode or inherited', () => {
    const members = [
      createMemberDraft({ id: '1', name: 'alice', providerId: 'opencode' }),
      createMemberDraft({ id: '2', name: 'bob' }),
    ];
    expect(coerceTeammatesToOpenCodeForOpenCodeLead(members)).toEqual({
      members,
      changed: false,
    });
  });
});
