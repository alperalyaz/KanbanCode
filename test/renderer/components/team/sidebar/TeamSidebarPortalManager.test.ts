import { afterEach, describe, expect, it } from 'vitest';

import {
  getTeamSidebarPortalSnapshotForTests,
  resetTeamSidebarPortalManagerForTests,
  upsertTeamSidebarHost,
  upsertTeamSidebarSource,
} from '@renderer/components/team/sidebar/TeamSidebarPortalManager';

afterEach(() => {
  resetTeamSidebarPortalManagerForTests();
});

describe('TeamSidebarPortalManager', () => {
  it('prefers the focused host over an unfocused host for the same team', () => {
    upsertTeamSidebarHost('host-a', {
      teamName: 'alpha',
      surface: 'team',
      element: document.createElement('div'),
      isActive: true,
      isFocused: false,
    });
    upsertTeamSidebarHost('host-b', {
      teamName: 'alpha',
      surface: 'team',
      element: document.createElement('div'),
      isActive: true,
      isFocused: true,
    });

    const snapshot = getTeamSidebarPortalSnapshotForTests();

    expect(snapshot.activeHostIdByTeam.alpha).toBe('host-b');
  });

  it('prefers the active host over an inactive host for the same team', () => {
    upsertTeamSidebarHost('active-host', {
      teamName: 'alpha',
      surface: 'team',
      element: document.createElement('div'),
      isActive: true,
      isFocused: false,
    });
    upsertTeamSidebarHost('inactive-host', {
      teamName: 'alpha',
      surface: 'team',
      element: document.createElement('div'),
      isActive: false,
      isFocused: false,
    });

    const snapshot = getTeamSidebarPortalSnapshotForTests();

    expect(snapshot.activeHostIdByTeam.alpha).toBe('active-host');
  });

  it('prefers the most recently registered host when focus and activity tie', () => {
    upsertTeamSidebarHost('older-host', {
      teamName: 'alpha',
      surface: 'team',
      element: document.createElement('div'),
      isActive: true,
      isFocused: false,
    });
    upsertTeamSidebarHost('newer-host', {
      teamName: 'alpha',
      surface: 'team',
      element: document.createElement('div'),
      isActive: true,
      isFocused: false,
    });

    const snapshot = getTeamSidebarPortalSnapshotForTests();

    expect(snapshot.activeHostIdByTeam.alpha).toBe('newer-host');
  });

  it('prefers focused active source over stale mounted source for the same team', () => {
    upsertTeamSidebarSource('source-a', {
      teamName: 'alpha',
      isActive: true,
      isFocused: false,
    });
    upsertTeamSidebarSource('source-b', {
      teamName: 'alpha',
      isActive: true,
      isFocused: true,
    });

    const snapshot = getTeamSidebarPortalSnapshotForTests();

    expect(snapshot.activeSourceIdByTeam.alpha).toBe('source-b');
  });
});
