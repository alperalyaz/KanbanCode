import { invertedEffects } from '@codemirror/commands';
import {
  acceptChunk,
  getChunks,
  getOriginalDoc,
  rejectChunk,
  updateOriginalDoc,
} from '@codemirror/merge';
import { ChangeSet, type ChangeSpec, type StateEffect } from '@codemirror/state';
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

export { acceptChunk, getChunks, rejectChunk };
