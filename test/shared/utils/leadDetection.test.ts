import { isLeadAgentType, isLeadMember } from '@shared/utils/leadDetection';
import { describe, expect, it } from 'vitest';

describe('isLeadAgentType', () => {
  it('matches known lead agentType variants', () => {
    expect(isLeadAgentType('team-lead')).toBe(true);
    expect(isLeadAgentType('lead')).toBe(true);
    expect(isLeadAgentType('orchestrator')).toBe(true);
  });

  it('rejects ambiguous or missing agentType values', () => {
    expect(isLeadAgentType('general-purpose')).toBe(false);
    expect(isLeadAgentType('')).toBe(false);
    expect(isLeadAgentType(null)).toBe(false);
    expect(isLeadAgentType(undefined)).toBe(false);
  });
});

describe('isLeadMember', () => {
  it('matches by agentType even when the display name is localized', () => {
    expect(isLeadMember({ name: 'Lider', agentType: 'team-lead' })).toBe(true);
    expect(isLeadMember({ name: 'Lider', agentType: 'orchestrator' })).toBe(true);
  });

  it('matches canonical and inbox lead name aliases', () => {
    expect(isLeadMember({ name: 'team-lead' })).toBe(true);
    expect(isLeadMember({ name: 'lead' })).toBe(true);
    expect(isLeadMember({ name: 'Team-Lead' })).toBe(true);
  });

  it('matches explicit lead role variants', () => {
    expect(isLeadMember({ name: 'Lider', role: 'lead' })).toBe(true);
    expect(isLeadMember({ name: 'alice', role: 'Lead' })).toBe(true);
    expect(isLeadMember({ name: 'Lider', role: 'Team Lead' })).toBe(true);
  });

  it('does not treat ordinary teammates as leads', () => {
    expect(isLeadMember({ name: 'alice' })).toBe(false);
    expect(isLeadMember({ name: 'Lider' })).toBe(false);
    expect(isLeadMember({ name: 'alice', agentType: 'general-purpose', role: 'implementer' })).toBe(
      false
    );
  });
});
