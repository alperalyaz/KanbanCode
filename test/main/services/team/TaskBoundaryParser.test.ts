import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import * as fs from 'fs/promises';

import { TaskBoundaryParser } from '../../../../src/main/services/team/TaskBoundaryParser';

describe('TaskBoundaryParser', () => {
  let tmpDir: string | null = null;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('detects MCP task boundaries for modern runtime sessions', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-boundary-parser-'));
    const jsonlPath = path.join(tmpDir, 'mcp.jsonl');
    await fs.writeFile(
      jsonlPath,
      [
        JSON.stringify({
          timestamp: '2026-03-01T10:00:00.000Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'task_start',
                input: { taskId: 'task-123' },
              },
            ],
          },
        }),
        JSON.stringify({
          timestamp: '2026-03-01T10:10:00.000Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'task_complete',
                input: { taskId: 'task-123' },
              },
            ],
          },
        }),
      ].join('\n') + '\n',
      'utf8'
    );

    const result = await new TaskBoundaryParser().parseBoundaries(jsonlPath);

    expect(result.detectedMechanism).toBe('mcp');
    expect(result.boundaries).toHaveLength(2);
    expect(result.boundaries.map((entry) => entry.event)).toEqual(['start', 'complete']);
    expect(result.boundaries.every((entry) => entry.mechanism === 'mcp')).toBe(true);
  });

  it('falls back to legacy teamctl bash parsing for historical logs', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-boundary-parser-'));
    const jsonlPath = path.join(tmpDir, 'teamctl.jsonl');
    await fs.writeFile(
      jsonlPath,
      [
        JSON.stringify({
          timestamp: '2026-03-01T10:00:00.000Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Bash',
                input: { command: 'node "teamctl.js" --team demo task start 123' },
              },
            ],
          },
        }),
        JSON.stringify({
          timestamp: '2026-03-01T10:10:00.000Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Bash',
                input: { command: 'node "teamctl.js" --team demo task set-status 123 completed' },
              },
            ],
          },
        }),
      ].join('\n') + '\n',
      'utf8'
    );

    const result = await new TaskBoundaryParser().parseBoundaries(jsonlPath);

    expect(result.detectedMechanism).toBe('teamctl');
    expect(result.boundaries).toHaveLength(2);
    expect(result.boundaries.map((entry) => entry.event)).toEqual(['start', 'complete']);
    expect(result.boundaries.every((entry) => entry.mechanism === 'teamctl')).toBe(true);
  });

  it('prefers structured mechanisms over legacy teamctl in mixed logs', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-boundary-parser-'));
    const jsonlPath = path.join(tmpDir, 'mixed.jsonl');
    await fs.writeFile(
      jsonlPath,
      [
        JSON.stringify({
          timestamp: '2026-03-01T10:00:00.000Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'task_start',
                input: { taskId: 'task-123' },
              },
            ],
          },
        }),
        JSON.stringify({
          timestamp: '2026-03-01T10:05:00.000Z',
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Bash',
                input: { command: 'node "teamctl.js" --team demo task complete 123' },
              },
            ],
          },
        }),
      ].join('\n') + '\n',
      'utf8'
    );

    const result = await new TaskBoundaryParser().parseBoundaries(jsonlPath);

    expect(result.detectedMechanism).toBe('mcp');
  });
});
