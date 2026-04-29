import { createStore } from 'zustand/vanilla';
import { peers } from '../engine/peers';
import type { Board, Cell, Digit, Position, Variant } from '../engine/types';
import { createEmptyBoard } from '../engine/types';
import { getVariant } from '../engine/variants';
import type { Difficulty, RateResult } from '../engine/generator/rate';
import {
  generateInWorker,
  type GeneratorHandle,
} from '../workers/generator-client';
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
  /**
   * True when the last pause was triggered by the user (via the Pause button
   * or the pause overlay). Used by the visibility handler to decide whether
   * to auto-resume on tab focus — a user-paused game stays paused.
   */
  manuallyPaused: boolean;
}

/**
 * Structured failure surfaced when the generator worker exhausts its budget
 * (requirements §6.2, §7.3). Drives the fallback dialog that offers
 * Try-again / Try-easier-tier / Cancel actions.
 */
export interface GenerationFailure {
  /** The tier that was being generated when the failure occurred. */
  difficulty: Difficulty;
  /**
   * Rating of the closest puzzle produced (by tier-rank distance to target),
   * or `null` when no attempt completed before the budget was exhausted.
   */
  closestRating: RateResult | null;
  /** Number of generation attempts before giving up. */
  attempts: number;
  /** Wall-clock time elapsed when failure was reported. */
  elapsedMs: number;
  /**
   * Best-effort message from the most recent attempt that threw inside the
   * generator. Surfaced verbatim by the GenerationFailedDialog (requirements
   * §4.1, §10).
   */
  lastError?: string;
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
  /**
   * When non-null, the Board tints every cell containing this digit to help
   * the player scan for it. Toggled by tapping a filled cell.
   */
  highlightedDigit: Digit | null;
  /**
   * True while a generation request is in flight. The Game screen uses this
   * (debounced 200 ms, see requirements §7.1) to render the loading overlay.
   */
  loading: boolean;
  /**
   * Set when the worker reports `failed` or `error`. The Game screen renders
   * the §7.3 fallback dialog when this is non-null. Cleared on the next
   * successful `newGame` and on `cancelGeneration`.
   */
  generationFailure: GenerationFailure | null;
}

export interface GameActions {
  /**
   * Start a new game for the given variant + difficulty. Resets selection,
   * notesMode, mistakes and timer synchronously, flips `loading` on, then
   * spawns a generator worker (requirements §6.4). Resolves once the worker
   * reports a terminal result: on success the new puzzle is committed and a
   * save snapshot is written; on failure `generationFailure` is set for the
   * UI to render the fallback dialog. A concurrent `newGame` or
   * `cancelGeneration` call cancels the in-flight worker.
   */
  newGame: (variant: Variant | string, difficulty?: string) => Promise<void>;
  /**
   * Cancel the in-flight generation (if any) and clear `loading`. Used by
   * the §7.2 Cancel button on the loading overlay. Safe to call when no
   * generation is in flight.
   */
  cancelGeneration: () => void;
  select: (pos: Position | null) => void;
  placeDigit: (d: Digit) => void;
  toggleNote: (d: Digit) => void;
  erase: () => void;
  toggleNotesMode: () => void;
  pause: () => void;
  resume: () => void;
  /** Visibility-driven pause that preserves the user's manual-pause intent. */
  pauseFromVisibility: () => void;
  /** Visibility-driven resume — no-op when the user manually paused. */
  resumeFromVisibility: () => void;

  /** True iff a save exists in localStorage for the given (variant, difficulty) slot. */
  hasSavedGame: (variant: string, difficulty: string) => boolean;
  /**
   * Attempts to restore the game state for the given (variant, difficulty)
   * slot from the save file. Resets selection and notesMode. Returns true on
   * success, false when no save is present.
   */
  resumeSavedGame: (variant: string, difficulty: string) => boolean;
  /** Snapshots the current game state into the save file for its (variant, difficulty) slot. */
  saveCurrent: () => void;
  /**
   * Clears the save for the current (variant, difficulty) slot (called when
   * a game is successfully finished).
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
  return { startTs: null, accumulatedMs: 0, paused: true, manuallyPaused: false };
}

function initialState(variant: Variant, difficulty = 'easy'): GameState {
  return {
    board: createEmptyBoard(variant),
    selection: null,
    notesMode: false,
    mistakes: 0,
    timer: initialTimer(),
    difficulty,
    highlightedDigit: null,
    loading: false,
    generationFailure: null,
  };
}

/**
 * Abstraction over the worker-spawning function so tests can supply a stub
 * (requirements §6.3 — the wrapper is verified separately in
 * `generator-client.test.ts`). Production code uses {@link generateInWorker}
 * via {@link defaultGeneratorFactory}.
 */
export type GeneratorFactory = (
  variant: Variant,
  difficulty: Difficulty,
) => GeneratorHandle;

export interface CreateGameStoreOptions {
  /** Override the worker-spawning function. Defaults to `generateInWorker`. */
  generator?: GeneratorFactory;
}

const defaultGeneratorFactory: GeneratorFactory = (variant, difficulty) =>
  generateInWorker(variant, difficulty);

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
  // Don't auto-start a game the user has manually paused.
  if (timer.manuallyPaused) return;
  set({
    timer: {
      startTs: Date.now(),
      accumulatedMs: timer.accumulatedMs,
      paused: false,
      manuallyPaused: false,
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

export function createGameStore(
  initialVariant: Variant | string = 'classic',
  options: CreateGameStoreOptions = {},
) {
  const variant = resolveVariant(initialVariant);
  const generator = options.generator ?? defaultGeneratorFactory;

  // Closure-scoped reference to the in-flight worker handle. Kept off store
  // state so the (non-serializable) handle doesn't leak to React subscribers
  // and so cancellation/superseding can be detected by identity comparison.
  let activeHandle: GeneratorHandle | null = null;

  return createStore<GameStore>((set, get) => ({
    ...initialState(variant),

    newGame: async (variantInput, difficulty) => {
      // Cancel any currently in-flight generation so it can't race in and
      // overwrite the new game's state when its (now-stale) settle resolves.
      if (activeHandle) {
        activeHandle.cancel();
        activeHandle = null;
      }

      const v = resolveVariant(variantInput);
      const diff = (difficulty ?? 'easy') as Difficulty;
      const next = initialState(v, diff);
      next.loading = true;
      set(next);

      const handle = generator(v, diff);
      activeHandle = handle;

      const result = await handle.promise;

      // A newer newGame() or cancelGeneration() may have run while we awaited;
      // in that case the handle reference will have been replaced. Drop our
      // (stale) result so we don't clobber the now-current state.
      if (activeHandle !== handle) return;
      activeHandle = null;

      if (result.kind === 'cancelled') {
        // cancelGeneration() already cleared `loading`; nothing more to do.
        return;
      }

      if (result.kind === 'success') {
        const board = result.puzzle;
        set({ board, loading: false, generationFailure: null });

        // Starting a new game writes to the (variant, difficulty) slot,
        // overwriting only that slot's previous save (other slots are
        // untouched).
        const { mistakes, timer, difficulty: d } = get();
        const snapshot: SavedGame = {
          variant: board.variant.id,
          difficulty: d,
          cells: serializeBoardCells(board),
          mistakes,
          elapsedMs: elapsedMsOf(timer),
          savedAt: Date.now(),
        };
        putSavedGame(snapshot);
        return;
      }

      // failed | error — surface a structured failure for the §7.3 dialog.
      const failure: GenerationFailure =
        result.kind === 'failed'
          ? {
              difficulty: diff,
              closestRating: result.closestRating,
              attempts: result.attempts,
              elapsedMs: result.elapsedMs,
              lastError: result.lastError,
            }
          : {
              difficulty: diff,
              closestRating: null,
              attempts: 0,
              elapsedMs: 0,
              lastError: result.message,
            };
      set({ loading: false, generationFailure: failure });
    },

    cancelGeneration: () => {
      if (activeHandle) {
        activeHandle.cancel();
        activeHandle = null;
      }
      // Defensively clear `generationFailure` alongside `loading` in case a
      // worker `failed` message landed in the same tick as the cancel — the
      // user explicitly asked to abandon this generation, so any stale failure
      // dialog state must be cleared too.
      set({ loading: false, generationFailure: null });
    },

    select: (pos) => {
      // Tapping a filled cell toggles the digit-highlight tint. Tapping an
      // empty cell leaves any active highlight alone so the player can
      // navigate without losing their scan target.
      const { board, highlightedDigit } = get();
      let nextHighlight = highlightedDigit;
      if (pos) {
        const cell = board.cells[pos.row][pos.col];
        if (cell.value != null) {
          nextHighlight = cell.value === highlightedDigit ? null : cell.value;
        }
      }
      set({ selection: pos, highlightedDigit: nextHighlight });
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
      if (timer.paused) {
        // Mid-transition: still mark as user-initiated for the ref to pick up.
        if (!timer.manuallyPaused) {
          set({ timer: { ...timer, manuallyPaused: true } });
        }
        return;
      }
      const now = Date.now();
      const elapsed = timer.startTs == null ? 0 : now - timer.startTs;
      set({
        timer: {
          startTs: null,
          accumulatedMs: timer.accumulatedMs + elapsed,
          paused: true,
          manuallyPaused: true,
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
          manuallyPaused: false,
        },
      });
    },

    pauseFromVisibility: () => {
      const { timer } = get();
      if (timer.paused) return;
      const now = Date.now();
      const elapsed = timer.startTs == null ? 0 : now - timer.startTs;
      set({
        timer: {
          startTs: null,
          accumulatedMs: timer.accumulatedMs + elapsed,
          paused: true,
          manuallyPaused: timer.manuallyPaused,
        },
      });
    },

    resumeFromVisibility: () => {
      const { timer } = get();
      if (!timer.paused) return;
      if (timer.manuallyPaused) return;
      set({
        timer: {
          startTs: Date.now(),
          accumulatedMs: timer.accumulatedMs,
          paused: false,
          manuallyPaused: false,
        },
      });
    },

    hasSavedGame: (variantId, difficulty) => hasSavedGameStorage(variantId, difficulty),

    resumeSavedGame: (variantId, difficulty) => {
      const saved = getSavedGame(variantId, difficulty);
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
          manuallyPaused: false,
        },
        difficulty: saved.difficulty,
        highlightedDigit: null,
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
      const { board, difficulty } = get();
      clearSavedGame(board.variant.id, difficulty);
    },
  }));
}

export const gameStore = createGameStore();
