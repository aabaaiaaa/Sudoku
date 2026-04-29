// Save-game persistence for in-progress Sudoku games.
//
// Keeps in-progress saves in a single localStorage entry keyed by
// `sudoku.save.v4`. The stored payload is a JSON object with a schema
// `version` field, an `appVersion` stamp recording the build that wrote
// it, and a `saves` map keyed by slot — `${variantId}:${difficultySlug}`
// — so multiple in-progress games per variant (one per difficulty) can
// coexist. On version mismatch or parse failure, loads return an empty
// save file so callers can treat it as "no save present" — v1, v2, and
// v3 entries from previous releases are silently dropped.
//
// The v3 → v4 bump accompanies iteration-7's tier collapse: the
// difficulty ladder was rewritten (Diabolical/Demonic merged into
// Nightmare, Hard/Expert reshaped) and the slot keys derived from
// difficulty slugs are no longer guaranteed to round-trip from older
// payloads. Bumping the storage key forces v3 saves to fall through
// the migration prompt (see `migration.ts`) rather than silently
// resurfacing under stale slug keys.
//
// This module is intentionally independent of the game store and React — it
// only depends on the platform `Storage` API (which is provided by Vitest's
// jsdom environment for tests). Cell `notes` are stored as sorted number
// arrays on disk and reconstructed into `Set<Digit>` on load.

export const SAVE_STORAGE_KEY = 'sudoku.save.v4';
export const SAVE_SCHEMA_VERSION = 4;

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
  /** Map keyed by slot — `${variantId}:${difficultySlug}` — to support
   *  multiple in-progress games per variant. */
  saves: Record<string, SavedGame>;
}

/**
 * Returns the slot key used to index `SaveFile.saves`. The difficulty is
 * lower-cased to a stable slug ('Hard' -> 'hard') matching the convention
 * used elsewhere (stats store, difficulty badge, techniques screen).
 */
export function slotKey(variantId: string, difficulty: string): string {
  return `${variantId}:${difficulty.toLowerCase()}`;
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
 * any of: missing entry, parse error, or schema version mismatch (v1 and v2
 * payloads are silently discarded).
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
 * Returns the saved game in the `(variantId, difficulty)` slot, or null if
 * the slot is empty.
 */
export function getSavedGame(
  variantId: string,
  difficulty: string,
  storage?: Storage,
): SavedGame | null {
  const file = loadSaveFile(storage);
  return file.saves[slotKey(variantId, difficulty)] ?? null;
}

/**
 * Writes a saved game for its (variant, difficulty) slot, overwriting any
 * existing save in that slot. Other slots' saves are untouched.
 */
export function putSavedGame(game: SavedGame, storage?: Storage): void {
  const file = loadSaveFile(storage);
  const next: SaveFile = {
    version: SAVE_SCHEMA_VERSION,
    appVersion: __APP_VERSION__,
    saves: { ...file.saves, [slotKey(game.variant, game.difficulty)]: game },
  };
  writeSaveFile(next, storage);
}

/**
 * Removes the save in the `(variantId, difficulty)` slot. Other slots are
 * untouched. No-op when the slot is already empty.
 */
export function clearSavedGame(
  variantId: string,
  difficulty: string,
  storage?: Storage,
): void {
  const file = loadSaveFile(storage);
  const key = slotKey(variantId, difficulty);
  if (!(key in file.saves)) return;
  const nextSaves: Record<string, SavedGame> = { ...file.saves };
  delete nextSaves[key];
  writeSaveFile(
    { version: SAVE_SCHEMA_VERSION, appVersion: __APP_VERSION__, saves: nextSaves },
    storage,
  );
}

/** Returns true iff a save exists in the `(variantId, difficulty)` slot. */
export function hasSavedGame(
  variantId: string,
  difficulty: string,
  storage?: Storage,
): boolean {
  return getSavedGame(variantId, difficulty, storage) != null;
}

/**
 * Returns every saved game in the file, sorted by `savedAt` descending so the
 * most recent save appears first. Empty array when no saves are present.
 */
export function listSavedGames(storage?: Storage): SavedGame[] {
  const file = loadSaveFile(storage);
  return Object.values(file.saves).sort((a, b) => b.savedAt - a.savedAt);
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
