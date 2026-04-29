import { describe, it } from 'vitest';
import { techniques } from './index';
import {
  createEmptyBoard,
  cloneBoard,
  type Board,
  type Digit,
  type Variant,
} from '../../types';
import { peers } from '../../peers';
import { serialize } from '../../board';
import { classicVariant, miniVariant, sixVariant } from '../../variants';

/**
 * Fuzz harness for technique finders.
 *
 * For every finder in the technique chain, this generates a small bounded set
 * of randomly-reduced boards across `classic`, `mini`, and `six` variants and
 * asserts the finder does not throw. The intent is bug surface, not solver
 * correctness — even illegal or unsolvable boards must yield `null`/empty
 * results, never an exception.
 *
 * Runs are deterministic: the seed for each (finder, variant) pair is derived
 * from a stable FNV-1a hash so any failure can be reproduced from the printed
 * context.
 *
 * Status (TASK-014a, 2026-04-29): fuzz suite is clean — all 34 finders pass
 * across all 3 variants × 50 random boards. TASK-014b/c are no-ops.
 */

// ---------- deterministic PRNG (mulberry32) ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- stable string -> 32-bit hash (FNV-1a) ----------
function fnv1a(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------- random board construction ----------

/**
 * Build a random board for the variant. Strategy:
 *  - Start from an empty board.
 *  - Fill ~30% of cells with random digits (best-effort: skip if illegal).
 *    The result need not be solvable; finders must still tolerate it.
 *  - For remaining empty cells, populate `notes` with a random subset of
 *    the locally-valid candidates so candidate-driven techniques have data
 *    to work on.
 */
function makeRandomBoard(variant: Variant, rng: () => number): Board {
  const board = createEmptyBoard(variant);
  const size = variant.size;
  const fillProbability = 0.3;

  // Pass 1: place values legally (skip cells that would conflict).
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (rng() >= fillProbability) continue;
      const used = new Set<Digit>();
      for (const p of peers(variant, { row: r, col: c })) {
        const v = board.cells[p.row][p.col].value;
        if (v != null) used.add(v);
      }
      const choices = variant.digits.filter((d) => !used.has(d));
      if (choices.length === 0) continue;
      const pick = choices[Math.floor(rng() * choices.length)];
      board.cells[r][c].value = pick;
    }
  }

  // Pass 2: notes for empty cells = random subset of locally-valid candidates.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = board.cells[r][c];
      if (cell.value != null) continue;
      const used = new Set<Digit>();
      for (const p of peers(variant, { row: r, col: c })) {
        const v = board.cells[p.row][p.col].value;
        if (v != null) used.add(v);
      }
      for (const d of variant.digits) {
        if (used.has(d)) continue;
        // Keep each candidate with ~70% probability so we get realistic but
        // sometimes-reduced candidate sets.
        if (rng() < 0.7) cell.notes.add(d);
      }
    }
  }

  return board;
}

// ---------- harness config ----------

const VARIANTS: Array<{ id: 'classic' | 'six' | 'mini'; variant: Variant }> = [
  { id: 'classic', variant: classicVariant },
  { id: 'six', variant: sixVariant },
  { id: 'mini', variant: miniVariant },
];

// 50 boards per (finder, variant). 34 finders * 3 variants * 50 = 5,100 calls.
// Most finders are O(size^k) where k is small; this stays well under budget.
const BOARDS_PER_VARIANT = 50;

describe('technique finders fuzz harness', () => {
  for (const technique of techniques) {
    for (const { id: variantId, variant } of VARIANTS) {
      it(
        `${technique.id} on ${variantId} does not throw across ${BOARDS_PER_VARIANT} random boards`,
        () => {
          const baseSeed = fnv1a(`${technique.id}:${variantId}`);
          for (let i = 0; i < BOARDS_PER_VARIANT; i++) {
            const seed = (baseSeed + i) >>> 0;
            const rng = mulberry32(seed);
            const board = makeRandomBoard(variant, rng);
            // Defensive copy: a finder must not see mutations from a previous
            // call leak in if it cached state, but more importantly we want
            // the printed serialization to reflect the exact input on throw.
            const input = cloneBoard(board);
            try {
              technique.find(input);
            } catch (err) {
              // Print full reproducer context, then re-throw so Vitest reports
              // the failure with the original stack.
              // eslint-disable-next-line no-console
              console.error(
                [
                  'fuzz harness: finder threw',
                  `  variant: ${variantId}`,
                  `  finder:  ${technique.id}`,
                  `  seed:    ${seed}`,
                  `  board:   ${serialize(board)}`,
                ].join('\n'),
              );
              throw err;
            }
          }
        },
        30000,
      );
    }
  }
});
