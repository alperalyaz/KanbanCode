import {
  dismissRecentProject,
  filterDismissedRecentProjects,
  isRecentProjectDismissed,
  resetRecentProjectDismissalsForTests,
} from '@features/recent-projects/renderer/utils/recentProjectDismissals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DashboardRecentProject } from '@features/recent-projects/contracts';

function createProject(
  overrides: Partial<DashboardRecentProject> = {}
): DashboardRecentProject {
  return {
    id: 'path:/workspace/demo',
    name: 'demo',
    primaryPath: '/workspace/demo',
    associatedPaths: [],
    mostRecentActivity: Date.now(),
    providerIds: ['anthropic'],
    source: 'claude',
    openTarget: { kind: 'project', projectPath: '/workspace/demo' },
    ...overrides,
  };
}

describe('recentProjectDismissals', () => {
  beforeEach(() => {
    resetRecentProjectDismissalsForTests();
  });

  afterEach(() => {
    resetRecentProjectDismissalsForTests();
  });

  it('dismisses projects by id and path', () => {
    const project = createProject();

    dismissRecentProject(project);

    expect(isRecentProjectDismissed(project)).toBe(true);
    expect(filterDismissedRecentProjects([project])).toEqual([]);
  });

  it('keeps non-dismissed projects visible', () => {
    const dismissed = createProject({ id: 'path:/workspace/hidden', primaryPath: '/workspace/hidden' });
    const visible = createProject({ id: 'path:/workspace/open', primaryPath: '/workspace/open' });

    dismissRecentProject(dismissed);

    expect(filterDismissedRecentProjects([dismissed, visible])).toEqual([visible]);
  });
});
