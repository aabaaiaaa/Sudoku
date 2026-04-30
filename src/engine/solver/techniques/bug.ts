import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export type BugPlus1House = 'row' | 'col' | 'box';

export interface BugPlus1Result {
  technique: 'bug-plus-one';
  /** The "+1" cell — the only unsolved cell with three candidates. */
  cell: Position;
  /** Candidates at the +1 cell, sorted ascending. */
  candidates: Digit[];
  /** Digit forced into the +1 cell. */
  digit: Digit;
  /** Which house contains a candidate count of three for the forced digit. */
  forcedHouse: BugPlus1House;
  explanation: string;
}

function computeCandidates(board: Board, pos: Position): Set<Digit> {
  const { variant, cells } = board;
  const used = new Set<Digit>();
  for (const p of peers(variant, pos)) {
    const v = cells[p.row][p.col].value;
    if (v != null) used.add(v);
  }
  const candidates = new Set<Digit>();
  for (const d of variant.digits) {
    if (!used.has(d)) candidates.add(d);
  }
  return candidates;
}

function buildCandidatesGrid(board: Board): (Set<Digit> | null)[][] {
  const { variant, cells } = board;
  const grid: (Set<Digit> | null)[][] = [];
  for (let r = 0; r < variant.size; r++) {
    const row: (Set<Digit> | null)[] = [];
    for (let c = 0; c < variant.size; c++) {
      if (cells[r][c].value != null) {
        row.push(null);
      } else {
        row.push(computeCandidates(board, { row: r, col: c }));
      }
    }
    grid.push(row);
  }
  return grid;
}

function countDigitInRow(
  grid: (Set<Digit> | null)[][],
  digit: Digit,
  row: number,
  size: number,
): number {
  let count = 0;
  for (let c = 0; c < size; c++) {
    const cand = grid[row][c];
    if (cand != null && cand.has(digit)) count++;
  }
  return count;
}

function countDigitInCol(
  grid: (Set<Digit> | null)[][],
  digit: Digit,
  col: number,
  size: number,
): number {
  let count = 0;
  for (let r = 0; r < size; r++) {
    const cand = grid[r][col];
    if (cand != null && cand.has(digit)) count++;
  }
  return count;
}

function countDigitInBox(
  grid: (Set<Digit> | null)[][],
  variant: Variant,
  digit: Digit,
  pos: Position,
): number {
  const boxStartRow =
    Math.floor(pos.row / variant.boxHeight) * variant.boxHeight;
  const boxStartCol =
    Math.floor(pos.col / variant.boxWidth) * variant.boxWidth;
  let count = 0;
  for (let r = boxStartRow; r < boxStartRow + variant.boxHeight; r++) {
    for (let c = boxStartCol; c < boxStartCol + variant.boxWidth; c++) {
      const cand = grid[r][c];
      if (cand != null && cand.has(digit)) count++;
    }
  }
  return count;
}

/**
 * Bivalue Universal Grave +1.
 *
 * In a Bivalue Universal Grave (BUG), every unsolved cell has exactly two
 * candidates and every digit appears in exactly two candidate cells of every
 * house — a configuration that admits at least two solutions (swap the pair
 * across all bivalue cells). A uniquely-solvable puzzle therefore cannot be in
 * a BUG state.
 *
 * BUG+1 is a near-BUG state where every unsolved cell except one is bivalue
 * and the exception cell has exactly three candidates. The "+1" cell must
 * take the candidate that, in some house through it, would otherwise appear
 * three times — placing any other candidate would leave a true BUG (and thus
 * multiple solutions) behind.
 *
 * Detection:
 *   1. Confirm every unsolved cell has 2 or 3 candidates (no singles, no
 *      cells with 4+ candidates). Reject anything else.
 *   2. Confirm exactly one cell has 3 candidates (the "+1" cell).
 *   3. For each of the three candidates at the +1 cell, count its candidate
 *      occurrences in the +1 cell's row, column, and box. The digit that
 *      appears three times in at least one of those houses is the forced
 *      placement.
 *   4. If multiple distinct candidates qualify, the configuration is not a
 *      well-formed BUG+1 — return null.
 */
export function findBugPlus1(board: Board): BugPlus1Result | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);

  let plusOne: Position | null = null;
  let hasUnsolved = false;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cand = grid[r][c];
      if (cand == null) continue;
      hasUnsolved = true;
      const n = cand.size;
      if (n < 2) return null;
      if (n === 2) continue;
      if (n === 3) {
        if (plusOne != null) return null;
        plusOne = { row: r, col: c };
        continue;
      }
      return null;
    }
  }

  if (!hasUnsolved || plusOne == null) return null;

  const candSet = grid[plusOne.row][plusOne.col]!;
  const sortedCandidates = [...candSet].sort((a, b) => a - b);

  let forcedDigit: Digit | null = null;
  let forcedHouse: BugPlus1House | null = null;

  for (const d of sortedCandidates) {
    const rowCount = countDigitInRow(grid, d, plusOne.row, size);
    const colCount = countDigitInCol(grid, d, plusOne.col, size);
    const boxCount = countDigitInBox(grid, variant, d, plusOne);

    let house: BugPlus1House | null = null;
    if (rowCount === 3) house = 'row';
    else if (colCount === 3) house = 'col';
    else if (boxCount === 3) house = 'box';

    if (house == null) continue;
    if (forcedDigit != null && forcedDigit !== d) return null;
    if (forcedDigit == null) {
      forcedDigit = d;
      forcedHouse = house;
    }
  }

  if (forcedDigit == null || forcedHouse == null) return null;

  return {
    technique: 'bug-plus-one',
    cell: plusOne,
    candidates: sortedCandidates,
    digit: forcedDigit,
    forcedHouse,
    explanation: `Place ${forcedDigit} in the highlighted cell. Every other open cell has only two possibilities, so this cell has to take the only number that's left over.`,
  };
}
