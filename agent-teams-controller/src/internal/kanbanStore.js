const fs = require('fs');
const path = require('path');

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
  fs.renameSync(tempPath, filePath);
}

function getDefaultState(teamName) {
  return {
    teamName,
    reviewers: [],
    tasks: {},
  };
}

function sanitizeState(teamName, rawState) {
  const state = rawState && typeof rawState === 'object' ? rawState : {};
  const tasks = {};
  if (state.tasks && typeof state.tasks === 'object') {
    for (const [taskId, entry] of Object.entries(state.tasks)) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.column !== 'review' && entry.column !== 'approved') continue;
      if (typeof entry.movedAt !== 'string') continue;
      tasks[String(taskId)] = {
        column: entry.column,
        movedAt: entry.movedAt,
        ...(entry.reviewer === null || typeof entry.reviewer === 'string'
          ? { reviewer: entry.reviewer }
          : {}),
        ...(typeof entry.errorDescription === 'string'
          ? { errorDescription: entry.errorDescription }
          : {}),
      };
    }
  }

  return {
    teamName,
    reviewers: Array.isArray(state.reviewers)
      ? state.reviewers.filter((entry) => typeof entry === 'string' && entry.trim())
      : [],
    tasks,
    ...(state.columnOrder && typeof state.columnOrder === 'object'
      ? { columnOrder: state.columnOrder }
      : {}),
  };
}

function readKanbanState(paths, teamName) {
  return sanitizeState(teamName, readJson(paths.kanbanPath, getDefaultState(teamName)));
}

function writeKanbanState(paths, teamName, state) {
  writeJson(paths.kanbanPath, sanitizeState(teamName, state));
}

function setKanbanColumn(paths, teamName, taskId, column) {
  if (column !== 'review' && column !== 'approved') {
    throw new Error(`Invalid kanban column: ${String(column)}`);
  }

  const state = readKanbanState(paths, teamName);
  state.tasks[String(taskId)] =
    column === 'review'
      ? { column: 'review', reviewer: null, movedAt: nowIso() }
      : { column: 'approved', movedAt: nowIso() };
  writeKanbanState(paths, teamName, state);
  return state;
}

function clearKanban(paths, teamName, taskId) {
  const state = readKanbanState(paths, teamName);
  delete state.tasks[String(taskId)];
  writeKanbanState(paths, teamName, state);
  return state;
}

function updateColumnOrder(paths, teamName, columnId, orderedTaskIds) {
  const state = readKanbanState(paths, teamName);
  const nextColumnOrder = { ...(state.columnOrder || {}) };
  if (Array.isArray(orderedTaskIds) && orderedTaskIds.length > 0) {
    nextColumnOrder[columnId] = orderedTaskIds.map((entry) => String(entry));
  } else {
    delete nextColumnOrder[columnId];
  }
  state.columnOrder = Object.keys(nextColumnOrder).length > 0 ? nextColumnOrder : undefined;
  writeKanbanState(paths, teamName, state);
  return state;
}

module.exports = {
  clearKanban,
  readKanbanState,
  setKanbanColumn,
  updateColumnOrder,
  writeKanbanState,
};
