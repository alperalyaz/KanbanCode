import { invertedEffects } from '@codemirror/commands';
import {
  acceptChunk,
  getChunks,
  getOriginalDoc,
  originalDocChangeEffect,
  rejectChunk,
  updateOriginalDoc,
} from '@codemirror/merge';
import { ChangeSet, type ChangeSpec, EditorState, type StateEffect } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';

/**
 * Teaches CM history to undo acceptChunk operations (updateOriginalDoc effects).
 * Without this, Cmd+Z only works for rejectChunk (document changes) but not acceptChunk.
 */
export const mergeUndoSupport = invertedEffects.of((tr) => {
  const effects: StateEffect<unknown>[] = [];
  for (const effect of tr.effects) {
    if (effect.is(updateOriginalDoc)) {
      const prevOriginal = getOriginalDoc(tr.startState);
      const inverseSpecs: ChangeSpec[] = [];
      effect.value.changes.iterChanges((fromA: number, toA: number, fromB: number, toB: number) => {
        inverseSpecs.push({
          from: fromB,
          to: toB,
          insert: prevOriginal.sliceString(fromA, toA),
        });
      });
      const inverseChanges = ChangeSet.of(inverseSpecs, effect.value.doc.length);
      effects.push(updateOriginalDoc.of({ doc: prevOriginal, changes: inverseChanges }));
    }
  }
  return effects;
});

/** Accept all remaining chunks in one transaction (single Cmd+Z to undo) */
export function acceptAllChunks(view: EditorView): boolean {
  const result = getChunks(view.state);
  if (!result || result.chunks.length === 0) return false;

  const orig = getOriginalDoc(view.state);
  const specs: ChangeSpec[] = [];
  for (const chunk of result.chunks) {
    specs.push({
      from: chunk.fromA,
      to: chunk.toA,
      insert: view.state.doc.sliceString(chunk.fromB, chunk.toB),
    });
  }
  const changes = ChangeSet.of(specs, orig.length);
  view.dispatch({
    effects: updateOriginalDoc.of({ doc: changes.apply(orig), changes }),
  });
  return true;
}

/** Reject all remaining chunks in one transaction (single Cmd+Z to undo) */
export function rejectAllChunks(view: EditorView): boolean {
  const result = getChunks(view.state);
  if (!result || result.chunks.length === 0) return false;

  const orig = getOriginalDoc(view.state);
  const specs: ChangeSpec[] = [];
  for (const chunk of result.chunks) {
    specs.push({
      from: chunk.fromB,
      to: chunk.toB,
      insert: orig.sliceString(chunk.fromA, chunk.toA),
    });
  }
  view.dispatch({ changes: specs });
  return true;
}

/**
 * After all diff chunks are accepted, mirrors user edits to the original doc
 * so no new diffs appear. Makes editing feel like a regular editor (Cursor-like).
 */
export const mirrorEditsAfterResolve = EditorState.transactionExtender.of((tr) => {
  if (!tr.docChanged) return null;

  // Skip if transaction already updates original (undo/redo inverse, explicit accept)
  if (tr.effects.some((e) => e.is(updateOriginalDoc))) return null;

  // Only mirror when ALL chunks are resolved
  const result = getChunks(tr.startState);
  if (!result || result.chunks.length > 0) return null;

  // Mirror edit to original doc (same ChangeSet applies because original === modified)
  return { effects: originalDocChangeEffect(tr.startState, tr.changes) };
});

export { acceptChunk, getChunks, rejectChunk };
