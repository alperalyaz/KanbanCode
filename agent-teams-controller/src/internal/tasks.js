const legacy = require('../legacy/teamctl.cli.js');
const taskStore = require('./taskStore.js');

function createTask(context, input) {
  return taskStore.createTask(context.paths, input);
}

function getTask(context, taskId) {
  return taskStore.readTask(context.paths, taskId, { includeDeleted: true });
}

function listTasks(context) {
  return taskStore.listTasks(context.paths);
}

function listDeletedTasks(context) {
  return taskStore.listTasks(context.paths, { includeDeleted: true }).filter(
    (task) => task.status === 'deleted'
  );
}

function resolveTaskId(context, taskRef) {
  return taskStore.resolveTaskRef(context.paths, taskRef, { includeDeleted: true });
}

function setTaskStatus(context, taskId, status, actor) {
  return taskStore.setTaskStatus(context.paths, taskId, status, actor);
}

function startTask(context, taskId, actor) {
  return setTaskStatus(context, taskId, 'in_progress', actor);
}

function completeTask(context, taskId, actor) {
  return setTaskStatus(context, taskId, 'completed', actor);
}

function softDeleteTask(context, taskId, actor) {
  return setTaskStatus(context, taskId, 'deleted', actor);
}

function restoreTask(context, taskId, actor) {
  return setTaskStatus(context, taskId, 'pending', actor || 'user');
}

function setTaskOwner(context, taskId, owner) {
  return taskStore.setTaskOwner(context.paths, taskId, owner);
}

function updateTaskFields(context, taskId, fields) {
  return taskStore.updateTaskFields(context.paths, taskId, fields);
}

function addTaskComment(context, taskId, flags) {
  const result = taskStore.addTaskComment(context.paths, taskId, flags.text, {
    author:
      typeof flags.from === 'string' && flags.from.trim()
        ? flags.from.trim()
        : legacy.inferLeadName(context.paths),
    ...(flags.id ? { id: flags.id } : {}),
    ...(flags.createdAt ? { createdAt: flags.createdAt } : {}),
    ...(flags.type ? { type: flags.type } : {}),
    ...(Array.isArray(flags.attachments) ? { attachments: flags.attachments } : {}),
  });

  return {
    commentId: result.comment.id,
    taskId: result.task.id,
    subject: result.task.subject,
    owner: result.task.owner,
    task: result.task,
    comment: result.comment,
  };
}

function attachTaskFile(context, taskId, flags) {
  const canonicalTaskId = resolveTaskId(context, taskId);
  const saved = legacy.saveTaskAttachmentFile(context.paths, canonicalTaskId, flags);
  const task = taskStore.addTaskAttachmentMeta(context.paths, canonicalTaskId, saved.meta);
  return {
    ...saved.meta,
    task,
  };
}

function attachCommentFile(context, taskId, commentId, flags) {
  const canonicalTaskId = resolveTaskId(context, taskId);
  const saved = legacy.saveTaskAttachmentFile(context.paths, canonicalTaskId, flags);
  const task = taskStore.addCommentAttachmentMeta(context.paths, canonicalTaskId, commentId, saved.meta);
  return {
    ...saved.meta,
    task,
  };
}

function addTaskAttachmentMeta(context, taskId, meta) {
  return taskStore.addTaskAttachmentMeta(context.paths, taskId, meta);
}

function removeTaskAttachment(context, taskId, attachmentId) {
  return taskStore.removeTaskAttachment(context.paths, taskId, attachmentId);
}

function setNeedsClarification(context, taskId, value) {
  return taskStore.setNeedsClarification(context.paths, taskId, value == null ? 'clear' : String(value));
}

function linkTask(context, taskId, targetId, linkType) {
  return taskStore.linkTask(context.paths, taskId, targetId, String(linkType));
}

function unlinkTask(context, taskId, targetId, linkType) {
  return taskStore.unlinkTask(context.paths, taskId, targetId, String(linkType));
}

async function taskBriefing(context, memberName) {
  return taskStore.formatTaskBriefing(context.paths, context.teamName, String(memberName));
}

module.exports = {
  addTaskAttachmentMeta,
  addTaskComment,
  attachTaskFile,
  attachCommentFile,
  completeTask,
  createTask,
  getTask,
  linkTask,
  listDeletedTasks,
  listTasks,
  removeTaskAttachment,
  resolveTaskId,
  restoreTask,
  setNeedsClarification,
  setTaskOwner,
  setTaskStatus,
  softDeleteTask,
  startTask,
  taskBriefing,
  unlinkTask,
  updateTaskFields,
};
