import type { Board, Digit, Variant } from '../types';
import { cloneBoard } from '../types';

type Grid = (Digit | null)[][];

interface WorkingState {
  variant: Variant;
  grid: Grid;
  given: boolean[][];
  // Bitmask of digits already used in row/col/box. Bit d represents digit d.
  rowMask: number[];
  colMask: number[];
  boxMask: number[];
}

function boxIndex(variant: Variant, r: number, c: number): number {
  const boxRow = Math.floor(r / variant.boxHeight);
  const boxCol = Math.floor(c / variant.boxWidth);
  const boxesPerRow = variant.size / variant.boxWidth;
  return boxRow * boxesPerRow + boxCol;
}

function buildState(board: Board): WorkingState | null {
  const { variant, cells } = board;
  const size = variant.size;
  const grid: Grid = [];
  const given: boolean[][] = [];
  const rowMask = new Array<number>(size).fill(0);
  const colMask = new Array<number>(size).fill(0);
  const boxMask = new Array<number>(size).fill(0);

  for (let r = 0; r < size; r++) {
    const gridRow: (Digit | null)[] = [];
    const givenRow: boolean[] = [];
    for (let c = 0; c < size; c++) {
      const cell = cells[r][c];
      gridRow.push(cell.value);
      givenRow.push(cell.given);
      if (cell.value != null) {
        const bit = 1 << cell.value;
        const b = boxIndex(variant, r, c);
        if (
          (rowMask[r] & bit) !== 0 ||
          (colMask[c] & bit) !== 0 ||
          (boxMask[b] & bit) !== 0
        ) {
          return null; // conflicting starting position
        }
        rowMask[r] |= bit;
        colMask[c] |= bit;
        boxMask[b] |= bit;
      }
    }
    grid.push(gridRow);
    given.push(givenRow);
  }

  return { variant, grid, given, rowMask, colMask, boxMask };
}

/**
 * Find the empty cell with the fewest legal candidates (MRV heuristic).
 * Returns null if the board is fully filled.
 */
function findBestCell(state: WorkingState): { row: number; col: number; candidates: Digit[] } | null {
  const { variant, grid, rowMask, colMask, boxMask } = state;
  const size = variant.size;
  let best: { row: number; col: number; candidates: Digit[] } | null = null;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] != null) continue;
      const b = boxIndex(variant, r, c);
      const used = rowMask[r] | colMask[c] | boxMask[b];
      const candidates: Digit[] = [];
      for (const d of variant.digits) {
        if ((used & (1 << d)) === 0) candidates.push(d);
      }
      if (candidates.length === 0) {
        return { row: r, col: c, candidates };
      }
      if (best == null || candidates.length < best.candidates.length) {
        best = { row: r, col: c, candidates };
        if (candidates.length === 1) return best;
      }
    }
  }
  return best;
}

function place(state: WorkingState, r: number, c: number, d: Digit): void {
  const bit = 1 << d;
  state.grid[r][c] = d;
  state.rowMask[r] |= bit;
  state.colMask[c] |= bit;
  state.boxMask[boxIndex(state.variant, r, c)] |= bit;
}

function unplace(state: WorkingState, r: number, c: number, d: Digit): void {
  const bit = 1 << d;
  state.grid[r][c] = null;
  state.rowMask[r] &= ~bit;
  state.colMask[c] &= ~bit;
  state.boxMask[boxIndex(state.variant, r, c)] &= ~bit;
}

function searchFirst(state: WorkingState): boolean {
  const pick = findBestCell(state);
  if (pick == null) return true; // all cells filled
  if (pick.candidates.length === 0) return false;
  const { row, col, candidates } = pick;
  for (const d of candidates) {
    place(state, row, col, d);
    if (searchFirst(state)) return true;
    unplace(state, row, col, d);
  }
  return false;
}

function searchCount(state: WorkingState, cap: number, countRef: { n: number }): void {
  if (countRef.n >= cap) return;
  const pick = findBestCell(state);
  if (pick == null) {
    countRef.n += 1;
    return;
  }
  if (pick.candidates.length === 0) return;
  const { row, col, candidates } = pick;
  for (const d of candidates) {
    place(state, row, col, d);
    searchCount(state, cap, countRef);
    unplace(state, row, col, d);
    if (countRef.n >= cap) return;
  }
}

/**
 * Solve the given board using backtracking with the MRV heuristic.
 * Returns a new solved board, or null if no solution exists.
 * The input board is not mutated.
 */
export function solve(board: Board): Board | null {
  const state = buildState(board);
  if (state == null) return null;
  if (!searchFirst(state)) return null;

  const result = cloneBoard(board);
  const size = result.variant.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      result.cells[r][c].value = state.grid[r][c];
    }
  }
  return result;
}

/**
 * Count solutions for the given board, stopping as soon as `cap` solutions are found.
 * Returns 0 for unsolvable, 1 for uniquely solvable, or exactly `cap` when
 * `cap` or more solutions exist. Does not mutate the input.
 */
export function countSolutions(board: Board, cap: number = 2): number {
  if (cap <= 0) return 0;
  const state = buildState(board);
  if (state == null) return 0;
  const countRef = { n: 0 };
  searchCount(state, cap, countRef);
  return countRef.n;
}
