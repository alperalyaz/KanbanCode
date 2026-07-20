import { wrapAgentBlock } from '@shared/constants/agentBlocks';
import * as agentTeamsControllerModule from 'agent-teams-controller';

import type { AgentActionMode } from '@shared/types';

const { protocols } = agentTeamsControllerModule;

const LEAD_DELEGATE_DESCRIPTION =
  'Strict orchestration mode for leads. Put every actionable request on the kanban board, delegate to teammates, coordinate progress, and do not implement or personally research unless you are truly in SOLO MODE or the human explicitly asked you to do that work yourself.';

const ACTION_MODE_BLOCKS: Record<AgentActionMode, string[]> = {
  do: [
    'TURN ACTION MODE: DO',
    '- This turn is full-execution mode.',
    '- You may discuss, read, edit files, change state, run commands/tools, and delegate if useful.',
    '- Agent tool policy for this mode: you MAY use the built-in Agent tool only as a normal Claude Code subagent helper, i.e. WITHOUT team_name.',
    '- If you use Agent in this mode, use it the same way normal Claude Code would use Agent: bounded helper work, parallel research, or implementation support when useful.',
    '- Even in DO mode, do NOT use Agent with team_name to create persistent teammates, and do NOT use Agent as a replacement for the team task board or normal teammate delegation.',
    '- If you are the team lead in a non-solo team: still put actionable work on the board before executing, and prefer delegating to teammates unless the user explicitly asked YOU to do the work yourself or you are in SOLO MODE.',
    '- No other restrictions apply beyond your normal system/team rules.',
  ],
  ask: [
    'TURN ACTION MODE: ASK',
    '- This turn is STRICTLY read-only conversation mode.',
    '- ALLOWED: read/analyze/explain, answer questions, discuss options, and request clarification if needed.',
    '- FORBIDDEN: editing files, changing code, changing task/board state, delegating work, launching Agent/subagents, running commands/scripts/tools with side effects, or causing any non-communication state change.',
  ],
  delegate: [
    'TURN ACTION MODE: DELEGATE',
    '- This turn is STRICT orchestration mode: your job is to put work on the kanban board and keep teammates busy — not to freestyle the work yourself.',
    '- If you are the team lead, stay at orchestration level: decompose the work, create a FULL pending backlog on the board (TODO must stay non-empty after starts), assign owners, then start at most ONE task per idle/ready teammate, and monitor progress.',
    '- HARD RULE: no actionable work without a board card first (including small ops like git push, run tests, rename a file). Pure chat may stay off-board; everything else must be a task.',
    '- HARD RULE: never create-and-start only one task per teammate leaving TODO empty. Always leave visible pending follow-ups in TODO.',
    '- In this mode, do NOT inspect code, do root-cause research, run project commands, or spend time narrowing scope yourself before delegating unless the human explicitly asked you to do that work yourself, or you are truly in SOLO MODE.',
    '- If the request is a clear but technically underspecified complete ask, create one coarse investigation/triage task in pending/TODO for the most relevant teammate PLUS additional pending follow-up placeholders where known; that teammate should inspect the codebase, refine scope, and add more pending tasks. If scope is already clear, create the full pending backlog yourself before any task_start. Incomplete or accidental fragments are not triage candidates; ask for clarification instead.',
    "- FORBIDDEN: implementing work yourself, doing a teammate's assigned task for them, launching Agent/subagents as a substitute for teammates, or taking direct execution ownership — unless you are truly in SOLO MODE or the human explicitly asked YOU to execute.",
    '- In particular, do NOT use Agent as a shortcut for delegation in this mode. Use the team board, real teammates, and explicit task ownership instead.',
    '- SOLO MODE is ONLY when the durable roster lists ZERO teammates. If this turn includes a durable roster with teammate names, the team is NOT solo — create board tasks and assign those teammates. Never invent "no other members" / "team has no teammates" when the roster lists names.',
    '- If you are not the team lead, do not take lead-level orchestration ownership yourself; explain briefly and ask the user to message the lead (or switch mode) instead.',
  ],
};

export function buildActionModeProtocol(): string {
  return protocols.buildActionModeProtocolText(LEAD_DELEGATE_DESCRIPTION);
}

export function buildActionModeAgentBlock(mode: AgentActionMode | undefined): string {
  if (!mode) {
    return '';
  }

  const lines = ACTION_MODE_BLOCKS[mode];
  return wrapAgentBlock(lines.join('\n'));
}

export function isAgentActionMode(value: unknown): value is AgentActionMode {
  return value === 'do' || value === 'ask' || value === 'delegate';
}
