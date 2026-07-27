/* eslint-disable @typescript-eslint/naming-convention -- Component mocks mirror PascalCase exports. */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, describe, expect, it, vi } from 'vitest';

const unreadBadgeMock = vi.hoisted(() => ({
  props: [] as { unreadCount: number; totalCount: number; pulseKey?: number }[],
}));

const unreadCommentCountMock = vi.hoisted(() => ({
  value: 0,
  calls: 0,
}));

vi.mock('@renderer/components/team/MemberBadge', () => ({
  MemberBadge: ({ name }: { name: string }) => React.createElement('span', null, name),
}));

vi.mock('@renderer/components/team/UnreadCommentsBadge', () => ({
  UnreadCommentsBadge: (props: { unreadCount: number; totalCount: number; pulseKey?: number }) => {
    unreadBadgeMock.props.push(props);
    return React.createElement('span', {
      className: (props.pulseKey ?? 0) > 0 ? 'kanban-comment-badge-pulse' : '',
      'data-pulse-key': props.pulseKey ?? 0,
      'data-testid': 'unread-comments-badge',
    });
  },
}));

vi.mock('@renderer/components/ui/button', () => ({
  Button: ({
    children,
    className,
    onClick,
    disabled,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    'aria-label'?: string;
  }) =>
    React.createElement(
      'button',
      { className, onClick, disabled, 'aria-label': ariaLabel, type: 'button' },
      children
    ),
}));

vi.mock('@renderer/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

vi.mock('@renderer/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

vi.mock('@renderer/hooks/useTheme', () => ({
  useTheme: () => ({ isLight: false }),
}));

vi.mock('@renderer/hooks/useUnreadCommentCount', () => ({
  useUnreadCommentCount: () => {
    unreadCommentCountMock.calls += 1;
    return unreadCommentCountMock.value;
  },
}));

/* eslint-enable @typescript-eslint/naming-convention -- Re-enable after component mocks. */

import { KanbanTaskCard } from './KanbanTaskCard';

import type { TeamTaskWithKanban } from '@shared/types/team';

const baseTask: TeamTaskWithKanban = {
  id: 'task-1',
  displayId: 'abcd1234',
  subject: 'Implement safer onboarding flow',
  owner: 'alice',
  reviewer: '',
  status: 'in_progress',
  changePresence: 'unknown',
  comments: [],
  blockedBy: [],
  blocks: [],
  workIntervals: [],
  historyEvents: [],
  createdAt: '2026-04-18T10:00:00.000Z',
  updatedAt: '2026-04-18T10:10:00.000Z',
} as unknown as TeamTaskWithKanban;

const noop = (): void => undefined;

function createTaskCardElement(
  props: Partial<React.ComponentProps<typeof KanbanTaskCard>> = {}
): React.ReactElement {
  return React.createElement(KanbanTaskCard, {
    task: baseTask,
    teamName: 'my-team',
    columnId: 'in_progress',
    hasReviewers: true,
    compact: false,
    taskMap: new Map(),
    onRequestReview: noop,
    onApprove: noop,
    onRequestChanges: noop,
    onMoveBackToDone: noop,
    onStartTask: noop,
    onCompleteTask: noop,
    onCancelTask: noop,
    onViewChanges: noop,
    ...props,
  });
}

async function flushReact(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  unreadBadgeMock.props.length = 0;
  unreadCommentCountMock.value = 0;
  unreadCommentCountMock.calls = 0;
});

async function renderTaskCard(
  props: Partial<React.ComponentProps<typeof KanbanTaskCard>> = {}
): Promise<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createTaskCardElement(props));
    await flushReact();
  });

  return { host, root };
}

describe('KanbanTaskCard change badge', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render a No changes badge when changePresence is no_changes', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        React.createElement(KanbanTaskCard, {
          task: { ...baseTask, changePresence: 'no_changes' },
          teamName: 'my-team',
          columnId: 'in_progress',
          hasReviewers: true,
          compact: false,
          taskMap: new Map(),
          onRequestReview: noop,
          onApprove: noop,
          onRequestChanges: noop,
          onMoveBackToDone: noop,
          onStartTask: noop,
          onCompleteTask: noop,
          onCancelTask: noop,
          onViewChanges: noop,
        })
      );
      await Promise.resolve();
    });

    expect(host.textContent).not.toContain('No changes');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });

  it('still renders the Changes action when changePresence is has_changes', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        React.createElement(KanbanTaskCard, {
          task: { ...baseTask, changePresence: 'has_changes' },
          teamName: 'my-team',
          columnId: 'in_progress',
          hasReviewers: true,
          compact: false,
          taskMap: new Map(),
          onRequestReview: noop,
          onApprove: noop,
          onRequestChanges: noop,
          onMoveBackToDone: noop,
          onStartTask: noop,
          onCompleteTask: noop,
          onCancelTask: noop,
          onViewChanges: noop,
        })
      );
      await Promise.resolve();
    });

    expect(host.querySelector('[aria-label="Changes"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });

  it('renders a Changes attention action when changePresence needs attention', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        React.createElement(KanbanTaskCard, {
          task: { ...baseTask, changePresence: 'needs_attention' },
          teamName: 'my-team',
          columnId: 'in_progress',
          hasReviewers: true,
          compact: false,
          taskMap: new Map(),
          onRequestReview: noop,
          onApprove: noop,
          onRequestChanges: noop,
          onMoveBackToDone: noop,
          onStartTask: noop,
          onCompleteTask: noop,
          onCancelTask: noop,
          onViewChanges: noop,
        })
      );
      await Promise.resolve();
    });

    expect(host.querySelector('[aria-label="Changes need attention"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });
});

describe('KanbanTaskCard blocked border', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('highlights blocked tasks outside final columns', async () => {
    const { host, root } = await renderTaskCard({
      task: { ...baseTask, blockedBy: ['task-2'] },
      columnId: 'in_progress',
    });

    const card = host.querySelector('[data-task-id="task-1"]');
    expect(card?.className).toContain('kanban-task-card');
    expect(card?.className).toContain('border-yellow-500/30');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });

  it('does not treat completed blockers as still blocking on the card', async () => {
    const completedBlocker = {
      ...baseTask,
      id: 'task-2',
      displayId: 'b150ebbf',
      subject: 'Already finished blocker',
      status: 'completed',
      reviewState: 'approved',
    } as TeamTaskWithKanban;

    const { host, root } = await renderTaskCard({
      task: { ...baseTask, blockedBy: ['task-2'] },
      columnId: 'in_progress',
      taskMap: new Map([['task-2', completedBlocker]]),
    });

    const card = host.querySelector('[data-task-id="task-1"]');
    expect(card?.className).not.toContain('border-yellow-500/30');
    expect(host.textContent).not.toContain('Blocked by');

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });

  it.each(['done', 'approved'] as const)(
    'does not highlight blocked tasks in %s',
    async (columnId) => {
      const { host, root } = await renderTaskCard({
        task: { ...baseTask, blockedBy: ['task-2'] },
        columnId,
      });

      const card = host.querySelector('[data-task-id="task-1"]');
      expect(card?.className).not.toContain('border-yellow-500/30');
      expect(card?.className).toContain('border-[var(--color-border)]');
      expect(host.textContent).toContain('Blocked by');

      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
    }
  );
});

describe('KanbanTaskCard live log indicator', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the live log indicator only when task log activity is active', async () => {
    const { host, root } = await renderTaskCard({ hasLiveTaskLogs: true });

    expect(host.querySelector('[aria-label="Task logs active"]')).not.toBeNull();

    await act(async () => {
      root.render(
        React.createElement(KanbanTaskCard, {
          task: baseTask,
          teamName: 'my-team',
          columnId: 'in_progress',
          hasReviewers: true,
          compact: false,
          taskMap: new Map(),
          onRequestReview: noop,
          onApprove: noop,
          onRequestChanges: noop,
          onMoveBackToDone: noop,
          onStartTask: noop,
          onCompleteTask: noop,
          onCancelTask: noop,
          onViewChanges: noop,
          hasLiveTaskLogs: false,
        })
      );
      await Promise.resolve();
    });

    expect(host.querySelector('[aria-label="Task logs active"]')).toBeNull();

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  });
});
