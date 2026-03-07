const fs = require('fs');
const os = require('os');
const path = require('path');

const { createController } = require('../src/index.js');

describe('agent-teams-controller API', () => {
  function makeClaudeDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-teams-controller-'));
    fs.mkdirSync(path.join(dir, 'teams', 'my-team'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'tasks', 'my-team'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'teams', 'my-team', 'config.json'),
      JSON.stringify(
        {
          name: 'my-team',
          members: [
            { name: 'alice', role: 'team-lead' },
            { name: 'bob', role: 'developer' },
          ],
        },
        null,
        2
      )
    );
    return dir;
  }

  it('creates tasks and exposes grouped controller modules', () => {
    const claudeDir = makeClaudeDir();
    const controller = createController({ teamName: 'my-team', claudeDir });

    const base = controller.tasks.createTask({ subject: 'Base task' });
    const dependency = controller.tasks.createTask({ subject: 'Dependency task' });
    const created = controller.tasks.createTask({
      subject: 'Blocked task',
      owner: 'bob',
      'blocked-by': `${base.displayId},${dependency.displayId}`,
      related: base.displayId,
    });

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(created.displayId).toHaveLength(8);
    expect(created.status).toBe('pending');
    expect(created.reviewState).toBe('none');
    expect(controller.tasks.getTask(base.id).blocks).toEqual([created.id]);
    expect(controller.tasks.getTask(created.displayId).blockedBy).toEqual([base.id, dependency.id]);

    controller.kanban.addReviewer('alice');
    controller.tasks.completeTask(created.id, 'bob');
    controller.review.requestReview(created.id, { from: 'alice' });
    controller.review.approveReview(created.id, { 'notify-owner': true, from: 'alice' });

    const kanbanState = controller.kanban.getKanbanState();
    expect(kanbanState.reviewers).toEqual(['alice']);
    expect(kanbanState.tasks[created.id].column).toBe('approved');
    expect(controller.tasks.getTask(created.id).reviewState).toBe('approved');

    const sent = controller.messages.appendSentMessage({
      from: 'team-lead',
      to: 'user',
      text: 'All good',
      leadSessionId: 'session-1',
      source: 'lead_process',
      attachments: [{ id: 'a1', filename: 'diff.txt', mimeType: 'text/plain', size: 12 }],
    });
    expect(sent.leadSessionId).toBe('session-1');

    const proc = controller.processes.registerProcess({
      pid: process.pid,
      label: 'dev-server',
      port: '3000',
    });
    expect(proc.port).toBe(3000);
    expect(controller.processes.listProcesses()).toHaveLength(1);
    const stopped = controller.processes.stopProcess({ pid: process.pid });
    expect(typeof stopped.stoppedAt).toBe('string');
  });

  it('creates a fresh registry entry when an old pid was recycled without stoppedAt', () => {
    const claudeDir = makeClaudeDir();
    const controller = createController({ teamName: 'my-team', claudeDir });
    const processesPath = path.join(claudeDir, 'teams', 'my-team', 'processes.json');

    fs.writeFileSync(
      processesPath,
      JSON.stringify(
        [
          {
            id: 'old-entry',
            pid: 999999,
            label: 'stale',
            registeredAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        null,
        2
      )
    );

    const registered = controller.processes.registerProcess({
      pid: 999999,
      label: 'fresh',
    });

    expect(registered.id).not.toBe('old-entry');
    const rows = JSON.parse(fs.readFileSync(processesPath, 'utf8'));
    expect(rows).toHaveLength(2);
    expect(rows[0].stoppedAt).toBeTruthy();
    expect(rows[1].id).toBe(registered.id);
  });
});
