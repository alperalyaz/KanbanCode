import { memo } from 'react';

import { MessagesPanel } from '../messages/MessagesPanel';

import type { MouseEventHandler } from 'react';
import type { ComponentProps } from 'react';

type SharedMessagesPanelProps = Omit<ComponentProps<typeof MessagesPanel>, 'position'>;

interface TeamSidebarRailProps {
  messagesPanelProps: SharedMessagesPanelProps;
  isResizing: boolean;
  onResizeMouseDown: MouseEventHandler<HTMLDivElement>;
}

export const TeamSidebarRail = memo(function TeamSidebarRail({
  messagesPanelProps,
  isResizing,
  onResizeMouseDown,
}: TeamSidebarRailProps): React.JSX.Element {
  return (
    <div className="flex size-full min-h-0 flex-col overflow-hidden bg-[var(--color-surface)]">
      <div className="min-h-0 flex-1">
        <MessagesPanel position="sidebar" {...messagesPanelProps} />
      </div>
      <div
        className={`absolute inset-y-0 right-0 z-20 w-1 cursor-col-resize transition-colors hover:bg-blue-500/30 ${isResizing ? 'bg-blue-500/40' : ''}`}
        onMouseDown={onResizeMouseDown}
      />
    </div>
  );
});
