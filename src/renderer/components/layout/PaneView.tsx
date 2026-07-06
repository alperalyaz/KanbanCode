/**
 * PaneView - Single pane wrapper with focus management.
 * Handles click-to-focus and width.
 * TabBar is now rendered in TabBarRow (above sidebar + content area).
 *
 * Note: edge split-on-drop is intentionally disabled — dragging a tab only
 * reorders it within the tab bar, it never drops onto the page body to spawn a
 * split pane.
 */

import { useStore } from '@renderer/store';
import { useShallow } from 'zustand/react/shallow';

import { PaneContent } from './PaneContent';

interface PaneViewProps {
  paneId: string;
}

export const PaneView = ({ paneId }: PaneViewProps): React.JSX.Element => {
  const { pane, isFocused, focusPane } = useStore(
    useShallow((s) => ({
      pane: s.paneLayout.panes.find((p) => p.id === paneId),
      isFocused: s.paneLayout.focusedPaneId === paneId,
      focusPane: s.focusPane,
    }))
  );

  if (!pane) return <div />;

  const handleMouseDown = (): void => {
    if (!isFocused) {
      focusPane(paneId);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- pane focus management requires mousedown
    <div
      className="relative flex min-w-0 flex-col"
      style={{
        width: `${pane.widthFraction * 100}%`,
      }}
      onMouseDown={handleMouseDown}
    >
      <PaneContent pane={pane} isPaneFocused={isFocused} />
    </div>
  );
};
