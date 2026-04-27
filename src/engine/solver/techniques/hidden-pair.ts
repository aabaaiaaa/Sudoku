import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export interface HiddenPairElimination {
  cell: Position;
  digits: Digit[];
}

export interface HiddenPairResult {
  technique: 'hidden-pair';
  house: 'row' | 'col' | 'box';
  houseIndex: number;
  cells: Position[];
  digits: Digit[];
  eliminations: HiddenPairElimination[];
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

function cellLabel(pos: Position): string {
  return `R${pos.row + 1}C${pos.col + 1}`;
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

/**
 * Hidden Pair: in a house, two digits whose only candidate cells are the same
 * two cells. The two cells must therefore contain those two digits between
 * them, so all other candidates can be eliminated from those two cells.
 */
export function findHiddenPair(board: Board): HiddenPairResult | null {
  const { variant, cells } = board;
  const grid = buildCandidatesGrid(board);

  for (const house of iterateHouses(board)) {
    const present = new Set<Digit>();
    for (const pos of house.cells) {
      const v = cells[pos.row][pos.col].value;
      if (v != null) present.add(v);
    }

    // For each unplaced digit in the house, list the cells that still have it
    // as a candidate. Skip digits whose cell-set isn't size exactly 2 — they
    // can't form a hidden pair on their own.
    const digitCells = new Map<Digit, Position[]>();
    for (const digit of variant.digits) {
      if (present.has(digit)) continue;
      const list: Position[] = [];
      for (const pos of house.cells) {
        const cand = grid[pos.row][pos.col];
        if (cand != null && cand.has(digit)) list.push(pos);
      }
      if (list.length === 2) digitCells.set(digit, list);
    }

    const candidateDigits = sortDigits(digitCells.keys());
    for (let i = 0; i < candidateDigits.length; i++) {
      for (let j = i + 1; j < candidateDigits.length; j++) {
        const d1 = candidateDigits[i];
        const d2 = candidateDigits[j];
        const a = digitCells.get(d1)!;
        const b = digitCells.get(d2)!;
        if (a[0].row !== b[0].row || a[0].col !== b[0].col) continue;
        if (a[1].row !== b[1].row || a[1].col !== b[1].col) continue;

        const pairCells = a;
        const pairDigits = new Set<Digit>([d1, d2]);
        const eliminations: HiddenPairElimination[] = [];
        for (const pos of pairCells) {
          const cand = grid[pos.row][pos.col]!;
          const removed: Digit[] = [];
          for (const d of cand) {
            if (!pairDigits.has(d)) removed.push(d);
          }
          if (removed.length > 0) {
            eliminations.push({ cell: pos, digits: sortDigits(removed) });
          }
        }
        if (eliminations.length === 0) continue;

        const cellList = pairCells.map(cellLabel).join(', ');
        const digitList = `${d1},${d2}`;
        return {
          technique: 'hidden-pair',
          house: house.house,
          houseIndex: house.houseIndex,
          cells: pairCells,
          digits: [d1, d2],
          eliminations,
          explanation: `Cells ${cellList} in ${houseLabel(house.house, house.houseIndex)} are the only places for {${digitList}}, so other candidates can be eliminated`,
        };
      }
    }
  }

  return null;
}
