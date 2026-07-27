import { formatTaskDisplayLabel } from '@shared/utils/taskIdentity';

import type { TeamTask } from '@shared/types';

export type UnhealthyOwnerOwnedTask = Pick<
  TeamTask,
  'id' | 'displayId' | 'subject' | 'status' | 'owner' | 'blockedBy'
>;

export function isActiveOwnedTaskForUnhealthyOwner(
  task: UnhealthyOwnerOwnedTask,
  memberName: string
): boolean {
  const owner = task.owner?.trim().toLowerCase();
  const member = memberName.trim().toLowerCase();
  if (!owner || !member || owner !== member) {
    return false;
  }
  return task.status === 'pending' || task.status === 'in_progress';
}

export function listHealthyTeammateNames(args: {
  members: ReadonlyArray<{ name?: string | null; role?: string | null }>;
  unhealthyMemberName: string;
  isHealthy: (memberName: string) => boolean;
}): string[] {
  const unhealthy = args.unhealthyMemberName.trim().toLowerCase();
  const names: string[] = [];
  for (const member of args.members) {
    const name = member.name?.trim();
    if (!name) continue;
    if (name.toLowerCase() === unhealthy) continue;
    const role = member.role?.toLowerCase() ?? '';
    if (role.includes('lead')) continue;
    if (!args.isHealthy(name)) continue;
    names.push(name);
  }
  return names;
}

export function buildUnhealthyOwnerLeadNoticeText(args: {
  unhealthyMemberName: string;
  reason: string;
  ownedTasks: readonly UnhealthyOwnerOwnedTask[];
  healthyTeammates: readonly string[];
}): string | null {
  const member = args.unhealthyMemberName.trim();
  if (!member) return null;

  const owned = args.ownedTasks.filter((task) => isActiveOwnedTaskForUnhealthyOwner(task, member));
  if (owned.length === 0) {
    return null;
  }

  const taskLines = owned.map((task) => {
    const label = formatTaskDisplayLabel({ id: task.id, displayId: task.displayId });
    const subject = task.subject?.trim() || '(no subject)';
    return `- ${label} [${task.status}] ${subject}`;
  });

  const healthy = args.healthyTeammates.map((name) => name.trim()).filter(Boolean);
  const healthyLine =
    healthy.length > 0
      ? `Healthy idle/available teammates to prefer: ${healthy.map((name) => `@${name}`).join(', ')}.`
      : 'No other healthy teammates are currently available — escalate to "user" if you cannot proceed.';

  return [
    `System notice: teammate @${member} is unhealthy / unavailable (${args.reason}).`,
    'Do NOT wait for them and do NOT assign them more work while healthier teammates exist.',
    'ACT NOW:',
    '- Immediately task_set_owner their pending AND in_progress tasks below to a healthy teammate, then task_start the ones that should begin.',
    '- If other TODO tasks are blockedBy any of these, reassign the blocker first so the frontier can move.',
    '- Prefer healthy idle teammates; do not require the human to ask you to reassign.',
    healthyLine,
    'Owned active tasks:',
    ...taskLines,
  ].join('\n');
}
