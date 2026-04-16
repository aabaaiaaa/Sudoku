import { useEffect } from 'react';
import { gameStore } from '../store/game';

interface KeyboardHandlerProps {
  store?: typeof gameStore;
}

export function KeyboardHandler({ store = gameStore }: KeyboardHandlerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore typed keys while an input/textarea is focused.
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }

      const state = store.getState();
      const size = state.board.variant.size;
      const selection = state.selection;
      const key = e.key;

      // Arrow keys: move selection (or pick starting cell).
      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight'
      ) {
        e.preventDefault();
        if (!selection) {
          state.select({ row: 0, col: 0 });
          return;
        }
        let { row, col } = selection;
        if (key === 'ArrowUp') row = Math.max(0, row - 1);
        else if (key === 'ArrowDown') row = Math.min(size - 1, row + 1);
        else if (key === 'ArrowLeft') col = Math.max(0, col - 1);
        else if (key === 'ArrowRight') col = Math.min(size - 1, col + 1);
        state.select({ row, col });
        return;
      }

      // Notes mode toggle (always).
      if (key === 'n' || key === 'N') {
        e.preventDefault();
        state.toggleNotesMode();
        return;
      }

      // Escape: clear selection.
      if (key === 'Escape') {
        e.preventDefault();
        state.select(null);
        return;
      }

      // Space: toggle pause/resume.
      if (key === ' ' || key === 'Spacebar') {
        e.preventDefault();
        if (state.timer.paused) {
          state.resume();
        } else {
          state.pause();
        }
        return;
      }

      // Backspace / Delete: erase (no-op without selection).
      if (key === 'Backspace' || key === 'Delete') {
        if (!selection) return;
        e.preventDefault();
        state.erase();
        return;
      }

      // Digits 1..size (no-op without selection, ignore out-of-range).
      if (/^[0-9]$/.test(key)) {
        const digit = Number(key);
        if (digit < 1 || digit > size) return;
        if (!selection) return;
        e.preventDefault();
        if (state.notesMode) {
          state.toggleNote(digit);
        } else {
          state.placeDigit(digit);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store]);

  return null;
}

export default KeyboardHandler;
