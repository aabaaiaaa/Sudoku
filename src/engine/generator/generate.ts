import type { Board, Digit, Variant } from '../types';
import { createGivenCell, createEmptyCell } from '../types';
import { emptyBoard } from '../board';
import { countSolutions } from '../solver/backtracking';

export interface GenerateOptions {
  /** Optional random seed (32-bit int). When provided, generation is deterministic. */
  seed?: number;
  /**
   * Minimum clue count — generation will stop removing cells when the
   * remaining givens reach this floor. If not provided, a sensible default
   * per-variant is used.
   */
  minClues?: number;
  /**
   * Cap on how many removal attempts to try. Defaults to `size * size * 2`.
   * Once every cell has been tried once, further removals are stopped.
   */
  maxRemovalAttempts?: number;
}

export interface GeneratedPuzzle {
  /** The puzzle — a Board with `given: true` on clue cells, all others empty. */
  puzzle: Board;
  /** The full valid solution the puzzle was derived from. */
  solution: Board;
}

/**
 * A simple deterministic PRNG (mulberry32). Produces a function returning
 * values in [0, 1). Suitable for reproducible shuffling in tests.
 */
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

function makeRng(seed?: number): () => number {
  if (seed == null) return Math.random;
  return mulberry32(seed);
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

function boxIndex(variant: Variant, r: number, c: number): number {
  const boxRow = Math.floor(r / variant.boxHeight);
  const boxCol = Math.floor(c / variant.boxWidth);
  const boxesPerRow = variant.size / variant.boxWidth;
  return boxRow * boxesPerRow + boxCol;
}

/** Randomized backtracking fill to produce a full valid solution. */
function fillSolution(variant: Variant, rng: () => number): (Digit | null)[][] {
  const size = variant.size;
  const grid: (Digit | null)[][] = [];
  for (let r = 0; r < size; r++) {
    grid.push(new Array<Digit | null>(size).fill(null));
  }
  const rowMask = new Array<number>(size).fill(0);
  const colMask = new Array<number>(size).fill(0);
  const boxMask = new Array<number>(size).fill(0);

  function fillAt(r: number, c: number): boolean {
    if (r === size) return true;
    const nr = c + 1 === size ? r + 1 : r;
    const nc = c + 1 === size ? 0 : c + 1;
    const b = boxIndex(variant, r, c);
    const used = rowMask[r] | colMask[c] | boxMask[b];
    const order = shuffle([...variant.digits], rng);
    for (const d of order) {
      const bit = 1 << d;
      if ((used & bit) !== 0) continue;
      grid[r][c] = d;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;
      if (fillAt(nr, nc)) return true;
      grid[r][c] = null;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
    }
    return false;
  }

  const ok = fillAt(0, 0);
  if (!ok) {
    throw new Error(`Failed to generate full solution for variant ${variant.id}`);
  }
  return grid;
}

function defaultMinClues(variant: Variant): number {
  // Rough floors known to be feasible / target quickly. The generator stops
  // earlier if further removal breaks uniqueness anyway.
  switch (variant.id) {
    case 'classic':
      return 30;
    case 'six':
      return 12;
    case 'mini':
      return 6;
    default:
      return Math.ceil((variant.size * variant.size) / 3);
  }
}

/**
 * Build a puzzle Board from a full solution grid and a mask of which cells
 * are givens.
 */
function buildPuzzle(
  variant: Variant,
  solutionGrid: (Digit | null)[][],
  givenMask: boolean[][],
): Board {
  const board = emptyBoard(variant);
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      if (givenMask[r][c] && solutionGrid[r][c] != null) {
        board.cells[r][c] = createGivenCell(solutionGrid[r][c] as Digit);
      } else {
        board.cells[r][c] = createEmptyCell(false);
      }
    }
  }
  return board;
}

function buildSolutionBoard(
  variant: Variant,
  solutionGrid: (Digit | null)[][],
): Board {
  const board = emptyBoard(variant);
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      const d = solutionGrid[r][c];
      if (d == null) {
        throw new Error('Solution grid unexpectedly has a null cell');
      }
      board.cells[r][c] = createGivenCell(d);
    }
  }
  return board;
}

/**
 * Generate a puzzle for the given variant. Fills a random full solution,
 * then removes cells one at a time while uniqueness is preserved and a
 * clue-count floor has not been reached.
 */
export function generate(
  variant: Variant,
  options: GenerateOptions = {},
): GeneratedPuzzle {
  const rng = makeRng(options.seed);
  const size = variant.size;
  const total = size * size;
  const minClues = options.minClues ?? defaultMinClues(variant);
  const maxAttempts = options.maxRemovalAttempts ?? total * 2;

  const solutionGrid = fillSolution(variant, rng);

  // Start with every cell as a given.
  const givenMask: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    givenMask.push(new Array<boolean>(size).fill(true));
  }
  let clueCount = total;

  // Build cell order for removal attempts.
  const positions: { r: number; c: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) positions.push({ r, c });
  }
  const order = shuffle(positions, rng);

  let attempts = 0;
  for (const { r, c } of order) {
    if (attempts >= maxAttempts) break;
    if (clueCount <= minClues) break;
    attempts += 1;
    if (!givenMask[r][c]) continue;

    // Tentatively remove this cell.
    givenMask[r][c] = false;
    const trial = buildPuzzle(variant, solutionGrid, givenMask);
    const count = countSolutions(trial, 2);
    if (count === 1) {
      clueCount -= 1;
    } else {
      // Restore.
      givenMask[r][c] = true;
    }
  }

  const puzzle = buildPuzzle(variant, solutionGrid, givenMask);
  const solution = buildSolutionBoard(variant, solutionGrid);
  return { puzzle, solution };
}
