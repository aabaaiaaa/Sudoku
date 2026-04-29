// Save-game persistence for in-progress Sudoku games.
//
// Keeps in-progress saves in a single localStorage entry keyed by
// `sudoku.save.v3`. The stored payload is a JSON object with a schema
// `version` field, an `appVersion` stamp recording the build that wrote
// it, and a `saves` map keyed by slot — `${variantId}:${difficultySlug}`
// — so multiple in-progress games per variant (one per difficulty) can
// coexist. On version mismatch or parse failure, loads return an empty
// save file so callers can treat it as "no save present" — v1 and v2
// entries from previous releases are silently dropped.
//
// This module is intentionally independent of the game store and React — it
// only depends on the platform `Storage` API (which is provided by Vitest's
// jsdom environment for tests). Cell `notes` are stored as sorted number
// arrays on disk and reconstructed into `Set<Digit>` on load.

export const SAVE_STORAGE_KEY = 'sudoku.save.v3';
export const SAVE_SCHEMA_VERSION = 3;

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
 * Returns the saved game for the given variant, or null if none exists.
 *
 * NOTE: this single-argument signature predates the slot-keyed schema and
 * is kept until TASK-021 extends the API surface. Until then, it returns
 * the first save it finds for the variant (regardless of difficulty).
 */
export function getSavedGame(variant: string, storage?: Storage): SavedGame | null {
  const file = loadSaveFile(storage);
  for (const save of Object.values(file.saves)) {
    if (save.variant === variant) return save;
  }
  return null;
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
 * Clears every save for the given variant. Other variants' saves are preserved.
 *
 * NOTE: this single-argument signature predates the slot-keyed schema and is
 * kept until TASK-021 extends the API surface.
 */
export function clearSavedGame(variant: string, storage?: Storage): void {
  const file = loadSaveFile(storage);
  const nextSaves: Record<string, SavedGame> = {};
  let changed = false;
  for (const [key, save] of Object.entries(file.saves)) {
    if (save.variant === variant) {
      changed = true;
      continue;
    }
    nextSaves[key] = save;
  }
  if (!changed) return;
  writeSaveFile(
    { version: SAVE_SCHEMA_VERSION, appVersion: __APP_VERSION__, saves: nextSaves },
    storage,
  );
}

/** Returns true iff at least one saved game exists for the variant. */
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
