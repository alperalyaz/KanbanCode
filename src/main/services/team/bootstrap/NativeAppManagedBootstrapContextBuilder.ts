import { getClaudeBasePath } from '@main/utils/pathDecoder';
import { normalizeOptionalTeamProviderId } from '@shared/utils/teamProvider';
import * as agentTeamsControllerModule from 'agent-teams-controller';
import { createHash } from 'crypto';

import type { TeamCreateRequest, TeamProviderId } from '@shared/types';

const { createController } = agentTeamsControllerModule;

export interface NativeAppManagedBootstrapSpec {
  schemaVersion: 1;
  mode: 'startup_context_file';
  contextText: string;
  contextHash: string;
  briefingHash: string;
  generatedAt: string;
}

export interface NativeAppManagedBootstrapBuildDiagnostics {
  nativeMemberCount: number;
  totalContextChars: number;
  totalContextLimitChars: number;
  warning: string | null;
}

export interface NativeAppManagedBootstrapBuildResult {
  specs: Map<string, NativeAppManagedBootstrapSpec>;
  diagnostics: NativeAppManagedBootstrapBuildDiagnostics;
}

const MAX_NATIVE_BOOTSTRAP_BRIEFING_CHARS = 18_000;
const MAX_NATIVE_BOOTSTRAP_CONTEXT_CHARS = 24_000;
export const MAX_NATIVE_BOOTSTRAP_TOTAL_CONTEXT_CHARS = 256_000;
const NATIVE_BOOTSTRAP_LARGE_ROSTER_MEMBER_COUNT = 7;
const NATIVE_BOOTSTRAP_NEAR_LIMIT_RATIO = 0.85;

export function isNativeAppManagedBootstrapProvider(providerId?: TeamProviderId): boolean {
  return providerId == null || providerId === 'anthropic' || providerId === 'codex';
}

export function canonicalizeNativeBootstrapContextText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function hashNativeBootstrapText(input: string): string {
  return createHash('sha256').update(canonicalizeNativeBootstrapContextText(input)).digest('hex');
}

function redactNativeBootstrapContextText(input: string): string {
  return input
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, '[REDACTED_ANTHROPIC_API_KEY]')
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/(ANTHROPIC_API_KEY|OPENAI_API_KEY|CODEX_API_KEY)=\S+/g, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Z0-9._-]+/gi, 'Bearer [REDACTED]');
}

function boundText(input: string, maxChars: number): string {
  const canonical = canonicalizeNativeBootstrapContextText(input);
  if (canonical.length <= maxChars) {
    return canonical;
  }
  return `${canonical.slice(0, maxChars)}\n[truncated native bootstrap context]`;
}

function buildContextText(params: {
  teamName: string;
  memberName: string;
  providerId?: TeamProviderId;
  cwd: string;
  briefing: string;
}): string {
  const briefing = boundText(
    redactNativeBootstrapContextText(params.briefing),
    MAX_NATIVE_BOOTSTRAP_BRIEFING_CHARS
  );
  return boundText(
    [
      '<agent_teams_native_bootstrap_context>',
      `Team: ${params.teamName}`,
      `Member: ${params.memberName}`,
      `Provider: ${params.providerId ?? 'anthropic'}`,
      `Project: ${params.cwd}`,
      '',
      '<member_briefing_context_data>',
      briefing,
      '</member_briefing_context_data>',
      '</agent_teams_native_bootstrap_context>',
    ].join('\n'),
    MAX_NATIVE_BOOTSTRAP_CONTEXT_CHARS
  );
}

function formatCompactChars(value: number): string {
  if (!Number.isFinite(value)) {
    return 'unknown';
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k chars`;
  }
  return `${Math.max(0, Math.round(value))} chars`;
}

function buildNativeBootstrapWarning(params: {
  nativeMemberCount: number;
  totalContextChars: number;
  totalContextLimitChars: number;
}): string | null {
  if (params.nativeMemberCount === 0) {
    return null;
  }
  const ratio =
    params.totalContextLimitChars > 0
      ? params.totalContextChars / params.totalContextLimitChars
      : 0;
  const isLargeNativeRoster =
    params.nativeMemberCount >= NATIVE_BOOTSTRAP_LARGE_ROSTER_MEMBER_COUNT;
  const isNearLimit = ratio >= NATIVE_BOOTSTRAP_NEAR_LIMIT_RATIO;
  if (!isLargeNativeRoster && !isNearLimit) {
    return null;
  }

  const usage = `${formatCompactChars(params.totalContextChars)} / ${formatCompactChars(
    params.totalContextLimitChars
  )}`;
  const percent = `${Math.round(ratio * 100)}%`;
  const rosterHint = `${params.nativeMemberCount} native app-managed member${
    params.nativeMemberCount === 1 ? '' : 's'
  }`;
  return `Large native team startup context: ${usage} (${percent}) across ${rosterHint}. Launch can continue, but if bootstrap confirmation is slow or fails, reduce native member count or use OpenCode for secondary members.`;
}

function buildLocalNativeMemberBriefing(params: {
  teamName: string;
  cwd: string;
  providerId?: TeamProviderId;
  member: TeamCreateRequest['members'][number];
  unavailableReason: string;
}): string {
  const member = params.member;
  return [
    `You are ${member.name}, a teammate in team ${params.teamName}.`,
    `Provider: ${params.providerId ?? 'anthropic'}`,
    `Project: ${member.cwd?.trim() || params.cwd}`,
    member.role ? `Role: ${member.role}` : '',
    member.workflow ? `Workflow: ${member.workflow}` : '',
    member.model ? `Model: ${member.model}` : '',
    member.effort ? `Effort: ${member.effort}` : '',
    '',
    'The app loaded this startup context from the current team launch request because canonical member_briefing metadata was not available yet.',
    `Diagnostic: ${params.unavailableReason}`,
    '',
    'Startup rules:',
    '- Treat yourself as unavailable until the private bootstrap turn succeeds.',
    '- Do not call member_briefing for launch readiness in this flow.',
    '- Use Agent Teams messaging/task tools only after launch readiness is confirmed.',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

export async function buildNativeAppManagedBootstrapSpecs(params: {
  teamName: string;
  cwd: string;
  members: TeamCreateRequest['members'];
}): Promise<Map<string, NativeAppManagedBootstrapSpec>> {
  return (await buildNativeAppManagedBootstrapSpecsWithDiagnostics(params)).specs;
}

export async function buildNativeAppManagedBootstrapSpecsWithDiagnostics(params: {
  teamName: string;
  cwd: string;
  members: TeamCreateRequest['members'];
}): Promise<NativeAppManagedBootstrapBuildResult> {
  const controller = createController({
    teamName: params.teamName,
    claudeDir: getClaudeBasePath(),
    allowUserMessageSender: false,
  });
  const result = new Map<string, NativeAppManagedBootstrapSpec>();
  let totalContextChars = 0;
  let nativeMemberCount = 0;

  for (const member of params.members) {
    const providerId = normalizeOptionalTeamProviderId(member.providerId) ?? 'anthropic';
    if (!isNativeAppManagedBootstrapProvider(providerId)) {
      continue;
    }
    nativeMemberCount += 1;

    let briefing: string;
    try {
      briefing = String(
        await controller.tasks.memberBriefing(member.name, {
          runtimeProvider: 'native',
          includeActiveProcesses: false,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Member not found in team metadata or inboxes')) {
        throw error;
      }
      // In createTeam, the orchestrator's canonical config/inboxes may not
      // exist until after the lead process runs. Fail-closed would break team
      // creation, so use bounded request metadata while keeping readiness tied
      // to the private bootstrap proof, never to this context load.
      briefing = buildLocalNativeMemberBriefing({
        teamName: params.teamName,
        cwd: params.cwd,
        providerId,
        member,
        unavailableReason: message,
      });
    }
    const boundedBriefing = boundText(
      redactNativeBootstrapContextText(briefing),
      MAX_NATIVE_BOOTSTRAP_BRIEFING_CHARS
    );
    if (!boundedBriefing) {
      throw new Error(`Native app-managed member briefing was empty for ${member.name}`);
    }
    const contextText = buildContextText({
      teamName: params.teamName,
      memberName: member.name,
      providerId,
      cwd: member.cwd?.trim() || params.cwd,
      briefing: boundedBriefing,
    });
    totalContextChars += contextText.length;
    if (totalContextChars > MAX_NATIVE_BOOTSTRAP_TOTAL_CONTEXT_CHARS) {
      throw new Error('Native app-managed bootstrap context exceeds aggregate size budget');
    }

    result.set(member.name, {
      schemaVersion: 1,
      mode: 'startup_context_file',
      contextText,
      contextHash: hashNativeBootstrapText(contextText),
      briefingHash: hashNativeBootstrapText(boundedBriefing),
      generatedAt: new Date().toISOString(),
    });
  }

  const diagnostics: NativeAppManagedBootstrapBuildDiagnostics = {
    nativeMemberCount,
    totalContextChars,
    totalContextLimitChars: MAX_NATIVE_BOOTSTRAP_TOTAL_CONTEXT_CHARS,
    warning: buildNativeBootstrapWarning({
      nativeMemberCount,
      totalContextChars,
      totalContextLimitChars: MAX_NATIVE_BOOTSTRAP_TOTAL_CONTEXT_CHARS,
    }),
  };

  return { specs: result, diagnostics };
}
