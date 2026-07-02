import { describe, expect, it } from 'vitest';

import {
  getReleaseApiUrls,
  getExpectedLatestMacArtifacts,
  getExpectedReleaseAssetUrl,
  getExpectedReleaseAssetUrls,
  getLatestMacMetadataUrl,
  getLatestMacMetadataUrls,
  isLatestMacMetadataCompatible,
  parseReleaseMetadataAssetNames,
  shouldSkipReleaseForUpdater,
} from '../../../../src/main/services/infrastructure/updaterReleaseMetadata';

describe('updaterReleaseMetadata', () => {
  it('builds platform-specific asset URLs', () => {
    expect(getExpectedReleaseAssetUrl('1.2.3', 'darwin', 'arm64')).toBe(
      'https://github.com/alperalyaz/kanbancode/releases/download/v1.2.3/KanbanCode-1.2.3-arm64.dmg'
    );
    expect(getExpectedReleaseAssetUrl('1.2.3', 'darwin', 'x64')).toBe(
      'https://github.com/alperalyaz/kanbancode/releases/download/v1.2.3/KanbanCode-1.2.3-x64.dmg'
    );
    expect(getExpectedReleaseAssetUrl('1.2.3', 'win32', 'x64')).toBe(
      'https://github.com/alperalyaz/kanbancode/releases/download/v1.2.3/KanbanCode.Setup.1.2.3.exe'
    );
    expect(getExpectedReleaseAssetUrl('1.2.3', 'linux', 'x64')).toBe(
      'https://github.com/alperalyaz/kanbancode/releases/download/v1.2.3/KanbanCode-1.2.3.AppImage'
    );
  });

  it('builds primary and legacy repo asset URLs after the GitHub repo rename', () => {
    expect(getExpectedReleaseAssetUrls('1.2.3', 'darwin', 'arm64')).toEqual([
      'https://github.com/alperalyaz/kanbancode/releases/download/v1.2.3/KanbanCode-1.2.3-arm64.dmg',
      'https://github.com/alperalyaz/agent-teams-ai/releases/download/v1.2.3/KanbanCode-1.2.3-arm64.dmg',
    ]);
    expect(getReleaseApiUrls('1.2.3')).toEqual([
      'https://api.github.com/repos/alperalyaz/kanbancode/releases/tags/v1.2.3',
      'https://api.github.com/repos/alperalyaz/agent-teams-ai/releases/tags/v1.2.3',
    ]);
  });

  it('detects releases that must be hidden from auto-updater', () => {
    expect(shouldSkipReleaseForUpdater({ tag_name: 'v1.2.3', name: 'v1.2.3' })).toBe(false);
    expect(shouldSkipReleaseForUpdater({ tag_name: 'v1.2.4', prerelease: true })).toBe(true);
    expect(shouldSkipReleaseForUpdater({ tag_name: 'v1.2.5', draft: true })).toBe(true);
    expect(
      shouldSkipReleaseForUpdater({
        tag_name: 'v1.2.6',
        name: 'Internal smoke [skip-updater]',
      })
    ).toBe(true);
    expect(
      shouldSkipReleaseForUpdater({
        tag_name: 'v1.2.7',
        body: 'Temporary QA build [test-release]',
      })
    ).toBe(true);
  });

  it('extracts updater asset names from latest-mac.yml text', () => {
    const metadata = `
version: 1.2.3
files:
  - url: "KanbanCode-1.2.3-arm64-mac.zip"
    sha512: abc
    size: 123
  - url: 'KanbanCode-1.2.3-arm64.dmg'
    sha512: def
    size: 456
path: KanbanCode-1.2.3-arm64-mac.zip
`;

    expect(parseReleaseMetadataAssetNames(metadata)).toEqual(
      new Set(['KanbanCode-1.2.3-arm64-mac.zip', 'KanbanCode-1.2.3-arm64.dmg'])
    );
  });

  it('validates arch compatibility for latest-mac.yml', () => {
    const version = '1.2.3';
    const arm64Metadata = `
version: ${version}
files:
  - url: KanbanCode-${version}-arm64-mac.zip
    sha512: abc
    size: 123
  - url: KanbanCode-${version}-arm64.dmg
    sha512: def
    size: 456
path: KanbanCode-${version}-arm64-mac.zip
`;

    expect(getExpectedLatestMacArtifacts(version, 'arm64')).toEqual([
      `KanbanCode-${version}-arm64-mac.zip`,
      `KanbanCode-${version}-arm64.dmg`,
    ]);
    expect(getExpectedLatestMacArtifacts(version, 'x64')).toEqual([
      `KanbanCode-${version}-x64-mac.zip`,
      `KanbanCode-${version}-x64.dmg`,
    ]);
    expect(getLatestMacMetadataUrl(version)).toBe(
      `https://github.com/alperalyaz/kanbancode/releases/download/v${version}/latest-mac.yml`
    );
    expect(getLatestMacMetadataUrls(version)).toEqual([
      `https://github.com/alperalyaz/kanbancode/releases/download/v${version}/latest-mac.yml`,
      `https://github.com/alperalyaz/agent-teams-ai/releases/download/v${version}/latest-mac.yml`,
    ]);
    expect(isLatestMacMetadataCompatible(arm64Metadata, version, 'arm64')).toBe(true);
    expect(isLatestMacMetadataCompatible(arm64Metadata, version, 'x64')).toBe(false);
  });
});
