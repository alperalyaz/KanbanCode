import { collectMemberNameIdentityAliases } from '@main/services/team/provisioning/TeamProvisioningMemberIdentity';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve which inbox JSON file to use for a member when the CLI may have
 * registered an ASCII-slug twin (e.g. Karagöz → Karag-z.json).
 *
 * Preference:
 * 1. Exact member name if that file exists
 * 2. Otherwise the first existing CLI-slug alias file
 * 3. Otherwise the exact member name (create path for writers)
 */
export async function resolveMemberInboxFileName(
  inboxDir: string,
  memberName: string,
  allExpectedNames: readonly string[] = []
): Promise<string> {
  const candidates = collectMemberNameIdentityAliases(memberName, allExpectedNames);
  if (candidates.length === 0) {
    return memberName.trim();
  }

  const exact = candidates[0]!;
  const exactPath = path.join(inboxDir, `${exact}.json`);
  try {
    const stat = await fs.promises.stat(exactPath);
    if (stat.isFile()) {
      return exact;
    }
  } catch {
    // fall through to slug aliases
  }

  for (const candidate of candidates.slice(1)) {
    const candidatePath = path.join(inboxDir, `${candidate}.json`);
    try {
      const stat = await fs.promises.stat(candidatePath);
      if (stat.isFile()) {
        return candidate;
      }
    } catch {
      // try next alias
    }
  }

  return exact;
}

export function resolveMemberInboxPath(
  teamsBasePath: string,
  teamName: string,
  inboxFileName: string
): string {
  return path.join(teamsBasePath, teamName, 'inboxes', `${inboxFileName}.json`);
}
