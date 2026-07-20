import { isLeadMember } from '@shared/utils/leadDetection';
import { formatTaskDisplayLabel } from '@shared/utils/taskIdentity';

import type { MemberSpawnStatusEntry, TeamMember, TeamTask } from '@shared/types';

export type RemovableOwnedTask = Pick<
  TeamTask,
  'id' | 'displayId' | 'subject' | 'status' | 'owner' | 'blockedBy'
>;

export interface RemovedMemberReassignment {
  taskId: string;
  displayId?: string;
  subject?: string;
  status: 'pending' | 'in_progress';
  fromOwner: string;
  toOwner: string;
}

export interface PlanRemovedMemberReassignmentsArgs {
  removedMemberName: string;
  tasks: readonly RemovableOwnedTask[];
  remainingMembers: ReadonlyArray<Pick<TeamMember, 'name' | 'role' | 'removedAt' | 'agentType'>>;
  spawnStatuses?: Readonly<Record<string, MemberSpawnStatusEntry | undefined>>;
}

function normalizeName(name: string | null | undefined): string {
  return name?.trim().toLowerCase() ?? '';
}

export function isActiveTaskOwnedByMember(
  task: RemovableOwnedTask,
  memberName: string
): task is RemovableOwnedTask & { status: 'pending' | 'in_progress'; owner: string } {
  const owner = normalizeName(task.owner);
  const member = normalizeName(memberName);
  if (!owner || !member || owner !== member) {
    return false;
  }
  return task.status === 'pending' || task.status === 'in_progress';
}

function isHealthySpawnEntry(entry: MemberSpawnStatusEntry | undefined): boolean {
  if (!entry) return false;
  if (entry.hardFailure === true) return false;
  if (entry.runtimeAlive !== true) return false;
  if (entry.status === 'error') return false;
  return true;
}

function isLeadLikeMember(member: {
  name?: string | null;
  role?: string | null;
  agentType?: unknown;
}): boolean {
  if (isLeadMember(member)) return true;
  return member.role?.toLowerCase().includes('lead') === true;
}

export function listReassignmentCandidates(args: {
  removedMemberName: string;
  remainingMembers: ReadonlyArray<Pick<TeamMember, 'name' | 'role' | 'removedAt' | 'agentType'>>;
  spawnStatuses?: Readonly<Record<string, MemberSpawnStatusEntry | undefined>>;
}): string[] {
  const removed = normalizeName(args.removedMemberName);
  const spawnByNormalized = new Map<string, MemberSpawnStatusEntry | undefined>();
  for (const [name, entry] of Object.entries(args.spawnStatuses ?? {})) {
    spawnByNormalized.set(normalizeName(name), entry);
  }

  const active = args.remainingMembers.filter((member) => {
    const name = member.name?.trim();
    if (!name) return false;
    if (normalizeName(name) === removed) return false;
    if (member.removedAt != null) return false;
    if (isLeadLikeMember(member)) return false;
    return true;
  });

  const withHealth = active.map((member) => {
    const name = member.name!.trim();
    const entry = spawnByNormalized.get(normalizeName(name));
    return { name, healthy: args.spawnStatuses ? isHealthySpawnEntry(entry) : true };
  });

  const healthy = withHealth.filter((member) => member.healthy).map((member) => member.name);
  if (healthy.length > 0) {
    return healthy;
  }
  // Removed member is gone — prefer any remaining teammate over orphaned ownership.
  return withHealth.map((member) => member.name);
}

function countActiveLoad(
  ownerName: string,
  tasks: readonly RemovableOwnedTask[],
  planned: readonly RemovedMemberReassignment[]
): number {
  const owner = normalizeName(ownerName);
  let count = 0;
  for (const task of tasks) {
    if (task.status !== 'pending' && task.status !== 'in_progress') continue;
    const currentOwner = normalizeName(task.owner);
    if (currentOwner === owner) count += 1;
  }
  for (const plan of planned) {
    if (normalizeName(plan.toOwner) === owner) count += 1;
    if (normalizeName(plan.fromOwner) === owner) count -= 1;
  }
  return Math.max(0, count);
}

function pickLeastLoadedOwner(
  candidates: readonly string[],
  tasks: readonly RemovableOwnedTask[],
  planned: readonly RemovedMemberReassignment[]
): string | null {
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestLoad = countActiveLoad(best, tasks, planned);
  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    const load = countActiveLoad(candidate, tasks, planned);
    if (load < bestLoad) {
      best = candidate;
      bestLoad = load;
    }
  }
  return best;
}

/**
 * Plan reassignment of a removed member's pending/in_progress tasks onto remaining
 * teammates (prefer healthy, least-loaded). in_progress / blocker-like work is ordered first.
 */
export function planRemovedMemberReassignments(
  args: PlanRemovedMemberReassignmentsArgs
): RemovedMemberReassignment[] {
  const owned = args.tasks.filter((task) =>
    isActiveTaskOwnedByMember(task, args.removedMemberName)
  ) as Array<RemovableOwnedTask & { status: 'pending' | 'in_progress'; owner: string }>;

  if (owned.length === 0) {
    return [];
  }

  const candidates = listReassignmentCandidates(args);
  if (candidates.length === 0) {
    return [];
  }

  const ordered = [...owned].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'in_progress' ? -1 : 1;
    }
    return (a.displayId ?? a.id).localeCompare(b.displayId ?? b.id);
  });

  const planned: RemovedMemberReassignment[] = [];
  for (const task of ordered) {
    const toOwner = pickLeastLoadedOwner(candidates, args.tasks, planned);
    if (!toOwner) break;
    planned.push({
      taskId: task.id,
      displayId: task.displayId,
      subject: task.subject,
      status: task.status,
      fromOwner: task.owner,
      toOwner,
    });
  }
  return planned;
}

export function buildRemovedMemberReassignmentLeadNotice(args: {
  removedMemberName: string;
  reassignments: readonly RemovedMemberReassignment[];
  orphanedTaskCount?: number;
}): string {
  const removed = args.removedMemberName.trim() || 'unknown';
  if (args.reassignments.length === 0) {
    if ((args.orphanedTaskCount ?? 0) > 0) {
      return [
        `System notice: teammate @${removed} was removed and still owned active tasks, but no remaining teammate could take them.`,
        'Escalate to "user" immediately — the board has orphaned work.',
      ].join('\n');
    }
    return [
      `System notice: teammate @${removed} was removed from the team.`,
      'Do not assign them new work. Scan the board and task_start any idle healthy teammates who have ready work.',
    ].join('\n');
  }

  const lines = args.reassignments.map((item) => {
    const label = formatTaskDisplayLabel({ id: item.taskId, displayId: item.displayId });
    const subject = item.subject?.trim() || '(no subject)';
    return `- ${label} [${item.status}] ${subject} → @${item.toOwner}`;
  });

  return [
    `System notice: teammate @${removed} was removed. Their active tasks were AUTO-REASSIGNED on the board — ownership is already fixed.`,
    'ACT NOW (same turn) — do NOT search the workspace for "ownership references" and do NOT write a cleanup essay:',
    '- Verify with lead_briefing / task_list that the rows below match the board.',
    '- For each new owner who is idle, SendMessage them a one-line handoff and make sure in_progress / unblocked work is actually running (task_start if still pending).',
    '- Keep every healthy idle teammate busy. Report to "user" only after work is moving again.',
    'Reassignments:',
    ...lines,
  ].join('\n');
}

export function isTaskBlockedByOpenWork(
  task: Pick<RemovableOwnedTask, 'blockedBy'>,
  allTasks: readonly RemovableOwnedTask[]
): boolean {
  const blockers = task.blockedBy ?? [];
  if (blockers.length === 0) return false;
  const byId = new Map(allTasks.map((item) => [item.id, item]));
  const byDisplay = new Map(
    allTasks
      .filter((item) => item.displayId)
      .map((item) => [String(item.displayId).toLowerCase(), item])
  );
  return blockers.some((blockerId) => {
    const key = String(blockerId).trim();
    if (!key) return false;
    const blocker =
      byId.get(key) ??
      byDisplay.get(key.toLowerCase()) ??
      byDisplay.get(key.replace(/^#/, '').toLowerCase());
    if (!blocker) return false;
    return blocker.status === 'pending' || blocker.status === 'in_progress';
  });
}

/** Pending tasks that should be auto-started after reassignment (unblocked, one per new owner). */
export function selectPendingReassignmentsToAutoStart(args: {
  reassignments: readonly RemovedMemberReassignment[];
  tasks: readonly RemovableOwnedTask[];
}): RemovedMemberReassignment[] {
  const ownersWithInProgress = new Set(
    args.reassignments
      .filter((item) => item.status === 'in_progress')
      .map((item) => item.toOwner.trim().toLowerCase())
  );
  const selected: RemovedMemberReassignment[] = [];
  const startedOwners = new Set<string>();

  for (const item of args.reassignments) {
    if (item.status !== 'pending') continue;
    const ownerKey = item.toOwner.trim().toLowerCase();
    if (!ownerKey || ownersWithInProgress.has(ownerKey) || startedOwners.has(ownerKey)) {
      continue;
    }
    const task = args.tasks.find((candidate) => candidate.id === item.taskId);
    if (!task || isTaskBlockedByOpenWork(task, args.tasks)) {
      continue;
    }
    selected.push(item);
    startedOwners.add(ownerKey);
  }
  return selected;
}

export function buildRemovedMemberOwnerHandoffText(args: {
  removedMemberName: string;
  taskId: string;
  displayId?: string;
  subject?: string;
  status: 'pending' | 'in_progress';
  teamName: string;
}): string {
  const label = formatTaskDisplayLabel({ id: args.taskId, displayId: args.displayId });
  const subject = args.subject?.trim() || '(no subject)';
  const removed = args.removedMemberName.trim() || 'removed teammate';
  if (args.status === 'in_progress') {
    return [
      `Handoff: ${label} "${subject}" was taken over from removed teammate @${removed}.`,
      'It is already in_progress — resume work immediately. Do not wait for further confirmation.',
      `When done: task_complete { teamName: "${args.teamName}", taskId: "${args.taskId}" }`,
    ].join('\n');
  }
  return [
    `Handoff: ${label} "${subject}" was reassigned to you from removed teammate @${removed}.`,
    'Start this task now if you are idle.',
    `task_start { teamName: "${args.teamName}", taskId: "${args.taskId}" }`,
  ].join('\n');
}
