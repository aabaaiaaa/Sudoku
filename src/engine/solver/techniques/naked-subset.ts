import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export type NakedSubsetSize = 2 | 3;

export interface NakedSubsetElimination {
  cell: Position;
  digits: Digit[];
}

export interface NakedSubsetResult {
  technique: 'naked-pair' | 'naked-triple';
  size: NakedSubsetSize;
  house: 'row' | 'col' | 'box';
  houseIndex: number;
  cells: Position[];
  digits: Digit[];
  eliminations: NakedSubsetElimination[];
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

interface HouseCells {
  house: 'row' | 'col' | 'box';
  houseIndex: number;
  cells: Position[];
}

function* iterateHouses(board: Board): Generator<HouseCells> {
  const { variant } = board;
  const size = variant.size;
  // Rows
  for (let r = 0; r < size; r++) {
    const cells: Position[] = [];
    for (let c = 0; c < size; c++) cells.push({ row: r, col: c });
    yield { house: 'row', houseIndex: r, cells };
  }
  // Cols
  for (let c = 0; c < size; c++) {
    const cells: Position[] = [];
    for (let r = 0; r < size; r++) cells.push({ row: r, col: c });
    yield { house: 'col', houseIndex: c, cells };
  }
  // Boxes (row-major)
  const boxesPerRow = size / variant.boxWidth;
  const boxesPerCol = size / variant.boxHeight;
  for (let br = 0; br < boxesPerCol; br++) {
    for (let bc = 0; bc < boxesPerRow; bc++) {
      const houseIndex = br * boxesPerRow + bc;
      const cells: Position[] = [];
      const startRow = br * variant.boxHeight;
      const startCol = bc * variant.boxWidth;
      for (let r = startRow; r < startRow + variant.boxHeight; r++) {
        for (let c = startCol; c < startCol + variant.boxWidth; c++) {
          cells.push({ row: r, col: c });
        }
      }
      yield { house: 'box', houseIndex, cells };
    }
  }
}

function houseLabel(house: 'row' | 'col' | 'box', houseIndex: number): string {
  if (house === 'row') return `row ${houseIndex + 1}`;
  if (house === 'col') return `column ${houseIndex + 1}`;
  return `box ${houseIndex + 1}`;
}

function cellLabel(pos: Position): string {
  return `R${pos.row + 1}C${pos.col + 1}`;
}

function* combinations<T>(items: T[], k: number, start = 0, picked: T[] = []): Generator<T[]> {
  if (picked.length === k) {
    yield picked.slice();
    return;
  }
  for (let i = start; i <= items.length - (k - picked.length); i++) {
    picked.push(items[i]);
    yield* combinations(items, k, i + 1, picked);
    picked.pop();
  }
}

function sortDigits(digits: Iterable<Digit>): Digit[] {
  return [...digits].sort((a, b) => a - b);
}

function findNakedSubsetOfSize(
  board: Board,
  candidatesGrid: (Set<Digit> | null)[][],
  size: NakedSubsetSize,
): NakedSubsetResult | null {
  for (const house of iterateHouses(board)) {
    // Empty cells in the house with their candidate sets.
    const emptyCells: { pos: Position; candidates: Set<Digit> }[] = [];
    for (const pos of house.cells) {
      const cand = candidatesGrid[pos.row][pos.col];
      if (cand == null) continue;
      // Only consider cells with 2..size candidates (naked subsets require
      // each participating cell's candidates be a subset of the union of size).
      if (cand.size >= 2 && cand.size <= size) {
        emptyCells.push({ pos, candidates: cand });
      }
    }
    if (emptyCells.length < size) continue;

    for (const combo of combinations(emptyCells, size)) {
      const union = new Set<Digit>();
      for (const entry of combo) {
        for (const d of entry.candidates) union.add(d);
      }
      if (union.size !== size) continue;

      // Found a naked subset. Determine eliminations in the rest of the house.
      const comboKeys = new Set(combo.map((e) => `${e.pos.row},${e.pos.col}`));
      const eliminations: NakedSubsetElimination[] = [];
      for (const pos of house.cells) {
        const key = `${pos.row},${pos.col}`;
        if (comboKeys.has(key)) continue;
        const cand = candidatesGrid[pos.row][pos.col];
        if (cand == null) continue;
        const removed: Digit[] = [];
        for (const d of union) {
          if (cand.has(d)) removed.push(d);
        }
        if (removed.length > 0) {
          eliminations.push({ cell: pos, digits: sortDigits(removed) });
        }
      }
      if (eliminations.length === 0) continue;

      const digits = sortDigits(union);
      const cells = combo.map((e) => e.pos);
      const technique: NakedSubsetResult['technique'] = size === 2 ? 'naked-pair' : 'naked-triple';
      const cellList = cells.map(cellLabel).join(', ');
      const digitList = digits.join(',');
      return {
        technique,
        size,
        house: house.house,
        houseIndex: house.houseIndex,
        cells,
        digits,
        eliminations,
        explanation: `Cells ${cellList} in ${houseLabel(house.house, house.houseIndex)} form a naked ${size === 2 ? 'pair' : 'triple'} on {${digitList}}`,
      };
    }
  }
  return null;
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

export function findNakedPair(board: Board): NakedSubsetResult | null {
  const grid = buildCandidatesGrid(board);
  return findNakedSubsetOfSize(board, grid, 2);
}

export function findNakedTriple(board: Board): NakedSubsetResult | null {
  const grid = buildCandidatesGrid(board);
  return findNakedSubsetOfSize(board, grid, 3);
}

/**
 * Find the first naked subset (pair preferred, then triple) on the board.
 * Returns the technique result with eliminations, or null if none found.
 */
export function findNakedSubset(board: Board): NakedSubsetResult | null {
  const grid = buildCandidatesGrid(board);
  return (
    findNakedSubsetOfSize(board, grid, 2) ?? findNakedSubsetOfSize(board, grid, 3)
  );
}
