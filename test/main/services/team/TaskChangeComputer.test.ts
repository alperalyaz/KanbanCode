import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import * as fs from 'fs/promises';

import { TaskChangeComputer } from '../../../../src/main/services/team/TaskChangeComputer';

async function writeJsonl(filePath: string, entries: object[]): Promise<void> {
  await fs.writeFile(
    filePath,
    entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
    'utf8'
  );
}

function writeToolUse(toolUseId: string, filePath: string, content: string): object {
  return {
    timestamp: '2026-03-01T10:00:00.000Z',
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: toolUseId,
          name: 'Write',
          input: { file_path: filePath, content },
        },
      ],
    },
  };
}

describe('TaskChangeComputer', () => {
  let tmpDir: string | null = null;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('shares concurrent JSONL parsing and invalidates when the file changes', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-change-computer-'));
    const logPath = path.join(tmpDir, 'agent.jsonl');
    await writeJsonl(logPath, [writeToolUse('tool-1', '/repo/src/a.ts', 'export const a = 1;\n')]);

    const logsFinder = {
      findLogFileRefsForTask: () => Promise.resolve([{ filePath: logPath, memberName: 'alice' }]),
    };
    const boundaryParser = {
      parseBoundaries: () =>
        Promise.resolve({
          boundaries: [],
          scopes: [],
          isSingleTaskSession: true,
          detectedMechanism: 'none' as const,
        }),
    };
    const computer = new TaskChangeComputer(logsFinder as never, boundaryParser as never);
    const input = {
      teamName: 'team-a',
      taskId: 'task-1',
      taskMeta: null,
      effectiveOptions: {},
      projectPath: '/repo',
      includeDetails: false,
    };

    const [first, second] = await Promise.all([
      computer.computeTaskChanges(input),
      computer.computeTaskChanges(input),
    ]);

    expect(first.files.map((file) => file.relativePath)).toEqual(['src/a.ts']);
    expect(second.files).toEqual(first.files);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await writeJsonl(logPath, [
      writeToolUse('tool-1', '/repo/src/a.ts', 'export const a = 1;\n'),
      writeToolUse('tool-2', '/repo/src/b.ts', 'export const b = 2;\n'),
    ]);

    const afterChange = await computer.computeTaskChanges(input);
    expect(
      afterChange.files
        .map((file) => file.relativePath)
        .sort((left, right) => left.localeCompare(right))
    ).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
