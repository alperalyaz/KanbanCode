/**
 * Tab bar for the project editor.
 * Shows open files as tabs with dirty indicator (dot), close button,
 * and right-click context menu (close others, close to left/right, close all).
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useStore } from '@renderer/store';
import { X } from 'lucide-react';

import { EditorTabContextMenu } from './EditorTabContextMenu';
import { FileIcon } from './FileIcon';

import type { EditorFileTab } from '@shared/types/editor';

// =============================================================================
// Types
// =============================================================================

interface EditorTabBarProps {
  /** Called instead of direct closeTab — allows parent to intercept dirty tabs */
  onRequestCloseTab: (tabId: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export const EditorTabBar = ({
  onRequestCloseTab,
}: EditorTabBarProps): React.ReactElement | null => {
  const tabs = useStore((s) => s.editorOpenTabs);
  const activeTabId = useStore((s) => s.editorActiveTabId);
  const modifiedFiles = useStore((s) => s.editorModifiedFiles);
  const setActiveEditorTab = useStore((s) => s.setActiveEditorTab);
  const closeOtherEditorTabs = useStore((s) => s.closeOtherEditorTabs);
  const closeEditorTabsToLeft = useStore((s) => s.closeEditorTabsToLeft);
  const closeEditorTabsToRight = useStore((s) => s.closeEditorTabsToRight);
  const closeAllEditorTabs = useStore((s) => s.closeAllEditorTabs);

  if (tabs.length === 0) return null;

  return (
    <div
      className="flex h-8 shrink-0 items-center overflow-x-auto border-b border-border bg-surface-sidebar"
      role="tablist"
    >
      {tabs.map((tab, index) => (
        <Tab
          key={tab.id}
          tab={tab}
          tabIndex={index}
          totalTabs={tabs.length}
          isActive={tab.id === activeTabId}
          isModified={!!modifiedFiles[tab.filePath]}
          onActivate={() => setActiveEditorTab(tab.id)}
          onRequestClose={onRequestCloseTab}
          onCloseOthers={closeOtherEditorTabs}
          onCloseToLeft={closeEditorTabsToLeft}
          onCloseToRight={closeEditorTabsToRight}
          onCloseAll={closeAllEditorTabs}
        />
      ))}
    </div>
  );
};

// =============================================================================
// Tab item
// =============================================================================

interface TabProps {
  tab: EditorFileTab;
  tabIndex: number;
  totalTabs: number;
  isActive: boolean;
  isModified: boolean;
  onActivate: () => void;
  onRequestClose: (tabId: string) => void;
  onCloseOthers: (tabId: string) => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  onCloseAll: () => void;
}

const Tab = ({
  tab,
  tabIndex,
  totalTabs,
  isActive,
  isModified,
  onActivate,
  onRequestClose,
  onCloseOthers,
  onCloseToLeft,
  onCloseToRight,
  onCloseAll,
}: TabProps): React.ReactElement => {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRequestClose(tab.id);
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onRequestClose(tab.id);
    }
  };

  return (
    <EditorTabContextMenu
      tabId={tab.id}
      tabIndex={tabIndex}
      totalTabs={totalTabs}
      onClose={onRequestClose}
      onCloseOthers={onCloseOthers}
      onCloseToLeft={onCloseToLeft}
      onCloseToRight={onCloseToRight}
      onCloseAll={onCloseAll}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onActivate}
            onAuxClick={handleAuxClick}
            role="tab"
            aria-selected={isActive}
            className={`group flex h-full shrink-0 items-center gap-1.5 border-r border-border px-3 text-xs transition-colors ${
              isActive
                ? 'bg-surface text-text'
                : 'bg-surface-sidebar text-text-muted hover:bg-surface-raised hover:text-text-secondary'
            }`}
          >
            {isModified && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-amber-400"
                aria-label="Unsaved changes"
              />
            )}
            <FileIcon fileName={tab.fileName} className="size-3.5" />
            <span className="max-w-40 truncate">
              {tab.fileName}
              {tab.disambiguatedLabel && (
                <span className="ml-1 text-text-muted">{tab.disambiguatedLabel}</span>
              )}
            </span>
            <span
              onClick={handleClose}
              className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-surface-raised group-hover:opacity-100"
              role="button"
              aria-label={`Close ${tab.fileName}`}
              tabIndex={-1}
            >
              <X className="size-3" />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tab.filePath}</TooltipContent>
      </Tooltip>
    </EditorTabContextMenu>
  );
};
