import { beforeEach, describe, expect, it } from 'vitest';
import {
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  clearSavedGame,
  deserializeNotes,
  getSavedGame,
  hasSavedGame,
  loadSaveFile,
  putSavedGame,
  serializeNotes,
  type SavedGame,
} from './save';

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

describe('save store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a saved game and reconstructs notes as a Set', () => {
    const game = makeSavedGame({
      cells: [
        [
          { value: null, notes: [2, 4, 9], given: false },
          { value: 7, notes: [], given: true },
        ],
      ],
      mistakes: 2,
      elapsedMs: 45_000,
    });

    putSavedGame(game);
    const loaded = getSavedGame('classic');

    expect(loaded).not.toBeNull();
    expect(loaded!.variant).toBe('classic');
    expect(loaded!.mistakes).toBe(2);
    expect(loaded!.elapsedMs).toBe(45_000);
    expect(loaded!.cells[0][0].value).toBeNull();
    expect(loaded!.cells[0][0].notes).toEqual([2, 4, 9]);
    expect(loaded!.cells[0][1].value).toBe(7);
    expect(loaded!.cells[0][1].given).toBe(true);

    // The module exposes helpers to convert notes back to/from a Set.
    const notesSet = deserializeNotes(loaded!.cells[0][0].notes);
    expect(notesSet).toBeInstanceOf(Set);
    expect(notesSet.has(2)).toBe(true);
    expect(notesSet.has(4)).toBe(true);
    expect(notesSet.has(9)).toBe(true);
    expect(notesSet.has(1)).toBe(false);
  });

  it('putSavedGame for the same variant overwrites the previous save', () => {
    putSavedGame(makeSavedGame({ mistakes: 1, elapsedMs: 1000 }));
    putSavedGame(makeSavedGame({ mistakes: 5, elapsedMs: 99_000 }));

    const loaded = getSavedGame('classic');
    expect(loaded!.mistakes).toBe(5);
    expect(loaded!.elapsedMs).toBe(99_000);

    const file = loadSaveFile();
    expect(Object.keys(file.saves)).toEqual(['classic']);
  });

  it('putSavedGame for a different variant leaves the original in place', () => {
    putSavedGame(makeSavedGame({ variant: 'classic', mistakes: 3 }));
    putSavedGame(makeSavedGame({ variant: 'mini', mistakes: 7 }));

    const classic = getSavedGame('classic');
    const mini = getSavedGame('mini');

    expect(classic).not.toBeNull();
    expect(classic!.mistakes).toBe(3);
    expect(mini).not.toBeNull();
    expect(mini!.mistakes).toBe(7);
  });

  it('clearSavedGame removes only that variant\'s save', () => {
    putSavedGame(makeSavedGame({ variant: 'classic' }));
    putSavedGame(makeSavedGame({ variant: 'mini' }));
    putSavedGame(makeSavedGame({ variant: 'six' }));

    clearSavedGame('mini');

    expect(getSavedGame('classic')).not.toBeNull();
    expect(getSavedGame('mini')).toBeNull();
    expect(getSavedGame('six')).not.toBeNull();
  });

  it('hasSavedGame returns true/false appropriately', () => {
    expect(hasSavedGame('classic')).toBe(false);
    putSavedGame(makeSavedGame({ variant: 'classic' }));
    expect(hasSavedGame('classic')).toBe(true);
    expect(hasSavedGame('mini')).toBe(false);

    clearSavedGame('classic');
    expect(hasSavedGame('classic')).toBe(false);
  });

  it('returns an empty file on schema version mismatch', () => {
    window.localStorage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 99,
        saves: { classic: makeSavedGame({ variant: 'classic' }) },
      }),
    );

    const file = loadSaveFile();
    expect(file.version).toBe(SAVE_SCHEMA_VERSION);
    expect(file.saves).toEqual({});
    expect(getSavedGame('classic')).toBeNull();
  });

  it('uses the v2 storage key and bumped schema version', () => {
    expect(SAVE_STORAGE_KEY).toBe('sudoku.save.v2');
    expect(SAVE_SCHEMA_VERSION).toBe(2);
  });

  it('silently drops legacy v1 entries on load', () => {
    window.localStorage.setItem(
      'sudoku.save.v1',
      JSON.stringify({
        version: 1,
        saves: { classic: makeSavedGame({ variant: 'classic' }) },
      }),
    );

    const file = loadSaveFile();
    expect(file.saves).toEqual({});
    expect(getSavedGame('classic')).toBeNull();
  });

  it('stamps writes with the current appVersion', () => {
    putSavedGame(makeSavedGame({ variant: 'classic' }));

    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(SAVE_SCHEMA_VERSION);
    expect(typeof parsed.appVersion).toBe('string');
    expect(parsed.appVersion.length).toBeGreaterThan(0);
    expect(parsed.appVersion).toBe(__APP_VERSION__);

    const file = loadSaveFile();
    expect(file.appVersion).toBe(__APP_VERSION__);
  });

  it('returns an empty file on parse failure without throwing', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, 'this is {{ not json');

    expect(() => loadSaveFile()).not.toThrow();
    const file = loadSaveFile();
    expect(file.version).toBe(SAVE_SCHEMA_VERSION);
    expect(file.saves).toEqual({});
    expect(getSavedGame('classic')).toBeNull();
  });

  it('serializeNotes returns a sorted ascending array', () => {
    const notes = new Set<number>([9, 1, 5, 3]);
    expect(serializeNotes(notes)).toEqual([1, 3, 5, 9]);
  });
});
