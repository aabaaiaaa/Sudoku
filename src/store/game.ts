import { createStore } from 'zustand/vanilla';
import { peers } from '../engine/peers';
import type { Board, Cell, Digit, Position, Variant } from '../engine/types';
import { createEmptyBoard } from '../engine/types';
import { getVariant } from '../engine/variants';
import { generateForDifficulty } from '../engine/generator/generate-for-difficulty';
import type { Difficulty } from '../engine/generator/rate';
import {
  clearSavedGame,
  deserializeNotes,
  getSavedGame,
  hasSavedGame as hasSavedGameStorage,
  putSavedGame,
  serializeNotes,
  type SavedGame,
} from './save';

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
  /**
   * The difficulty label used for the currently-loaded game. Stored so that
   * save-file snapshots can round-trip a game without the store needing to
   * consult any other source of truth.
   */
  difficulty: string;
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

  /** True iff a save exists in localStorage for the given variant. */
  hasSavedGame: (variant: string) => boolean;
  /**
   * Attempts to restore the game state for the given variant from the save
   * file. Resets selection and notesMode. Returns true on success, false
   * when no save is present.
   */
  resumeSavedGame: (variant: string) => boolean;
  /** Snapshots the current game state into the save file for its variant. */
  saveCurrent: () => void;
  /**
   * Clears the save for the current variant (called when a game is
   * successfully finished).
   */
  completeGame: () => void;
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

function initialState(variant: Variant, difficulty = 'easy'): GameState {
  return {
    board: createEmptyBoard(variant),
    selection: null,
    notesMode: false,
    mistakes: 0,
    timer: initialTimer(),
    difficulty,
  };
}

/**
 * Auto-start the timer on the first user interaction with a game. Only resumes
 * when the clock isn't already running, so manual pause/tab-hide behavior is
 * preserved (input is blocked while manually paused since the board is hidden).
 */
function autoStartTimer(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
): void {
  const { timer } = get();
  if (timer.startTs != null) return;
  set({
    timer: {
      startTs: Date.now(),
      accumulatedMs: timer.accumulatedMs,
      paused: false,
    },
  });
}

/**
 * Computes the total elapsed time for the timer at the moment of snapshot,
 * including any currently-running segment since `startTs`.
 */
function elapsedMsOf(timer: TimerState): number {
  if (timer.startTs == null) return timer.accumulatedMs;
  return timer.accumulatedMs + (Date.now() - timer.startTs);
}

/** Serializes the current board state to the on-disk SavedCell shape. */
function serializeBoardCells(board: Board): SavedGame['cells'] {
  return board.cells.map((row) =>
    row.map((cell) => ({
      value: cell.value,
      notes: serializeNotes(cell.notes),
      given: cell.given,
    })),
  );
}

/**
 * Rehydrates a board `cells` grid from a save. If the grid dimensions don't
 * match the variant (e.g. corrupted save), returns null.
 */
function deserializeBoardCells(variant: Variant, saved: SavedGame['cells']): Cell[][] | null {
  if (saved.length !== variant.size) return null;
  const cells: Cell[][] = [];
  for (let r = 0; r < variant.size; r++) {
    const row = saved[r];
    if (!row || row.length !== variant.size) return null;
    const outRow: Cell[] = [];
    for (let c = 0; c < variant.size; c++) {
      const sc = row[c];
      outRow.push({
        value: sc.value,
        notes: deserializeNotes(sc.notes),
        given: sc.given,
      });
    }
    cells.push(outRow);
  }
  return cells;
}

export function createGameStore(initialVariant: Variant | string = 'classic') {
  const variant = resolveVariant(initialVariant);

  return createStore<GameStore>((set, get) => ({
    ...initialState(variant),

    newGame: (variantInput, difficulty) => {
      const v = resolveVariant(variantInput);
      const diff = (difficulty ?? 'easy') as Difficulty;
      const next = initialState(v, diff);
      try {
        const { puzzle } = generateForDifficulty(v, diff);
        next.board = puzzle;
      } catch {
        // If generation fails (unknown difficulty, etc.), keep the empty board.
      }
      set(next);

      // Starting a new game for a variant OVERWRITES that variant's save.
      const snapshot: SavedGame = {
        variant: v.id,
        difficulty: next.difficulty,
        cells: serializeBoardCells(next.board),
        mistakes: next.mistakes,
        elapsedMs: elapsedMsOf(next.timer),
        savedAt: Date.now(),
      };
      putSavedGame(snapshot);
    },

    select: (pos) => {
      set({ selection: pos });
      autoStartTimer(get, set);
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
      autoStartTimer(get, set);
      get().saveCurrent();
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
      autoStartTimer(get, set);
      get().saveCurrent();
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
      autoStartTimer(get, set);
      get().saveCurrent();
    },

    toggleNotesMode: () => {
      set({ notesMode: !get().notesMode });
      autoStartTimer(get, set);
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

    hasSavedGame: (variantId) => hasSavedGameStorage(variantId),

    resumeSavedGame: (variantId) => {
      const saved = getSavedGame(variantId);
      if (!saved) return false;
      const v = getVariant(variantId);
      if (!v) return false;
      const cells = deserializeBoardCells(v, saved.cells);
      if (!cells) return false;

      set({
        board: { variant: v, cells },
        selection: null,
        notesMode: false,
        mistakes: saved.mistakes,
        timer: {
          startTs: null,
          accumulatedMs: saved.elapsedMs,
          paused: true,
        },
        difficulty: saved.difficulty,
      });
      return true;
    },

    saveCurrent: () => {
      const { board, mistakes, timer, difficulty } = get();
      const snapshot: SavedGame = {
        variant: board.variant.id,
        difficulty,
        cells: serializeBoardCells(board),
        mistakes,
        elapsedMs: elapsedMsOf(timer),
        savedAt: Date.now(),
      };
      putSavedGame(snapshot);
    },

    completeGame: () => {
      const { board } = get();
      clearSavedGame(board.variant.id);
    },
  }));
}

export const gameStore = createGameStore();
