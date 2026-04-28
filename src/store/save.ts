// Save-game persistence for in-progress Sudoku games.
//
// Keeps exactly ONE in-progress save per variant in a single localStorage
// entry keyed by `sudoku.save.v2`. The stored payload is a JSON object with
// a schema `version` field, an `appVersion` stamp recording the build that
// wrote it, and a `saves` map keyed by variant id. On version mismatch or
// parse failure, loads return an empty save file so callers can treat it as
// "no save present" — v1 entries from previous releases are silently dropped.
//
// This module is intentionally independent of the game store and React — it
// only depends on the platform `Storage` API (which is provided by Vitest's
// jsdom environment for tests). Cell `notes` are stored as sorted number
// arrays on disk and reconstructed into `Set<Digit>` on load.

export const SAVE_STORAGE_KEY = 'sudoku.save.v2';
export const SAVE_SCHEMA_VERSION = 2;

export interface SavedCell {
  value: number | null;
  notes: number[];
  given: boolean;
}

export interface SavedGame {
  variant: string;
  difficulty: string;
  cells: SavedCell[][];
  mistakes: number;
  elapsedMs: number;
  savedAt: number;
}

export interface SaveFile {
  version: number;
  appVersion: string;
  saves: Record<string, SavedGame>;
}

function emptySaveFile(): SaveFile {
  return { version: SAVE_SCHEMA_VERSION, appVersion: __APP_VERSION__, saves: {} };
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Reads and parses the save file from localStorage. Returns an empty file on
 * any of: missing entry, parse error, or schema version mismatch.
 */
export function loadSaveFile(storage?: Storage): SaveFile {
  const s = resolveStorage(storage);
  if (!s) return emptySaveFile();

  const raw = s.getItem(SAVE_STORAGE_KEY);
  if (raw == null) return emptySaveFile();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptySaveFile();
  }

  if (!parsed || typeof parsed !== 'object') return emptySaveFile();
  const obj = parsed as Partial<SaveFile>;
  if (obj.version !== SAVE_SCHEMA_VERSION) return emptySaveFile();
  if (!obj.saves || typeof obj.saves !== 'object') return emptySaveFile();

  return {
    version: SAVE_SCHEMA_VERSION,
    appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : __APP_VERSION__,
    saves: obj.saves,
  };
}

/**
 * Writes the save file to localStorage, stamping it with the current
 * `__APP_VERSION__` so future migrations can branch on which build wrote it.
 * No-op if storage is unavailable.
 */
export function writeSaveFile(file: SaveFile, storage?: Storage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  const stamped: SaveFile = { ...file, appVersion: __APP_VERSION__ };
  s.setItem(SAVE_STORAGE_KEY, JSON.stringify(stamped));
}

/**
 * Returns the saved game for the given variant, or null if none exists (or the
 * save file is missing / invalid).
 */
export function getSavedGame(variant: string, storage?: Storage): SavedGame | null {
  const file = loadSaveFile(storage);
  return file.saves[variant] ?? null;
}

/**
 * Writes a saved game for its variant, overwriting any existing save for that
 * variant. Leaves other variants' saves untouched.
 */
export function putSavedGame(game: SavedGame, storage?: Storage): void {
  const file = loadSaveFile(storage);
  const next: SaveFile = {
    version: SAVE_SCHEMA_VERSION,
    appVersion: __APP_VERSION__,
    saves: { ...file.saves, [game.variant]: game },
  };
  writeSaveFile(next, storage);
}

/** Clears the save for a single variant. Other variants' saves are preserved. */
export function clearSavedGame(variant: string, storage?: Storage): void {
  const file = loadSaveFile(storage);
  if (!(variant in file.saves)) return;
  const nextSaves: Record<string, SavedGame> = { ...file.saves };
  delete nextSaves[variant];
  writeSaveFile(
    { version: SAVE_SCHEMA_VERSION, appVersion: __APP_VERSION__, saves: nextSaves },
    storage,
  );
}

/** Returns true iff a saved game exists for the variant. */
export function hasSavedGame(variant: string, storage?: Storage): boolean {
  return getSavedGame(variant, storage) != null;
}

// -- Serialization helpers for converting between engine Cells and SavedCells.

/** Converts a Set of notes to a sorted number array for on-disk storage. */
export function serializeNotes(notes: Set<number>): number[] {
  return [...notes].sort((a, b) => a - b);
}

/** Reconstructs a notes Set from a stored array. */
export function deserializeNotes(notes: number[]): Set<number> {
  return new Set(notes);
}
