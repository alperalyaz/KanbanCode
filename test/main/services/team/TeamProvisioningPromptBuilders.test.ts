import {
  buildGeminiPostLaunchHydrationPrompt,
  buildMemberSpawnPrompt,
  buildPersistentLeadContext,
} from '@main/services/team/provisioning/TeamProvisioningPromptBuilders';
import { describe, expect, it } from 'vitest';

import type { MemberSpawnStatusEntry, TeamCreateRequest } from '@shared/types';

function buildPromptWithStatus(status: MemberSpawnStatusEntry): string {
  return buildGeminiPostLaunchHydrationPrompt(
    {
      teamName: 'signal-ops',
      request: { prompt: 'Check readiness.' },
      memberSpawnStatuses: new Map([['tom', status]]),
    },
    'lead',
    [{ name: 'tom', providerId: 'anthropic', model: 'sonnet' }] as TeamCreateRequest['members'],
    []
  );
}

describe('TeamProvisioningPromptBuilders', () => {
  it('clarifies that assigned teammates may inspect and edit files for implementation work', () => {
    const prompt = buildMemberSpawnPrompt(
      { name: 'tom', role: 'developer' },
      'signal-ops',
      'signal-ops',
      'lead'
    );

    expect(prompt).toContain(
      'If an assigned task requires implementation, fixes, review follow-up, or concrete investigation, you may inspect, read/search, and edit files in your working directory as needed.'
    );
  });

  it('keeps non-solo lead delegation first while excluding assigned teammates from that restriction', () => {
    const prompt = buildPersistentLeadContext({
      teamName: 'signal-ops',
      leadName: 'lead',
      isSolo: false,
      members: [
        { name: 'lead', role: 'team-lead' },
        { name: 'tom', role: 'developer' },
      ] as TeamCreateRequest['members'],
    });

    expect(prompt).toContain('your top priority as team lead');
    expect(prompt).toContain(
      'This lead-only delegation rule does NOT restrict assigned teammates.'
    );
  });

  it('requires non-solo leads to seed the full pending backlog before starting work', () => {
    const prompt = buildPersistentLeadContext({
      teamName: 'signal-ops',
      leadName: 'lead',
      isSolo: false,
      members: [
        { name: 'lead', role: 'team-lead' },
        { name: 'tom', role: 'developer' },
      ] as TeamCreateRequest['members'],
    });

    expect(prompt).toContain('BOARD PLAN FIRST (MANDATORY for teams with teammates)');
    expect(prompt).toContain('create ALL decomposed tasks on the team board in pending/TODO');
    expect(prompt).toContain('BACKLOG SEEDING (MANDATORY)');
  });

  it('does not add team backlog seeding rules in solo mode', () => {
    const prompt = buildPersistentLeadContext({
      teamName: 'signal-ops',
      leadName: 'lead',
      isSolo: true,
      members: [{ name: 'lead', role: 'team-lead' }] as TeamCreateRequest['members'],
    });

    expect(prompt).toContain('TASK BOARD FIRST (MANDATORY)');
    expect(prompt).not.toContain('BOARD PLAN FIRST (MANDATORY for teams with teammates)');
  });

  it('teaches Codex leads agent-teams MCP aliases instead of Claude-native TaskCreate/SendMessage', () => {
    const prompt = buildPersistentLeadContext({
      teamName: 'forge-labs',
      leadName: 'Lider',
      isSolo: false,
      providerId: 'codex',
      members: [
        { name: 'Lider', role: 'team-lead', providerId: 'codex' },
        { name: 'Karagöz', role: 'developer', providerId: 'codex' },
      ] as TeamCreateRequest['members'],
    });

    expect(prompt).toContain('LEAD RUNTIME TOOL SURFACE (Codex Native — CRITICAL)');
    expect(prompt).toContain('agent-teams_task_create');
    expect(prompt).toContain('agent-teams_task_create_from_message');
    expect(prompt).toContain('mcp__agent-teams__task_create');
    expect(prompt).toContain('agent-teams_message_send');
    expect(prompt).toContain('This lead session does NOT expose Claude-native TeamCreate / TaskCreate / SendMessage');
    expect(prompt).toContain(
      'NEVER refuse board work by claiming "board tools / TaskCreate / task_create_from_message are missing"'
    );
    expect(prompt).toContain('agent-teams_message_send { teamName: "forge-labs", to: "alice"');
    expect(prompt).not.toContain(
      'respond with SendMessage({ to: "alice", summary: "short reply", message: "your reply" })'
    );
  });

  it('keeps Claude leads on native SendMessage wording', () => {
    const prompt = buildPersistentLeadContext({
      teamName: 'forge-labs',
      leadName: 'Lider',
      isSolo: false,
      providerId: 'anthropic',
      members: [
        { name: 'Lider', role: 'team-lead', providerId: 'anthropic' },
        { name: 'tom', role: 'developer' },
      ] as TeamCreateRequest['members'],
    });

    expect(prompt).not.toContain('LEAD RUNTIME TOOL SURFACE');
    expect(prompt).toContain(
      'respond with SendMessage({ to: "alice", summary: "short reply", message: "your reply" })'
    );
  });

  it('requires leads to skip unhealthy owners and reassign without being asked', () => {
    const prompt = buildPersistentLeadContext({
      teamName: 'atlas-hq',
      leadName: 'Lider',
      isSolo: false,
      members: [
        { name: 'Lider', role: 'team-lead' },
        { name: 'Karagöz', role: 'developer' },
        { name: 'Beberuhi', role: 'developer' },
      ] as TeamCreateRequest['members'],
    });

    expect(prompt).toContain('NEVER ASSIGN TO UNHEALTHY WHEN HEALTHY EXIST');
    expect(prompt).toContain('REMOVED TEAMMATE');
    expect(prompt).toContain('ACTIVE ORCHESTRATOR');
    expect(prompt).toContain('pending AND in_progress work');
    expect(prompt).toContain('UNHEALTHY OWNER + BLOCKED FRONTIER');
    expect(prompt).toContain('do NOT wait ~2 minutes for the unhealthy ones');
    expect(prompt).toContain(
      'When you receive a system notice that a teammate is unhealthy and still owns pending/in_progress work'
    );
    expect(prompt).toContain(
      'The user should NEVER have to micromanage "take the work off the red agent'
    );
    expect(prompt).toContain(
      'healthy idle teammates exist AND there is pending TODO work OR an unhealthy/stale/offline owner'
    );
  });

  it('keeps errored provisioned-but-not-alive members failed in Gemini hydration prompts', () => {
    const prompt = buildPromptWithStatus({
      status: 'error',
      launchState: 'failed_to_start',
      agentToolAccepted: true,
      runtimeAlive: false,
      bootstrapConfirmed: true,
      hardFailure: true,
      hardFailureReason: 'CLI process exited (code 1) - team provisioned but not alive',
      livenessKind: 'confirmed_bootstrap',
      runtimeDiagnostic: 'Runtime process crashed',
      runtimeDiagnosticSeverity: 'error',
      updatedAt: '2026-05-25T20:14:02.147Z',
    });

    expect(prompt).toContain(
      '- @tom: failed to start - CLI process exited (code 1) - team provisioned but not alive'
    );
    expect(prompt).not.toContain('- @tom: bootstrap confirmed');
  });

  it('keeps benign provisioned-but-not-alive members confirmed in Gemini hydration prompts', () => {
    const prompt = buildPromptWithStatus({
      status: 'error',
      launchState: 'failed_to_start',
      agentToolAccepted: true,
      runtimeAlive: false,
      bootstrapConfirmed: true,
      hardFailure: true,
      hardFailureReason: 'CLI process exited (code 1) - team provisioned but not alive',
      livenessKind: 'confirmed_bootstrap',
      runtimeDiagnostic: 'runtime pid could not be verified because process table is unavailable',
      runtimeDiagnosticSeverity: 'warning',
      updatedAt: '2026-05-25T20:14:02.147Z',
    });

    expect(prompt).toContain('- @tom: bootstrap confirmed');
    expect(prompt).not.toContain('- @tom: failed to start');
  });
});
