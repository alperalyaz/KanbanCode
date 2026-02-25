import React, { useCallback, useEffect, useRef } from 'react';

import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { less } from '@codemirror/lang-less';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sass } from '@codemirror/lang-sass';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { indentUnit, LanguageDescription, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { goToNextChunk, goToPreviousChunk, unifiedMergeView } from '@codemirror/merge';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';

import { acceptChunk, getChunks, mergeUndoSupport, rejectChunk } from './CodeMirrorDiffUtils';

interface CodeMirrorDiffViewProps {
  original: string;
  modified: string;
  fileName: string;
  maxHeight?: string;
  readOnly?: boolean;
  showMergeControls?: boolean;
  collapseUnchanged?: boolean;
  collapseMargin?: number;
  onHunkAccepted?: (hunkIndex: number) => void;
  onHunkRejected?: (hunkIndex: number) => void;
  /** Called when the user scrolls to the end of the diff (auto-viewed) */
  onFullyViewed?: () => void;
  /** Ref to expose the EditorView for external navigation */
  editorViewRef?: React.RefObject<EditorView | null>;
  /** Called when editor content changes (debounced, only when readOnly=false) */
  onContentChanged?: (content: string) => void;
  /** Cached EditorState to restore (preserves undo history between file switches) */
  initialState?: EditorState;
}

/** Synchronous language extension for common file types (bundled by Vite) */
function getSyncLanguageExtension(fileName: string): Extension | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({
        jsx: ext === 'tsx' || ext === 'jsx',
        typescript: ext === 'ts' || ext === 'tsx',
      });
    case 'py':
      return python();
    case 'json':
    case 'jsonl':
      return json();
    case 'css':
      return css();
    case 'scss':
      return sass({ indented: false });
    case 'sass':
      return sass({ indented: true });
    case 'less':
      return less();
    case 'html':
    case 'htm':
      return html();
    case 'xml':
    case 'svg':
      return xml();
    case 'md':
    case 'mdx':
    case 'markdown':
      return markdown();
    case 'yaml':
    case 'yml':
      return yaml();
    case 'rs':
      return rust();
    case 'go':
      return go();
    case 'java':
      return java();
    case 'c':
    case 'h':
    case 'cpp':
    case 'cxx':
    case 'cc':
    case 'hpp':
      return cpp();
    case 'php':
      return php();
    case 'sql':
      return sql();
    default:
      return null;
  }
}

/** Async fallback: match by filename via @codemirror/language-data for rare languages */
function getAsyncLanguageDesc(fileName: string): LanguageDescription | null {
  return LanguageDescription.matchFilename(languages, fileName);
}

/** Compute hunk index for the chunk at a given position */
function computeHunkIndexAtPos(state: EditorState, pos: number): number {
  const chunks = getChunks(state);
  if (!chunks) return 0;

  let index = 0;
  for (const chunk of chunks.chunks) {
    if (pos >= chunk.fromA && pos <= chunk.toA) {
      return index;
    }
    if (pos >= chunk.fromB && pos <= chunk.toB) {
      return index;
    }
    index++;
  }
  return 0;
}

/** Custom dark theme for diff view using CSS variables */
const diffTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '13px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    fontSize: '12px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-content': {
    caretColor: 'var(--color-text)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-text)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.3) !important',
  },
  // Diff-specific styles — line-level backgrounds (no per-character underlines)
  '.cm-changedLine': {
    backgroundColor: 'var(--diff-added-bg, rgba(46, 160, 67, 0.22))',
  },
  '.cm-deletedChunk': {
    backgroundColor: 'var(--diff-removed-bg, rgba(248, 81, 73, 0.15))',
  },
  '.cm-insertedLine': {
    backgroundColor: 'var(--diff-added-bg, rgba(46, 160, 67, 0.22))',
  },
  '.cm-deletedLine': {
    backgroundColor: 'var(--diff-removed-bg, rgba(248, 81, 73, 0.15))',
  },
  // Merge control buttons
  '.cm-merge-accept': {
    cursor: 'pointer',
    padding: '0 4px',
    margin: '0 2px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: '500',
    lineHeight: '18px',
    display: 'inline-block',
    color: '#3fb950',
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
    border: '1px solid rgba(46, 160, 67, 0.3)',
    '&:hover': {
      backgroundColor: 'rgba(46, 160, 67, 0.3)',
    },
  },
  '.cm-merge-reject': {
    cursor: 'pointer',
    padding: '0 4px',
    margin: '0 2px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: '500',
    lineHeight: '18px',
    display: 'inline-block',
    color: '#f85149',
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    border: '1px solid rgba(248, 81, 73, 0.3)',
    '&:hover': {
      backgroundColor: 'rgba(248, 81, 73, 0.3)',
    },
  },
  // Collapse unchanged region marker
  '.cm-collapsedLines': {
    backgroundColor: 'var(--color-surface-raised)',
    color: 'var(--color-text-muted)',
    fontSize: '12px',
    padding: '2px 8px',
    cursor: 'pointer',
    borderTop: '1px solid var(--color-border)',
    borderBottom: '1px solid var(--color-border)',
  },
});

export const CodeMirrorDiffView = ({
  original,
  modified,
  fileName,
  maxHeight = '100%',
  readOnly = false,
  showMergeControls = false,
  collapseUnchanged: collapseUnchangedProp = true,
  collapseMargin = 3,
  onHunkAccepted,
  onHunkRejected,
  onFullyViewed,
  editorViewRef: externalViewRef,
  onContentChanged,
  initialState,
}: CodeMirrorDiffViewProps): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const endSentinelRef = useRef<HTMLDivElement>(null);
  // Local ref to hold externalViewRef for syncing via useEffect
  const externalViewRefHolder = useRef(externalViewRef);

  // Stabilize callbacks via useEffect (cannot update refs during render)
  const onAcceptRef = useRef(onHunkAccepted);
  const onRejectRef = useRef(onHunkRejected);
  const onContentChangedRef = useRef(onContentChanged);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    onAcceptRef.current = onHunkAccepted;
    onRejectRef.current = onHunkRejected;
    onContentChangedRef.current = onContentChanged;
    externalViewRefHolder.current = externalViewRef;
  }, [onHunkAccepted, onHunkRejected, onContentChanged, externalViewRef]);

  // Auto-scroll to next chunk after accept/reject (deferred to let CM recalculate)
  const scrollToNextChunk = useCallback(() => {
    requestAnimationFrame(() => {
      if (viewRef.current) goToNextChunk(viewRef.current);
    });
  }, []);

  // Compartment for lazy-injected language support
  const langCompartment = useRef(new Compartment());

  const buildExtensions = useCallback(() => {
    const extensions: Extension[] = [
      diffTheme,
      syntaxHighlighting(oneDarkHighlightStyle),
      EditorView.editable.of(!readOnly),
      EditorState.readOnly.of(readOnly),
    ];

    // Undo/redo support and standard editing keybindings
    if (!readOnly) {
      extensions.push(history());
      extensions.push(mergeUndoSupport);
      extensions.push(indentUnit.of('  '));
      extensions.push(keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]));
    }

    // Language placeholder — actual language injected async via compartment reconfigure
    extensions.push(langCompartment.current.of([]));

    // Keyboard shortcuts for chunk navigation and accept/reject
    extensions.push(
      keymap.of([
        {
          key: 'Mod-y',
          run: (view) => {
            acceptChunk(view);
            requestAnimationFrame(() => goToNextChunk(view));
            return true;
          },
        },
        {
          key: 'Mod-n',
          run: (view) => {
            rejectChunk(view);
            requestAnimationFrame(() => goToNextChunk(view));
            return true;
          },
        },
        {
          key: 'Alt-j',
          run: (view) => {
            goToNextChunk(view);
            return true;
          },
        },
        {
          key: 'Ctrl-Alt-ArrowDown',
          run: goToNextChunk,
        },
        {
          key: 'Ctrl-Alt-ArrowUp',
          run: goToPreviousChunk,
        },
      ])
    );

    // Debounced content change listener (only when editable)
    if (!readOnly) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => {
              onContentChangedRef.current?.(update.state.doc.toString());
            }, 300);
          }
        })
      );
    }

    // Unified merge view
    const mergeConfig: Parameters<typeof unifiedMergeView>[0] = {
      original,
      highlightChanges: false,
      gutter: true,
      syntaxHighlightDeletions: true,
    };

    if (collapseUnchangedProp) {
      mergeConfig.collapseUnchanged = {
        margin: collapseMargin,
        minSize: 4,
      };
    }

    if (showMergeControls) {
      // NOTE: We intentionally do NOT use the `action` callback from @codemirror/merge.
      // CM's DeletionWidget caches DOM via a global WeakMap keyed by chunk.changes.
      // When EditorView is recreated (e.g. from cached initialState), toDOM() returns
      // the OLD cached DOM whose `action` closure references the DESTROYED view.
      // Instead, we call acceptChunk/rejectChunk directly with viewRef.current.
      mergeConfig.mergeControls = (type, _action) => {
        const btn = document.createElement('button');

        if (type === 'accept') {
          btn.textContent = '\u2713';
          btn.title = 'Accept change';
          btn.className = 'cm-merge-accept';
          btn.onmousedown = (e) => {
            e.preventDefault();
            const view = viewRef.current;
            if (view) {
              const pos = view.posAtDOM(btn);
              const hunkIndex = computeHunkIndexAtPos(view.state, pos);
              acceptChunk(view, pos);
              onAcceptRef.current?.(hunkIndex);
              scrollToNextChunk();
            }
          };
        } else {
          btn.textContent = '\u2717';
          btn.title = 'Reject change';
          btn.className = 'cm-merge-reject';
          btn.onmousedown = (e) => {
            e.preventDefault();
            const view = viewRef.current;
            if (view) {
              const pos = view.posAtDOM(btn);
              const hunkIndex = computeHunkIndexAtPos(view.state, pos);
              rejectChunk(view, pos);
              onRejectRef.current?.(hunkIndex);
              scrollToNextChunk();
            }
          };
        }

        return btn;
      };
    }

    extensions.push(unifiedMergeView(mergeConfig));

    return extensions;
  }, [
    original,
    readOnly,
    showMergeControls,
    collapseUnchangedProp,
    collapseMargin,
    scrollToNextChunk,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const view = initialState
      ? new EditorView({ state: initialState, parent: containerRef.current })
      : new EditorView({
          doc: modified,
          extensions: buildExtensions(),
          parent: containerRef.current,
        });

    viewRef.current = view;
    // Sync to external ref via holder
    const extRef = externalViewRefHolder.current;
    if (extRef) {
      (extRef as React.MutableRefObject<EditorView | null>).current = view;
    }

    return () => {
      view.destroy();
      viewRef.current = null;
      if (extRef) {
        (extRef as React.MutableRefObject<EditorView | null>).current = null;
      }
    };
    // We intentionally rebuild the entire editor when key props change
  }, [original, modified, buildExtensions, initialState]);

  // Inject language extension via compartment after editor creation
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Try synchronous (bundled) language first
    const syncLang = getSyncLanguageExtension(fileName);
    if (syncLang) {
      view.dispatch({ effects: langCompartment.current.reconfigure(syncLang) });
      return;
    }

    // Async fallback for rare languages via @codemirror/language-data
    const desc = getAsyncLanguageDesc(fileName);
    if (!desc) return;

    if (desc.support) {
      view.dispatch({ effects: langCompartment.current.reconfigure(desc.support) });
      return;
    }

    let cancelled = false;
    void desc.load().then((support: Extension) => {
      if (!cancelled && viewRef.current === view) {
        view.dispatch({ effects: langCompartment.current.reconfigure(support) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fileName, buildExtensions, initialState]);

  // Auto-viewed detection via IntersectionObserver
  useEffect(() => {
    if (!endSentinelRef.current || !onFullyViewed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onFullyViewed();
          }
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(endSentinelRef.current);
    return () => observer.disconnect();
  }, [onFullyViewed]);

  return (
    <div className="flex flex-col" style={{ maxHeight }}>
      <div ref={containerRef} className="flex-1 overflow-hidden rounded-lg border border-border" />
      {/* Invisible sentinel for auto-viewed detection */}
      <div ref={endSentinelRef} className="h-px shrink-0" />
    </div>
  );
};
