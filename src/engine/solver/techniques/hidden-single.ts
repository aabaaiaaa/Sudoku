import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export interface HiddenSingleResult {
  technique: 'hidden-single';
  cell: Position;
  digit: Digit;
  house: 'row' | 'col' | 'box';
  houseIndex: number;
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

export function findHiddenSingle(board: Board): HiddenSingleResult | null {
  const { variant, cells } = board;

  // Precompute candidates for every empty cell to avoid redundant work.
  const candidatesGrid: (Set<Digit> | null)[][] = [];
  for (let r = 0; r < variant.size; r++) {
    const row: (Set<Digit> | null)[] = [];
    for (let c = 0; c < variant.size; c++) {
      if (cells[r][c].value != null) {
        row.push(null);
      } else {
        row.push(computeCandidates(board, { row: r, col: c }));
      }
    }
    candidatesGrid.push(row);
  }

  for (const house of iterateHouses(board)) {
    // Collect digits already present in the house.
    const present = new Set<Digit>();
    for (const pos of house.cells) {
      const v = cells[pos.row][pos.col].value;
      if (v != null) present.add(v);
    }

    for (const digit of variant.digits) {
      if (present.has(digit)) continue;
      let foundCell: Position | null = null;
      let count = 0;
      for (const pos of house.cells) {
        const candSet = candidatesGrid[pos.row][pos.col];
        if (candSet == null) continue;
        if (candSet.has(digit)) {
          count++;
          if (count === 1) {
            foundCell = pos;
          } else {
            break;
          }
        }
      }
      if (count === 1 && foundCell != null) {
        return {
          technique: 'hidden-single',
          cell: foundCell,
          digit,
          house: house.house,
          houseIndex: house.houseIndex,
          explanation: `R${foundCell.row + 1}C${foundCell.col + 1} is the only cell in ${houseLabel(house.house, house.houseIndex)} that can be ${digit}`,
        };
      }
    }
  }

  return null;
}
