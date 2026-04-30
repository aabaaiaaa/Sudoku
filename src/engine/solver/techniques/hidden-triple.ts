import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export interface HiddenTripleElimination {
  cell: Position;
  digits: Digit[];
}

export interface HiddenTripleResult {
  technique: 'hidden-triple';
  house: 'row' | 'col' | 'box';
  houseIndex: number;
  cells: Position[];
  digits: Digit[];
  eliminations: HiddenTripleElimination[];
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
  for (let r = 0; r < size; r++) {
    const cells: Position[] = [];
    for (let c = 0; c < size; c++) cells.push({ row: r, col: c });
    yield { house: 'row', houseIndex: r, cells };
  }
  for (let c = 0; c < size; c++) {
    const cells: Position[] = [];
    for (let r = 0; r < size; r++) cells.push({ row: r, col: c });
    yield { house: 'col', houseIndex: c, cells };
  }
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


function sortDigits(digits: Iterable<Digit>): Digit[] {
  return [...digits].sort((a, b) => a - b);
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

function* combinations<T>(
  items: T[],
  k: number,
  start = 0,
  picked: T[] = [],
): Generator<T[]> {
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

/**
 * Hidden Triple: in a house, three digits whose only candidate cells in the
 * house are the same three cells. Those three cells must collectively contain
 * those three digits, so all other candidates can be eliminated from those
 * three cells.
 *
 * Each digit must appear in 2 or 3 of the triple's cells; a digit confined to
 * a single cell would already be a Hidden Single and is excluded so this
 * finder doesn't double-count it.
 */
export function findHiddenTriple(board: Board): HiddenTripleResult | null {
  const { variant, cells } = board;
  const grid = buildCandidatesGrid(board);

  for (const house of iterateHouses(board)) {
    const present = new Set<Digit>();
    for (const pos of house.cells) {
      const v = cells[pos.row][pos.col].value;
      if (v != null) present.add(v);
    }

    const digitCells = new Map<Digit, Position[]>();
    for (const digit of variant.digits) {
      if (present.has(digit)) continue;
      const list: Position[] = [];
      for (const pos of house.cells) {
        const cand = grid[pos.row][pos.col];
        if (cand != null && cand.has(digit)) list.push(pos);
      }
      if (list.length >= 2 && list.length <= 3) {
        digitCells.set(digit, list);
      }
    }

    const candidateDigits = sortDigits(digitCells.keys());
    if (candidateDigits.length < 3) continue;

    for (const combo of combinations(candidateDigits, 3)) {
      const unionMap = new Map<string, Position>();
      for (const d of combo) {
        for (const pos of digitCells.get(d)!) {
          unionMap.set(`${pos.row},${pos.col}`, pos);
        }
      }
      if (unionMap.size !== 3) continue;

      const tripleCells = [...unionMap.values()].sort((a, b) =>
        a.row !== b.row ? a.row - b.row : a.col - b.col,
      );
      const tripleDigits = new Set<Digit>(combo);

      const eliminations: HiddenTripleElimination[] = [];
      for (const pos of tripleCells) {
        const cand = grid[pos.row][pos.col]!;
        const removed: Digit[] = [];
        for (const d of cand) {
          if (!tripleDigits.has(d)) removed.push(d);
        }
        if (removed.length > 0) {
          eliminations.push({ cell: pos, digits: sortDigits(removed) });
        }
      }
      if (eliminations.length === 0) continue;

      const digitList = combo.join(', ');
      return {
        technique: 'hidden-triple',
        house: house.house,
        houseIndex: house.houseIndex,
        cells: tripleCells,
        digits: [...combo],
        eliminations,
        explanation: `When three cells in ${houseLabel(house.house, house.houseIndex)} are the only places for ${digitList}, those numbers must go there — so you can remove any other possible numbers from those three cells.`,
      };
    }
  }

  return null;
}
