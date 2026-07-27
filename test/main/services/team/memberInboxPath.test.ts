import { resolveMemberInboxFileName } from '@main/services/team/memberInboxPath';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

describe('resolveMemberInboxFileName', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await fs.promises.rm(dir, { recursive: true, force: true });
      })
    );
  });

  async function makeInboxDir(): Promise<string> {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'inbox-alias-'));
    tempDirs.push(dir);
    return dir;
  }

  it('prefers the exact Unicode inbox when it exists', async () => {
    const inboxDir = await makeInboxDir();
    await fs.promises.writeFile(path.join(inboxDir, 'Karagöz.json'), '[]', 'utf8');
    await fs.promises.writeFile(path.join(inboxDir, 'Karag-z.json'), '[]', 'utf8');

    await expect(resolveMemberInboxFileName(inboxDir, 'Karagöz')).resolves.toBe('Karagöz');
  });

  it('falls back to the CLI ASCII-slug inbox when only the slug file exists', async () => {
    const inboxDir = await makeInboxDir();
    await fs.promises.writeFile(path.join(inboxDir, 'Karag-z.json'), '[]', 'utf8');

    await expect(resolveMemberInboxFileName(inboxDir, 'Karagöz')).resolves.toBe('Karag-z');
  });

  it('returns the canonical name when no inbox file exists yet', async () => {
    const inboxDir = await makeInboxDir();
    await expect(resolveMemberInboxFileName(inboxDir, 'Karagöz')).resolves.toBe('Karagöz');
  });
});
