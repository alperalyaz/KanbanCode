import { wrapAgentBlock } from '@shared/constants/agentBlocks';
import * as agentTeamsControllerModule from 'agent-teams-controller';

import type { AgentActionMode } from '@shared/types';

const { protocols } = agentTeamsControllerModule;

const LEAD_DELEGATE_DESCRIPTION =
  'Strict orchestration mode for leads. Delegate the work and any needed investigation to teammates, coordinate it, and do not implement or personally research it yourself unless you are truly in SOLO MODE.';

const ACTION_MODE_BLOCKS: Record<AgentActionMode, string[]> = {
  do: [
    'TURN ACTION MODE: DO',
    '- This turn is full-execution mode.',
    '- You may discuss, read, edit files, change state, run commands/tools, and delegate if useful.',
    '- Agent tool policy for this mode: you MAY use the built-in Agent tool only as a normal Claude Code subagent helper, i.e. WITHOUT team_name.',
    '- If you use Agent in this mode, use it the same way normal Claude Code would use Agent: bounded helper work, parallel research, or implementation support when useful.',
    '- Even in DO mode, do NOT use Agent with team_name to create persistent teammates, and do NOT use Agent as a replacement for the team task board or normal teammate delegation.',
    '- No extra restrictions apply beyond your normal system/team rules.',
  ],
  ask: [
    'TURN ACTION MODE: ASK',
    '- This turn is STRICTLY read-only conversation mode.',
    '- ALLOWED: read/analyze/explain, answer questions, discuss options, and request clarification if needed.',
    '- FORBIDDEN: editing files, changing code, changing task/board state, delegating work, launching Agent/subagents, running commands/scripts/tools with side effects, or causing any non-communication state change.',
  ],
  delegate: [
    'TURN ACTION MODE: DELEGATE',
    '- This turn is delegation/orchestration mode: delegation is your DEFAULT, but you still auto-decide to handle trivial one-step tasks yourself (see RIGHT-SIZE below).',
    '- If you are the team lead, stay at orchestration level: decompose the work, create every identified item as a pending board task with owners, then start only what should begin now, delegate triage/research to the best teammate, and monitor progress.',
    '- In this mode, do NOT inspect code, do root-cause research, or spend time narrowing scope yourself before delegating unless the human explicitly asked you for analysis/planning instead of delegation.',
    '- If the request is underspecified, create one coarse investigation/triage task in pending/TODO for the most relevant teammate; that teammate should inspect the codebase, refine scope, and add follow-up pending tasks. If scope is already clear, create the full pending backlog yourself before any task_start.',
    '- RIGHT-SIZE (you auto-decide): if the request is a trivial, single-step operation that is genuinely not worth a board task and a teammate handoff — e.g. "git push", "run the tests", "commit and push", "rename X to Y", "open this file", a one-line fix, or answering a quick factual check — just DO IT YOURSELF directly and move on. Do not manufacture ceremony (no board task, no delegation, no verification sub-process) for a one-liner. Reserve delegation for work that genuinely needs a teammate\'s time and spans multiple steps, files, or people.',
    '- FORBIDDEN for substantial work: implementing multi-step work yourself, doing a teammate\'s assigned task for them, launching Agent/subagents, or taking direct execution ownership of work that should be delegated — unless you are truly in SOLO MODE. (Trivial one-step operations per the RIGHT-SIZE rule above are the explicit exception and are expected to be done directly.)',
    '- In particular, do NOT use Agent as a shortcut for delegation in this mode. Use the team board, real teammates, and explicit task ownership instead.',
    '- If you are not the lead or no delegation target exists, do not execute the work yourself; explain the limitation briefly and request a different mode or a lead handoff.',
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
