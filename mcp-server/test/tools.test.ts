import fs from 'fs';
import os from 'os';
import path from 'path';

import { registerTools } from '../src/tools';

type RegisteredTool = {
  name: string;
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

function collectTools() {
  const tools = new Map<string, RegisteredTool>();

  registerTools({
    addTool(config: RegisteredTool) {
      tools.set(config.name, config);
    },
  } as never);

  return tools;
}

function parseJsonToolResult(result: unknown) {
  const text = (result as { content: Array<{ text: string }> }).content[0]?.text;
  return JSON.parse(text);
}

describe('agent-teams-mcp tools', () => {
  const tools = collectTools();

  function getTool(name: string) {
    const tool = tools.get(name);
    expect(tool).toBeDefined();
    return tool!;
  }

  function makeClaudeDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-teams-mcp-'));
  }

  it('covers task clarification and comment attachment flows', async () => {
    const claudeDir = makeClaudeDir();
    const teamName = 'alpha';
    const attachmentPath = path.join(claudeDir, 'note.txt');
    fs.writeFileSync(attachmentPath, 'ship it');

    const createdTask = parseJsonToolResult(
      await getTool('task_create').execute({
        claudeDir,
        teamName,
        subject: 'Review MCP adapter',
        owner: 'alice',
      })
    );

    const commented = parseJsonToolResult(
      await getTool('task_add_comment').execute({
        claudeDir,
        teamName,
        taskId: createdTask.id,
        text: 'Need one more check',
        from: 'lead',
      })
    );

    const commentId = commented.commentId;
    expect(commentId).toBeTruthy();

    const attachment = parseJsonToolResult(
      await getTool('task_attach_comment_file').execute({
        claudeDir,
        teamName,
        taskId: createdTask.id,
        commentId,
        filePath: attachmentPath,
        mode: 'copy',
      })
    );

    expect(attachment.filename).toBe('note.txt');

    await getTool('task_set_clarification').execute({
      claudeDir,
      teamName,
      taskId: createdTask.id,
      value: 'user',
    });

    const loadedTask = parseJsonToolResult(
      await getTool('task_get').execute({
        claudeDir,
        teamName,
        taskId: createdTask.id,
      })
    );

    expect(loadedTask.needsClarification).toBe('user');
    expect(loadedTask.comments).toHaveLength(1);
    expect(loadedTask.comments[0].attachments).toHaveLength(1);

    await getTool('task_set_status').execute({
      claudeDir,
      teamName,
      taskId: createdTask.id,
      status: 'completed',
    });

    const reviewRequested = parseJsonToolResult(
      await getTool('review_request').execute({
        claudeDir,
        teamName,
        taskId: createdTask.id,
        from: 'lead',
        reviewer: 'alice',
      })
    );

    expect(reviewRequested.reviewState).toBe('review');
  });

  it('covers process register/list/stop without legacy stdout leaking into results', async () => {
    const claudeDir = makeClaudeDir();
    const teamName = 'beta';
    const pid = process.pid;

    const registered = parseJsonToolResult(
      await getTool('process_register').execute({
        claudeDir,
        teamName,
        pid,
        label: 'vite',
        command: 'pnpm dev',
        from: 'lead',
        port: 3000,
      })
    );

    expect(registered.pid).toBe(pid);
    expect(registered.label).toBe('vite');

    const listed = parseJsonToolResult(
      await getTool('process_list').execute({
        claudeDir,
        teamName,
      })
    );

    expect(listed).toHaveLength(1);
    expect(listed[0].pid).toBe(pid);

    const stopped = parseJsonToolResult(
      await getTool('process_stop').execute({
        claudeDir,
        teamName,
        pid,
      })
    );

    expect(stopped.pid).toBe(pid);
    expect(typeof stopped.stoppedAt).toBe('string');
  });

  it('persists full message metadata through message_send', async () => {
    const claudeDir = makeClaudeDir();
    const teamName = 'gamma';

    const sent = parseJsonToolResult(
      await getTool('message_send').execute({
        claudeDir,
        teamName,
        to: 'alice',
        text: 'Check this',
        from: 'lead',
        summary: 'Metadata test',
        source: 'system_notification',
        leadSessionId: 'session-42',
        attachments: [{ id: 'att-1', filename: 'note.txt', mimeType: 'text/plain', size: 4 }],
      })
    );

    expect(sent.deliveredToInbox).toBe(true);
    const inboxPath = path.join(claudeDir, 'teams', teamName, 'inboxes', 'alice.json');
    const rows = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
    expect(rows[0].source).toBe('system_notification');
    expect(rows[0].leadSessionId).toBe('session-42');
    expect(rows[0].attachments[0].filename).toBe('note.txt');
  });
});
