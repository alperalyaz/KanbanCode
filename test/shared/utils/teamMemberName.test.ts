import { describe, expect, it } from 'vitest';

import {
  createCliAsciiSlugTwinNameGuard,
  createCliAutoSuffixNameGuard,
  createCliProvisionerNameGuard,
  parseNumericSuffixName,
  toCliAsciiSlug,
  validateTeamMemberNameFormat,
} from '@shared/utils/teamMemberName';

describe('teamMemberName helpers', () => {
  it('accepts Turkish diacritics in member names', () => {
    expect(validateTeamMemberNameFormat('köroğlu')).toBeNull();
    expect(validateTeamMemberNameFormat('alpamış')).toBeNull();
    expect(validateTeamMemberNameFormat('aslı')).toBeNull();
    expect(validateTeamMemberNameFormat('yiğen')).toBeNull();
  });

  it('parses numeric suffix names', () => {
    expect(parseNumericSuffixName('alice-2')).toEqual({ base: 'alice', suffix: 2 });
    expect(parseNumericSuffixName('alice')).toBeNull();
    expect(parseNumericSuffixName('')).toBeNull();
  });

  it('drops cli auto-suffixed names only when the base name also exists', () => {
    const keepName = createCliAutoSuffixNameGuard(['dev', 'dev-2', 'dev-3']);

    expect(keepName('dev')).toBe(true);
    expect(keepName('dev-2')).toBe(false);
    expect(keepName('dev-3')).toBe(false);
  });

  it('keeps -1 names because they are often intentional', () => {
    const keepName = createCliAutoSuffixNameGuard(['worker', 'worker-1']);

    expect(keepName('worker')).toBe(true);
    expect(keepName('worker-1')).toBe(true);
  });

  it('keeps suffixed names when the base name is absent', () => {
    const keepName = createCliAutoSuffixNameGuard(['alice-2']);

    expect(keepName('alice-2')).toBe(true);
  });

  it('treats base-name collisions case-insensitively', () => {
    const keepName = createCliAutoSuffixNameGuard(['Alice', 'alice-2']);

    expect(keepName('alice-2')).toBe(false);
  });
});

describe('createCliProvisionerNameGuard', () => {
  it('drops provisioner names when the base member exists', () => {
    const keep = createCliProvisionerNameGuard([
      'alice',
      'alice-provisioner',
      'bob',
      'bob-provisioner',
    ]);

    expect(keep('alice')).toBe(true);
    expect(keep('alice-provisioner')).toBe(false);
    expect(keep('bob')).toBe(true);
    expect(keep('bob-provisioner')).toBe(false);
  });

  it('drops provisioner names even when the base member is absent', () => {
    const keep = createCliProvisionerNameGuard(['carol-provisioner']);

    expect(keep('carol-provisioner')).toBe(false);
  });

  it('treats base-name collisions case-insensitively', () => {
    const keep = createCliProvisionerNameGuard(['Alice', 'alice-provisioner']);

    expect(keep('alice-provisioner')).toBe(false);
  });

  it('keeps non-provisioner names unchanged', () => {
    const keep = createCliProvisionerNameGuard(['alice', 'alice-provisioner', 'dev-1']);

    expect(keep('alice')).toBe(true);
    expect(keep('dev-1')).toBe(true);
  });

  it('handles empty and edge-case names', () => {
    const keep = createCliProvisionerNameGuard(['', '-provisioner']);

    expect(keep('')).toBe(true);
    expect(keep('-provisioner')).toBe(true);
  });
});

describe('toCliAsciiSlug', () => {
  it('replaces each non-ascii char with a single dash, preserving case', () => {
    expect(toCliAsciiSlug('Köroğlu')).toBe('K-ro-lu');
    expect(toCliAsciiSlug('Alpamış')).toBe('Alpam--');
    expect(toCliAsciiSlug('Boğaç')).toBe('Bo-a-');
  });

  it('leaves pure-ascii alphanumerics untouched', () => {
    expect(toCliAsciiSlug('Aragorn')).toBe('Aragorn');
  });
});

describe('createCliAsciiSlugTwinNameGuard', () => {
  it('hides the CLI ascii-slug twin when the non-ascii origin is present', () => {
    const keep = createCliAsciiSlugTwinNameGuard([
      'Köroğlu',
      'K-ro-lu',
      'Alpamış',
      'Alpam--',
      'Boğaç',
      'Bo-a-',
    ]);

    expect(keep('Köroğlu')).toBe(true);
    expect(keep('K-ro-lu')).toBe(false);
    expect(keep('Alpamış')).toBe(true);
    expect(keep('Alpam--')).toBe(false);
    expect(keep('Boğaç')).toBe(true);
    expect(keep('Bo-a-')).toBe(false);
  });

  it('keeps the slug when its non-ascii origin is absent', () => {
    const keep = createCliAsciiSlugTwinNameGuard(['K-ro-lu']);

    expect(keep('K-ro-lu')).toBe(true);
  });

  it('never collapses legitimate ascii names that only differ in . - _', () => {
    const keep = createCliAsciiSlugTwinNameGuard(['ops.bot', 'ops-bot', 'dev-1', 'dev.1']);

    expect(keep('ops.bot')).toBe(true);
    expect(keep('ops-bot')).toBe(true);
    expect(keep('dev-1')).toBe(true);
    expect(keep('dev.1')).toBe(true);
  });

  it('matches the twin case-insensitively', () => {
    const keep = createCliAsciiSlugTwinNameGuard(['Köroğlu', 'k-ro-lu']);

    expect(keep('k-ro-lu')).toBe(false);
    expect(keep('Köroğlu')).toBe(true);
  });
});
