import { useSyncExternalStore } from 'react';

import { getSnapshot, getUnreadCount, subscribe } from '@renderer/services/commentReadStorage';

export type TaskStatusFilterId = 'todo' | 'in_progress' | 'done' | 'review' | 'approved';

export const STATUS_OPTIONS: { id: TaskStatusFilterId; label: string; color: string }[] = [
  { id: 'todo', label: 'TODO', color: '#3b82f6' },
  { id: 'in_progress', label: 'IN PROGRESS', color: '#eab308' },
  { id: 'done', label: 'DONE', color: '#22c55e' },
  { id: 'review', label: 'REVIEW', color: '#8b5cf6' },
  { id: 'approved', label: 'APPROVED', color: '#16a34a' },
];

export interface TaskFiltersState {
  statusIds: Set<TaskStatusFilterId>;
  teamName: string | null;
  unreadOnly: boolean;
}

export const defaultTaskFiltersState = (): TaskFiltersState => ({
  statusIds: new Set(STATUS_OPTIONS.map((o) => o.id)),
  teamName: null,
  unreadOnly: false,
});

export function taskMatchesStatus(
  task: { status: string; kanbanColumn?: 'review' | 'approved' },
  statusIds: Set<TaskStatusFilterId>
): boolean {
  if (statusIds.size === 0) return false;
  if (statusIds.size === STATUS_OPTIONS.length) return task.status !== 'deleted';

  const inTodo = task.status === 'pending' && !task.kanbanColumn;
  const inProgress = task.status === 'in_progress' && !task.kanbanColumn;
  const inDone = task.status === 'completed' && !task.kanbanColumn;
  const inReview = task.kanbanColumn === 'review';
  const inApproved = task.kanbanColumn === 'approved';

  return (
    (statusIds.has('todo') && inTodo) ||
    (statusIds.has('in_progress') && inProgress) ||
    (statusIds.has('done') && inDone) ||
    (statusIds.has('review') && inReview) ||
    (statusIds.has('approved') && inApproved)
  );
}

export function useReadStateSnapshot(): ReturnType<typeof getSnapshot> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getTaskUnreadCount(
  readState: ReturnType<typeof getSnapshot>,
  teamName: string,
  taskId: string,
  comments: { createdAt: string }[] | undefined
): number {
  return getUnreadCount(readState, teamName, taskId, comments ?? []);
}
