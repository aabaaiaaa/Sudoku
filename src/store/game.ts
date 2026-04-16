import { createStore } from 'zustand/vanilla';
import { peers } from '../engine/peers';
import type { Board, Digit, Position, Variant } from '../engine/types';
import { createEmptyBoard } from '../engine/types';
import { getVariant } from '../engine/variants';

export interface TimerState {
  startTs: number | null;
  accumulatedMs: number;
  paused: boolean;
}

export interface GameState {
  board: Board;
  selection: Position | null;
  notesMode: boolean;
  mistakes: number;
  timer: TimerState;
}

export interface GameActions {
  /**
   * Start a new empty game for the given variant. Accepts either a Variant
   * object or a variant id string. Difficulty is accepted for future use but
   * is currently unused (generation happens in a later task). Resets
   * selection, notesMode, mistakes and timer.
   */
  newGame: (variant: Variant | string, difficulty?: string) => void;
  select: (pos: Position | null) => void;
  placeDigit: (d: Digit) => void;
  toggleNote: (d: Digit) => void;
  erase: () => void;
  toggleNotesMode: () => void;
  pause: () => void;
  resume: () => void;
}

export type GameStore = GameState & GameActions;

function resolveVariant(variant: Variant | string): Variant {
  if (typeof variant === 'string') {
    const resolved = getVariant(variant);
    if (!resolved) {
      throw new Error(`Unknown variant id: ${variant}`);
    }
    return resolved;
  }
  return variant;
}

function initialTimer(): TimerState {
  return { startTs: null, accumulatedMs: 0, paused: true };
}

function initialState(variant: Variant): GameState {
  return {
    board: createEmptyBoard(variant),
    selection: null,
    notesMode: false,
    mistakes: 0,
    timer: initialTimer(),
  };
}

export function createGameStore(initialVariant: Variant | string = 'classic') {
  const variant = resolveVariant(initialVariant);

  return createStore<GameStore>((set, get) => ({
    ...initialState(variant),

    newGame: (variantInput, _difficulty) => {
      void _difficulty;
      const v = resolveVariant(variantInput);
      set(initialState(v));
    },

    select: (pos) => {
      set({ selection: pos });
    },

    placeDigit: (d) => {
      const { board, selection } = get();
      if (!selection) return;
      const cell = board.cells[selection.row][selection.col];
      if (cell.given) return;

      // Check for conflicts against peers before mutating.
      let conflict = false;
      for (const p of peers(board.variant, selection)) {
        if (board.cells[p.row][p.col].value === d) {
          conflict = true;
          break;
        }
      }

      // Clone shallowly at the row/cell granularity we touch to preserve
      // immutability semantics for React consumers.
      const newCells = board.cells.map((row) => row.slice());
      const targetRow = newCells[selection.row];
      targetRow[selection.col] = {
        value: d,
        notes: new Set<Digit>(),
        given: cell.given,
      };

      // Auto-remove d from peer pencil marks.
      for (const p of peers(board.variant, selection)) {
        const peerCell = newCells[p.row][p.col];
        if (peerCell.notes.has(d)) {
          const newNotes = new Set(peerCell.notes);
          newNotes.delete(d);
          newCells[p.row] = newCells[p.row].slice();
          newCells[p.row][p.col] = { ...peerCell, notes: newNotes };
        }
      }

      set({
        board: { variant: board.variant, cells: newCells },
        mistakes: conflict ? get().mistakes + 1 : get().mistakes,
      });
    },

    toggleNote: (d) => {
      const { board, selection } = get();
      if (!selection) return;
      const cell = board.cells[selection.row][selection.col];
      if (cell.given) return;
      if (cell.value != null) return;

      const newNotes = new Set(cell.notes);
      if (newNotes.has(d)) {
        newNotes.delete(d);
      } else {
        newNotes.add(d);
      }

      const newCells = board.cells.map((row) => row.slice());
      newCells[selection.row][selection.col] = { ...cell, notes: newNotes };
      set({ board: { variant: board.variant, cells: newCells } });
    },

    erase: () => {
      const { board, selection } = get();
      if (!selection) return;
      const cell = board.cells[selection.row][selection.col];
      if (cell.given) return;

      const newCells = board.cells.map((row) => row.slice());
      newCells[selection.row][selection.col] = {
        value: null,
        notes: new Set<Digit>(),
        given: false,
      };
      set({ board: { variant: board.variant, cells: newCells } });
    },

    toggleNotesMode: () => {
      set({ notesMode: !get().notesMode });
    },

    pause: () => {
      const { timer } = get();
      if (timer.paused) return;
      const now = Date.now();
      const elapsed = timer.startTs == null ? 0 : now - timer.startTs;
      set({
        timer: {
          startTs: null,
          accumulatedMs: timer.accumulatedMs + elapsed,
          paused: true,
        },
      });
    },

    resume: () => {
      const { timer } = get();
      if (!timer.paused) return;
      set({
        timer: {
          startTs: Date.now(),
          accumulatedMs: timer.accumulatedMs,
          paused: false,
        },
      });
    },
  }));
}

export const gameStore = createGameStore();
