import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classicVariant } from '../engine/variants';
import { createEmptyBoard, type Board } from '../engine/types';
import { createGameStore, type GeneratorFactory } from './game';
import type { GenResult, GeneratorHandle } from '../workers/generator-client';
import {
  getSavedGame,
  hasSavedGame,
  loadSaveFile,
  putSavedGame,
  slotKey,
  type SavedGame,
} from './save';

/**
 * Generator stub that resolves immediately with the supplied result, never
 * spinning up a real Web Worker. Defaults to `failed` so the board stays
 * empty (matching the test fixtures' expectations) and resolution is
 * effectively synchronous.
 */
function stubGenerator(
  result: GenResult = {
    kind: 'failed',
    closestRating: null,
    attempts: 0,
    elapsedMs: 0,
  },
): GeneratorFactory {
  return () => {
    const handle: GeneratorHandle = {
      promise: Promise.resolve(result),
      cancel: () => {},
      onProgress: () => {},
    };
    return handle;
  };
}

/**
 * Generator stub that resolves with a `success` result built around an empty
 * board for the supplied variant, exercising the save-write path of `newGame`.
 */
function stubSuccessGenerator(): GeneratorFactory {
  return (variant) => {
    const board: Board = createEmptyBoard(variant);
    const result: GenResult = {
      kind: 'success',
      puzzle: board,
      solution: board,
      rating: {
        difficulty: 'Easy',
        hardestTechnique: null,
        techniquesUsed: [],
        solved: true,
        clueCount: 0,
      },
    };
    const handle: GeneratorHandle = {
      promise: Promise.resolve(result),
      cancel: () => {},
      onProgress: () => {},
    };
    return handle;
  };
}

function makeSavedGame(overrides: Partial<SavedGame> = {}): SavedGame {
  return {
    variant: 'classic',
    difficulty: 'easy',
    cells: [
      [
        { value: 5, notes: [], given: true },
        { value: null, notes: [1, 3, 7], given: false },
      ],
    ],
    mistakes: 0,
    elapsedMs: 0,
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('game store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('placeDigit', () => {
    it('auto-removes the placed digit from pencil marks of peer cells', () => {
      const store = createGameStore(classicVariant);

      // Put a note of 5 on a peer in the same row.
      store.getState().select({ row: 0, col: 1 });
      store.getState().toggleNote(5);
      expect(store.getState().board.cells[0][1].notes.has(5)).toBe(true);

      // Place 5 at (0, 0) - peers include (0, 1).
      store.getState().select({ row: 0, col: 0 });
      store.getState().placeDigit(5);

      expect(store.getState().board.cells[0][0].value).toBe(5);
      expect(store.getState().board.cells[0][1].notes.has(5)).toBe(false);
    });

    it('increments mistakes when placement conflicts with a peer and still places the value', () => {
      const store = createGameStore(classicVariant);

      // Put a 7 at (0, 0).
      store.getState().select({ row: 0, col: 0 });
      store.getState().placeDigit(7);
      expect(store.getState().mistakes).toBe(0);

      // Place 7 at (0, 5) — same row, so it conflicts.
      store.getState().select({ row: 0, col: 5 });
      store.getState().placeDigit(7);

      expect(store.getState().mistakes).toBe(1);
      expect(store.getState().board.cells[0][5].value).toBe(7);
    });

    it('is a no-op on a given cell', () => {
      const store = createGameStore(classicVariant);
      // Mark (2, 2) as a given with value 3 directly (no generator yet).
      const state = store.getState();
      state.board.cells[2][2].value = 3;
      state.board.cells[2][2].given = true;

      store.getState().select({ row: 2, col: 2 });
      store.getState().placeDigit(9);

      expect(store.getState().board.cells[2][2].value).toBe(3);
      expect(store.getState().board.cells[2][2].given).toBe(true);
    });
  });

  describe('toggleNote', () => {
    it('adds then removes a note', () => {
      const store = createGameStore(classicVariant);
      store.getState().select({ row: 4, col: 4 });

      store.getState().toggleNote(2);
      expect(store.getState().board.cells[4][4].notes.has(2)).toBe(true);

      store.getState().toggleNote(2);
      expect(store.getState().board.cells[4][4].notes.has(2)).toBe(false);
    });
  });

  describe('erase', () => {
    it('clears value and notes on a non-given cell', () => {
      const store = createGameStore(classicVariant);
      store.getState().select({ row: 1, col: 1 });
      store.getState().toggleNote(3);
      store.getState().placeDigit(4);
      // placeDigit clears notes but sets value.
      expect(store.getState().board.cells[1][1].value).toBe(4);

      store.getState().erase();
      expect(store.getState().board.cells[1][1].value).toBeNull();
      expect(store.getState().board.cells[1][1].notes.size).toBe(0);
    });

    it('will not clear a given cell', () => {
      const store = createGameStore(classicVariant);
      const state = store.getState();
      state.board.cells[0][0].value = 8;
      state.board.cells[0][0].given = true;

      store.getState().select({ row: 0, col: 0 });
      store.getState().erase();

      expect(store.getState().board.cells[0][0].value).toBe(8);
      expect(store.getState().board.cells[0][0].given).toBe(true);
    });
  });

  describe('newGame', () => {
    it('resets mistakes and timer', async () => {
      const store = createGameStore(classicVariant, { generator: stubGenerator() });

      // Create a mistake.
      store.getState().select({ row: 0, col: 0 });
      store.getState().placeDigit(5);
      store.getState().select({ row: 0, col: 1 });
      store.getState().placeDigit(5);
      expect(store.getState().mistakes).toBe(1);

      // Run the timer a bit.
      store.getState().resume();

      await store.getState().newGame(classicVariant, 'easy');
      expect(store.getState().mistakes).toBe(0);
      expect(store.getState().timer.accumulatedMs).toBe(0);
      expect(store.getState().timer.startTs).toBeNull();
      expect(store.getState().timer.paused).toBe(true);
      expect(store.getState().selection).toBeNull();
    });

    it('accepts a variant id string', async () => {
      const store = createGameStore(classicVariant, { generator: stubGenerator() });
      await store.getState().newGame('mini', 'easy');
      expect(store.getState().board.variant.id).toBe('mini');
    });

    it('writes a save snapshot to the (variant, difficulty) slot on success', async () => {
      const store = createGameStore(classicVariant, {
        generator: stubSuccessGenerator(),
      });

      await store.getState().newGame(classicVariant, 'medium');

      // The new game wrote into the (classic, medium) slot.
      expect(hasSavedGame('classic', 'medium')).toBe(true);
      const saved = getSavedGame('classic', 'medium');
      expect(saved).not.toBeNull();
      expect(saved!.variant).toBe('classic');
      expect(saved!.difficulty).toBe('medium');
    });

    it('starting a new game in one (variant, difficulty) slot leaves other slots untouched', async () => {
      // Two pre-existing saves for the same variant at different difficulties.
      const classicEasy = makeSavedGame({
        variant: 'classic',
        difficulty: 'easy',
        mistakes: 1,
        savedAt: 1_700_000_000_000,
      });
      const classicHard = makeSavedGame({
        variant: 'classic',
        difficulty: 'hard',
        mistakes: 4,
        savedAt: 1_700_000_500_000,
      });
      putSavedGame(classicEasy);
      putSavedGame(classicHard);

      // Start a brand-new game in a third slot for the same variant.
      const store = createGameStore(classicVariant, {
        generator: stubSuccessGenerator(),
      });
      await store.getState().newGame(classicVariant, 'medium');

      // All three slots should now coexist in the save file.
      const file = loadSaveFile();
      expect(Object.keys(file.saves).sort()).toEqual([
        slotKey('classic', 'easy'),
        slotKey('classic', 'hard'),
        slotKey('classic', 'medium'),
      ]);

      // The pre-existing saves are unchanged — same mistakes and savedAt.
      const easy = getSavedGame('classic', 'easy');
      const hard = getSavedGame('classic', 'hard');
      expect(easy).not.toBeNull();
      expect(easy!.mistakes).toBe(1);
      expect(easy!.savedAt).toBe(1_700_000_000_000);
      expect(hard).not.toBeNull();
      expect(hard!.mistakes).toBe(4);
      expect(hard!.savedAt).toBe(1_700_000_500_000);

      // The newly-created slot exists too.
      expect(getSavedGame('classic', 'medium')).not.toBeNull();
    });

    it('records a generationFailure when the worker reports kind: "failed"', async () => {
      const failedResult: GenResult = {
        kind: 'failed',
        closestRating: null,
        attempts: 5,
        elapsedMs: 1000,
        lastError: 'oops',
      };
      const store = createGameStore(classicVariant, {
        generator: stubGenerator(failedResult),
      });

      await store.getState().newGame(classicVariant, 'easy');

      expect(store.getState().loading).toBe(false);
      expect(store.getState().generationFailure).not.toBeNull();
      expect(store.getState().generationFailure!.lastError).toBe('oops');
      expect(store.getState().generationFailure!.difficulty).toBe('easy');
    });

    it('records a generationFailure when the worker reports kind: "error"', async () => {
      const errorResult: GenResult = {
        kind: 'error',
        message: 'oops',
      };
      const store = createGameStore(classicVariant, {
        generator: stubGenerator(errorResult),
      });

      await store.getState().newGame(classicVariant, 'easy');

      expect(store.getState().loading).toBe(false);
      expect(store.getState().generationFailure).not.toBeNull();
      expect(store.getState().generationFailure!.lastError).toBe('oops');
    });

    it('cancelGeneration terminates the in-flight worker and clears loading', () => {
      const cancelSpy = vi.fn();
      const factory: GeneratorFactory = () => ({
        // Never-resolving promise so the newGame coroutine stays parked.
        promise: new Promise<GenResult>(() => {}),
        cancel: cancelSpy,
        onProgress: () => {},
      });
      const store = createGameStore(classicVariant, { generator: factory });

      // Start generation without awaiting — it will hang on the never-resolving
      // promise, leaving the store in the loading state.
      void store.getState().newGame(classicVariant, 'easy');
      expect(store.getState().loading).toBe(true);

      store.getState().cancelGeneration();

      expect(store.getState().loading).toBe(false);
      expect(cancelSpy).toHaveBeenCalled();
    });
  });

  describe('resumeSavedGame', () => {
    it('restores the saved game for the given (variant, difficulty) slot', () => {
      const store = createGameStore(classicVariant, { generator: stubGenerator() });

      const saved = makeSavedGame({
        variant: 'classic',
        difficulty: 'hard',
        cells: createEmptyBoard(classicVariant).cells.map((row) =>
          row.map((cell) => ({
            value: cell.value,
            notes: [],
            given: cell.given,
          })),
        ),
        mistakes: 3,
        elapsedMs: 12_000,
      });
      putSavedGame(saved);

      const ok = store.getState().resumeSavedGame('classic', 'hard');
      expect(ok).toBe(true);
      expect(store.getState().mistakes).toBe(3);
      expect(store.getState().timer.accumulatedMs).toBe(12_000);
      expect(store.getState().difficulty).toBe('hard');
    });

    it('returns false when no save exists for the given slot', () => {
      const store = createGameStore(classicVariant, { generator: stubGenerator() });

      // A save in a *different* slot for the same variant must not satisfy the
      // resume call.
      putSavedGame(
        makeSavedGame({
          variant: 'classic',
          difficulty: 'easy',
          cells: createEmptyBoard(classicVariant).cells.map((row) =>
            row.map((cell) => ({
              value: cell.value,
              notes: [],
              given: cell.given,
            })),
          ),
        }),
      );

      const ok = store.getState().resumeSavedGame('classic', 'hard');
      expect(ok).toBe(false);
    });
  });

  describe('hasSavedGame', () => {
    it('returns true only for the slot that was written', () => {
      const store = createGameStore(classicVariant, { generator: stubGenerator() });

      putSavedGame(makeSavedGame({ variant: 'classic', difficulty: 'easy' }));

      expect(store.getState().hasSavedGame('classic', 'easy')).toBe(true);
      expect(store.getState().hasSavedGame('classic', 'hard')).toBe(false);
      expect(store.getState().hasSavedGame('mini', 'easy')).toBe(false);
    });
  });

  describe('saveCurrent', () => {
    it('writes a snapshot to the slot for the current (variant, difficulty)', async () => {
      const store = createGameStore(classicVariant, {
        generator: stubSuccessGenerator(),
      });
      await store.getState().newGame(classicVariant, 'medium');

      // Place a digit so the save snapshot has something distinctive.
      store.getState().select({ row: 0, col: 0 });
      store.getState().placeDigit(7);

      const saved = getSavedGame('classic', 'medium');
      expect(saved).not.toBeNull();
      expect(saved!.variant).toBe('classic');
      expect(saved!.difficulty).toBe('medium');
      expect(saved!.cells[0][0].value).toBe(7);
    });
  });

  describe('completeGame', () => {
    it('clears only the current (variant, difficulty) slot', async () => {
      // Pre-existing save in a different slot for the same variant.
      putSavedGame(
        makeSavedGame({ variant: 'classic', difficulty: 'easy', mistakes: 9 }),
      );

      const store = createGameStore(classicVariant, {
        generator: stubSuccessGenerator(),
      });
      await store.getState().newGame(classicVariant, 'hard');
      expect(getSavedGame('classic', 'hard')).not.toBeNull();

      store.getState().completeGame();

      // Only the (classic, hard) slot was cleared; the (classic, easy) slot
      // remains intact.
      expect(getSavedGame('classic', 'hard')).toBeNull();
      const easy = getSavedGame('classic', 'easy');
      expect(easy).not.toBeNull();
      expect(easy!.mistakes).toBe(9);
    });
  });

  describe('pause / resume', () => {
    it('accumulates elapsed time across cycles', () => {
      const store = createGameStore(classicVariant);
      const nowSpy = vi.spyOn(Date, 'now');

      nowSpy.mockReturnValue(1000);
      store.getState().resume();
      expect(store.getState().timer.paused).toBe(false);
      expect(store.getState().timer.startTs).toBe(1000);

      nowSpy.mockReturnValue(1500);
      store.getState().pause();
      expect(store.getState().timer.paused).toBe(true);
      expect(store.getState().timer.accumulatedMs).toBe(500);
      expect(store.getState().timer.startTs).toBeNull();

      nowSpy.mockReturnValue(2000);
      store.getState().resume();

      nowSpy.mockReturnValue(2300);
      store.getState().pause();
      expect(store.getState().timer.accumulatedMs).toBe(800);

      nowSpy.mockRestore();
    });
  });
});
