import type { ActiveToolCall } from '@shared/types';

/**
 * Pick the most recent running tool for a member, falling back to the newest
 * finished-but-still-visible tool so the UI can show a brief "just finished"
 * flash instead of going blank between tool calls.
 */
export function selectPrimaryLiveTool(
  activeById: Record<string, ActiveToolCall> | undefined,
  finishedById?: Record<string, ActiveToolCall>
): ActiveToolCall | null {
  const running = Object.values(activeById ?? {}).filter((tool) => tool.state === 'running');
  if (running.length > 0) {
    running.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return running[0] ?? null;
  }

  const finished = Object.values(finishedById ?? {});
  if (finished.length === 0) return null;
  finished.sort((a, b) => {
    const aTs = Date.parse(a.finishedAt ?? a.startedAt);
    const bTs = Date.parse(b.finishedAt ?? b.startedAt);
    return bTs - aTs;
  });
  return finished[0] ?? null;
}

/** Collect every running tool across a team, newest first. */
export function selectTeamRunningTools(
  activeByMember: Record<string, Record<string, ActiveToolCall>> | undefined
): ActiveToolCall[] {
  if (!activeByMember) return [];
  const running: ActiveToolCall[] = [];
  for (const byId of Object.values(activeByMember)) {
    for (const tool of Object.values(byId)) {
      if (tool.state === 'running') running.push(tool);
    }
  }
  running.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  return running;
}

/**
 * Cursor-style short label: tool name + optional preview, truncated.
 * Prefers the runtime preview when present; otherwise just the tool name.
 */
export function formatLiveToolLabel(tool: ActiveToolCall, maxLen = 72): string {
  const name = tool.toolName.trim() || 'tool';
  const preview = tool.preview?.trim();
  const raw = preview ? `${name} · ${preview}` : name;
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, Math.max(0, maxLen - 1))}…`;
}
