import { beforeEach, describe, expect, it } from 'vitest';
import {
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  clearSavedGame,
  deserializeNotes,
  getSavedGame,
  hasSavedGame,
  listSavedGames,
  loadSaveFile,
  putSavedGame,
  serializeNotes,
  slotKey,
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
    const loaded = getSavedGame('classic', 'easy');

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

    const loaded = getSavedGame('classic', 'easy');
    expect(loaded!.mistakes).toBe(5);
    expect(loaded!.elapsedMs).toBe(99_000);

    const file = loadSaveFile();
    expect(Object.keys(file.saves)).toEqual(['classic:easy']);
  });

  it('putSavedGame for a different variant leaves the original in place', () => {
    putSavedGame(makeSavedGame({ variant: 'classic', mistakes: 3 }));
    putSavedGame(makeSavedGame({ variant: 'mini', mistakes: 7 }));

    const classic = getSavedGame('classic', 'easy');
    const mini = getSavedGame('mini', 'easy');

    expect(classic).not.toBeNull();
    expect(classic!.mistakes).toBe(3);
    expect(mini).not.toBeNull();
    expect(mini!.mistakes).toBe(7);
  });

  it('clearSavedGame removes only that slot', () => {
    putSavedGame(makeSavedGame({ variant: 'classic' }));
    putSavedGame(makeSavedGame({ variant: 'mini' }));
    putSavedGame(makeSavedGame({ variant: 'six' }));

    clearSavedGame('mini', 'easy');

    expect(getSavedGame('classic', 'easy')).not.toBeNull();
    expect(getSavedGame('mini', 'easy')).toBeNull();
    expect(getSavedGame('six', 'easy')).not.toBeNull();
  });

  it('hasSavedGame returns true/false appropriately', () => {
    expect(hasSavedGame('classic', 'easy')).toBe(false);
    putSavedGame(makeSavedGame({ variant: 'classic' }));
    expect(hasSavedGame('classic', 'easy')).toBe(true);
    expect(hasSavedGame('mini', 'easy')).toBe(false);

    clearSavedGame('classic', 'easy');
    expect(hasSavedGame('classic', 'easy')).toBe(false);
  });

  it('keeps two saves for the same variant at different difficulties side by side', () => {
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

    const easy = getSavedGame('classic', 'easy');
    const hard = getSavedGame('classic', 'hard');

    expect(easy).not.toBeNull();
    expect(hard).not.toBeNull();
    expect(easy!.difficulty).toBe('easy');
    expect(easy!.mistakes).toBe(1);
    expect(hard!.difficulty).toBe('hard');
    expect(hard!.mistakes).toBe(4);
    expect(easy).not.toEqual(hard);

    const file = loadSaveFile();
    expect(Object.keys(file.saves).sort()).toEqual([
      slotKey('classic', 'easy'),
      slotKey('classic', 'hard'),
    ]);
  });

  it('listSavedGames returns every slot ordered by savedAt descending', () => {
    const oldest = makeSavedGame({
      variant: 'mini',
      difficulty: 'easy',
      savedAt: 1_700_000_000_000,
    });
    const middle = makeSavedGame({
      variant: 'classic',
      difficulty: 'hard',
      savedAt: 1_700_000_500_000,
    });
    const newest = makeSavedGame({
      variant: 'six',
      difficulty: 'medium',
      savedAt: 1_700_001_000_000,
    });

    putSavedGame(oldest);
    putSavedGame(middle);
    putSavedGame(newest);

    const all = listSavedGames();
    expect(all).toHaveLength(3);
    expect(all.map((s) => s.savedAt)).toEqual([
      newest.savedAt,
      middle.savedAt,
      oldest.savedAt,
    ]);
    expect(all[0].variant).toBe('six');
    expect(all[1].variant).toBe('classic');
    expect(all[2].variant).toBe('mini');
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
    expect(getSavedGame('classic', 'easy')).toBeNull();
  });

  it('uses the v3 storage key and bumped schema version', () => {
    expect(SAVE_STORAGE_KEY).toBe('sudoku.save.v3');
    expect(SAVE_SCHEMA_VERSION).toBe(3);
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
    expect(getSavedGame('classic', 'easy')).toBeNull();
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
    expect(getSavedGame('classic', 'easy')).toBeNull();
  });

  it('serializeNotes returns a sorted ascending array', () => {
    const notes = new Set<number>([9, 1, 5, 3]);
    expect(serializeNotes(notes)).toEqual([1, 3, 5, 9]);
  });
});
