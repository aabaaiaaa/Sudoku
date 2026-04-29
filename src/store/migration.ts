/**
 * Detection and removal of legacy save/stats/settings keys from localStorage.
 *
 * The app has bumped its persistence schema multiple times. v1, v2, and v3
 * entries are no longer loadable but they continue to occupy localStorage
 * space. These helpers let the app detect legacy keys on first load (so it
 * can prompt the user) and remove them when the user confirms.
 *
 * Matching pattern: `sudoku.<save|stats|settings>.v<1|2|3>`. v4+ keys are
 * left untouched. v3 is now considered legacy because iteration 7's tier
 * rename (Diabolical/Demonic collapsed into Master, the old Hard/Master
 * bands removed) invalidates the persisted slot semantics — a v3 save or
 * stats entry keyed off `classic:diabolical` no longer maps to any
 * advertised tier in the v0.6.0 ladder.
 *
 * See requirements.md §5.5 for the higher-level UX flow.
 */

const OLD_SAVE_KEY_PATTERN = /^sudoku\.(save|stats|settings)\.v[123]$/;

/**
 * Resolve the storage to use. Returns the explicit `storage` argument when
 * provided; otherwise tries `globalThis.localStorage` (which covers both
 * browser and jsdom/happy-dom environments). Returns `null` when no storage
 * is available (e.g. Node without DOM globals).
 */
function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns true if any legacy `sudoku.(save|stats|settings).v[123]` key is
 * present in `storage`. Defaults to `globalThis.localStorage`. Returns false
 * when no storage is available.
 */
export function hasOldSaves(storage?: Storage): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  for (let i = 0; i < target.length; i += 1) {
    const key = target.key(i);
    if (key && OLD_SAVE_KEY_PATTERN.test(key)) {
      return true;
    }
  }
  return false;
}

/**
 * Removes every legacy `sudoku.(save|stats|settings).v[123]` key from
 * `storage`. Defaults to `globalThis.localStorage`. No-op when no storage is
 * available.
 *
 * Keys are collected up front before any deletion because `removeItem` shifts
 * subsequent indices, which would cause `key(i)` traversal to skip entries.
 */
export function removeOldSaves(storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target) return;

  const toRemove: string[] = [];
  for (let i = 0; i < target.length; i += 1) {
    const key = target.key(i);
    if (key && OLD_SAVE_KEY_PATTERN.test(key)) {
      toRemove.push(key);
    }
  }

  for (const key of toRemove) {
    target.removeItem(key);
  }
}
