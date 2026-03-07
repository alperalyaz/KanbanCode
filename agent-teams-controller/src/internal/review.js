const kanban = require('./kanban.js');
const messages = require('./messages.js');
const tasks = require('./tasks.js');

function approveReview(context, taskId, flags = {}) {
  const task = tasks.getTask(context, taskId);
  const from =
    typeof flags.from === 'string' && flags.from.trim() ? flags.from.trim() : 'team-lead';
  const note = typeof flags.note === 'string' && flags.note.trim() ? flags.note.trim() : 'Approved';

  kanban.setKanbanColumn(context, task.id, 'approved');
  tasks.addTaskComment(context, task.id, {
    text: note,
    from,
    type: 'review_approved',
  });

  if ((flags.notify === true || flags['notify-owner'] === true) && task.owner) {
    messages.sendMessage(context, {
      to: task.owner,
      from,
      text:
        note && note !== 'Approved'
          ? `Task ${task.displayId || task.id} approved.\n\n${note}`
          : `Task ${task.displayId || task.id} approved.`,
      summary: `Approved ${task.displayId || task.id}`,
      source: 'system_notification',
    });
  }

  return tasks.getTask(context, task.id);
}

function requestChanges(context, taskId, flags = {}) {
  const task = tasks.getTask(context, taskId);
  if (!task.owner) {
    throw new Error(`No owner found for task ${String(taskId)}`);
  }

  const from =
    typeof flags.from === 'string' && flags.from.trim() ? flags.from.trim() : 'team-lead';
  const comment =
    typeof flags.comment === 'string' && flags.comment.trim()
      ? flags.comment.trim()
      : 'Reviewer requested changes.';

  kanban.clearKanban(context, task.id);
  tasks.setTaskStatus(context, task.id, 'in_progress', from);
  tasks.addTaskComment(context, task.id, {
    text: comment,
    from,
    type: 'review_request',
  });
  messages.sendMessage(context, {
    to: task.owner,
    from,
    text:
      `Task ${task.displayId || task.id} needs fixes.\n\n${comment}\n\n` +
      'Please fix and mark it as completed when ready.',
    summary: `Fix request for ${task.displayId || task.id}`,
    source: 'system_notification',
  });

  return tasks.getTask(context, task.id);
}

module.exports = {
  approveReview,
  requestChanges,
};
