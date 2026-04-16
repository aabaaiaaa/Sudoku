import { describe, expect, it, vi } from 'vitest';
import { classicVariant } from '../engine/variants';
import { createGameStore } from './game';

describe('game store', () => {
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
    it('resets mistakes and timer', () => {
      const store = createGameStore(classicVariant);

      // Create a mistake.
      store.getState().select({ row: 0, col: 0 });
      store.getState().placeDigit(5);
      store.getState().select({ row: 0, col: 1 });
      store.getState().placeDigit(5);
      expect(store.getState().mistakes).toBe(1);

      // Run the timer a bit.
      store.getState().resume();

      store.getState().newGame(classicVariant);
      expect(store.getState().mistakes).toBe(0);
      expect(store.getState().timer.accumulatedMs).toBe(0);
      expect(store.getState().timer.startTs).toBeNull();
      expect(store.getState().timer.paused).toBe(true);
      expect(store.getState().selection).toBeNull();
    });

    it('accepts a variant id string', () => {
      const store = createGameStore(classicVariant);
      store.getState().newGame('mini');
      expect(store.getState().board.variant.id).toBe('mini');
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
