export function jsonTextContent(value: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

/**
 * Strips heavy fields (comments, historyEvents, workIntervals) from a full task
 * object to produce a lightweight summary suitable for MCP tool results of
 * write operations. This prevents context bloat — a task with 14 comments can
 * be 25 KB; the summary is < 1 KB.
 *
 * Only strip from the top-level `task` field; leave other fields intact.
 */
export function taskWriteResult(result: Record<string, unknown>): Record<string, unknown> {
  const task = result.task;
  if (task == null || typeof task !== 'object') return result;

  return { ...result, task: slimTask(task as Record<string, unknown>) };
}

/**
 * Strips heavy fields from a raw task object returned directly by status/owner
 * mutations (not wrapped in `{ task: ... }`).
 */
export function slimTask(full: Record<string, unknown>): Record<string, unknown> {
  const slim: Record<string, unknown> = {
    id: full.id,
    displayId: full.displayId,
    subject: full.subject,
    status: full.status,
    owner: full.owner,
  };

  const comments = full.comments;
  if (Array.isArray(comments)) {
    slim.commentCount = comments.length;
  }

  return slim;
}
