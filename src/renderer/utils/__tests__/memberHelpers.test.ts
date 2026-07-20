import { describe, expect, it } from 'vitest';

import { buildMemberLaunchPresentation, shouldDisplayMemberCurrentTask } from '../memberHelpers';

import type {
  MemberLaunchState,
  MemberSpawnStatus,
  ResolvedTeamMember,
  TeamAgentRuntimeEntry,
} from '@shared/types';

function createMember(overrides: Partial<ResolvedTeamMember> = {}): ResolvedTeamMember {
  return {
    name: 'alice',
    status: 'active',
    currentTaskId: 'task-1',
    taskCount: 1,
    lastActiveAt: null,
    messageCount: 0,
    providerId: 'codex',
    providerBackendId: 'codex-native',
    role: 'developer',
    ...overrides,
  };
}

function createLiveRuntime(overrides: Partial<TeamAgentRuntimeEntry> = {}): TeamAgentRuntimeEntry {
  return {
    memberName: 'alice',
    alive: true,
    restartable: true,
    backendType: 'process',
    providerId: 'codex',
    providerBackendId: 'codex-native',
    livenessKind: 'runtime_process',
    pid: 12345,
    rssBytes: 128 * 1024 * 1024,
    updatedAt: '2026-05-18T19:45:00.000Z',
    ...overrides,
  };
}

function createConfirmedCodexSpawn(): {
  spawnStatus: MemberSpawnStatus;
  spawnLaunchState: MemberLaunchState;
  spawnRuntimeAlive: boolean;
  spawnBootstrapConfirmed: boolean;
} {
  return {
    spawnStatus: 'online',
    spawnLaunchState: 'confirmed_alive',
    spawnRuntimeAlive: true,
    spawnBootstrapConfirmed: true,
  };
}

describe('member runtime presentation', () => {
  it('hides Codex native task activity when no spawn claim and no board task are available', () => {
    expect(
      shouldDisplayMemberCurrentTask({
        member: createMember({ currentTaskId: null }),
        isTeamAlive: true,
      })
    ).toBe(false);
  });

  it('shows Codex board work even when confirmed spawn state has no live process evidence', () => {
    expect(
      shouldDisplayMemberCurrentTask({
        member: createMember(),
        isTeamAlive: true,
        ...createConfirmedCodexSpawn(),
      })
    ).toBe(true);
  });

  it('keeps Codex native task activity visible when the runtime process is live', () => {
    expect(
      shouldDisplayMemberCurrentTask({
        member: createMember(),
        isTeamAlive: true,
        ...createConfirmedCodexSpawn(),
        runtimeEntry: createLiveRuntime(),
      })
    ).toBe(true);
  });

  it('shows Codex board work for runtime process candidates without verified process evidence', () => {
    expect(
      shouldDisplayMemberCurrentTask({
        member: createMember(),
        isTeamAlive: true,
        ...createConfirmedCodexSpawn(),
        runtimeEntry: createLiveRuntime({
          livenessKind: 'runtime_process_candidate',
          rssBytes: undefined,
        }),
      })
    ).toBe(true);
  });

  it('shows Codex board work for bootstrap-only runtime evidence without a verified process', () => {
    expect(
      shouldDisplayMemberCurrentTask({
        member: createMember(),
        isTeamAlive: true,
        ...createConfirmedCodexSpawn(),
        runtimeEntry: createLiveRuntime({
          livenessKind: 'confirmed_bootstrap',
          pid: undefined,
          rssBytes: undefined,
        }),
      })
    ).toBe(true);
  });

  it('marks soft Codex probe gaps as amber probe-stale, not red dead', () => {
    const presentation = buildMemberLaunchPresentation({
      member: createMember(),
      spawnLivenessSource: 'heartbeat',
      runtimeAdvisory: undefined,
      isTeamAlive: true,
      isTeamProvisioning: false,
      ...createConfirmedCodexSpawn(),
    });

    expect(presentation.launchVisualState).toBe('stale_runtime');
    expect(presentation.presenceLabel).toBe('runtime probe stale');
    expect(presentation.launchStatusLabel).toBe('runtime probe stale');
    expect(presentation.dotClass).toContain('bg-amber-400');
    expect(presentation.dotClass).not.toContain('bg-red-400');
  });

  it('marks Codex native members without runtime snapshots as soft probe-stale after launch settles', () => {
    const presentation = buildMemberLaunchPresentation({
      member: createMember(),
      spawnStatus: undefined,
      spawnLaunchState: undefined,
      spawnRuntimeAlive: undefined,
      spawnBootstrapConfirmed: undefined,
      spawnLivenessSource: undefined,
      runtimeAdvisory: undefined,
      isTeamAlive: true,
      isTeamProvisioning: false,
    });

    expect(presentation.launchVisualState).toBe('stale_runtime');
    expect(presentation.presenceLabel).toBe('runtime probe stale');
    expect(presentation.dotClass).toContain('bg-amber-400');
  });

  it('shows assigned board work before runtime process evidence arrives', () => {
    expect(
      shouldDisplayMemberCurrentTask({
        member: createMember(),
        isTeamAlive: true,
      })
    ).toBe(true);
  });

  it('does not let a global launch settling state keep stale Codex native status green', () => {
    const presentation = buildMemberLaunchPresentation({
      member: createMember(),
      spawnLivenessSource: 'heartbeat',
      runtimeAdvisory: undefined,
      isTeamAlive: true,
      isTeamProvisioning: false,
      isLaunchSettling: true,
      ...createConfirmedCodexSpawn(),
    });

    expect(presentation.launchVisualState).toBe('stale_runtime');
    expect(presentation.presenceLabel).toBe('runtime probe stale');
    expect(presentation.dotClass).toContain('bg-amber-400');
    expect(presentation.dotClass).not.toContain('bg-red-400');
  });

  it('does not mark bootstrap-only Codex native runtime evidence as green', () => {
    const presentation = buildMemberLaunchPresentation({
      member: createMember(),
      spawnLivenessSource: 'heartbeat',
      runtimeAdvisory: undefined,
      isTeamAlive: true,
      isTeamProvisioning: false,
      ...createConfirmedCodexSpawn(),
      runtimeEntry: createLiveRuntime({
        livenessKind: 'confirmed_bootstrap',
        pid: undefined,
        rssBytes: undefined,
      }),
    });

    expect(presentation.launchVisualState).toBe('stale_runtime');
    expect(presentation.presenceLabel).toBe('runtime probe stale');
    expect(presentation.dotClass).toContain('bg-amber-400');
    expect(presentation.dotClass).not.toContain('bg-red-400');
  });

  it('does not require runtime evidence for non-Codex teammates', () => {
    expect(
      shouldDisplayMemberCurrentTask({
        member: createMember({
          providerId: 'anthropic',
          providerBackendId: undefined,
        }),
        isTeamAlive: true,
        spawnStatus: 'online',
        spawnLaunchState: 'confirmed_alive',
        spawnRuntimeAlive: true,
      })
    ).toBe(true);
  });
});
