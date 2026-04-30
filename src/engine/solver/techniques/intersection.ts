import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export type IntersectionTechnique = 'pointing' | 'box-line-reduction';

export interface IntersectionElimination {
  cell: Position;
  digits: Digit[];
}

export interface IntersectionResult {
  technique: IntersectionTechnique;
  digit: Digit;
  /** The "source" house where the digit's candidates are confined. */
  sourceHouse: 'row' | 'col' | 'box';
  sourceHouseIndex: number;
  /** The "target" house where eliminations occur. */
  targetHouse: 'row' | 'col' | 'box';
  targetHouseIndex: number;
  /** Cells in the intersection that hold the digit as a candidate. */
  intersectionCells: Position[];
  eliminations: IntersectionElimination[];
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

interface HouseCells {
  house: 'row' | 'col' | 'box';
  houseIndex: number;
  cells: Position[];
}

function rowCells(size: number, r: number): Position[] {
  const out: Position[] = [];
  for (let c = 0; c < size; c++) out.push({ row: r, col: c });
  return out;
}

function colCells(size: number, c: number): Position[] {
  const out: Position[] = [];
  for (let r = 0; r < size; r++) out.push({ row: r, col: c });
  return out;
}

function* iterateBoxes(board: Board): Generator<HouseCells> {
  const { variant } = board;
  const size = variant.size;
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

function* iterateRows(board: Board): Generator<HouseCells> {
  const { variant } = board;
  for (let r = 0; r < variant.size; r++) {
    yield { house: 'row', houseIndex: r, cells: rowCells(variant.size, r) };
  }
}

function* iterateCols(board: Board): Generator<HouseCells> {
  const { variant } = board;
  for (let c = 0; c < variant.size; c++) {
    yield { house: 'col', houseIndex: c, cells: colCells(variant.size, c) };
  }
}

function boxIndexFor(board: Board, pos: Position): number {
  const { variant } = board;
  const boxesPerRow = variant.size / variant.boxWidth;
  const br = Math.floor(pos.row / variant.boxHeight);
  const bc = Math.floor(pos.col / variant.boxWidth);
  return br * boxesPerRow + bc;
}

function houseLabel(house: 'row' | 'col' | 'box', houseIndex: number): string {
  if (house === 'row') return `row ${houseIndex + 1}`;
  if (house === 'col') return `column ${houseIndex + 1}`;
  return `box ${houseIndex + 1}`;
}

function posKey(pos: Position): string {
  return `${pos.row},${pos.col}`;
}

/**
 * Pointing pair/triple: within a box, if all candidates for a digit are in a
 * single row (or column), that digit can be eliminated from the rest of that
 * row (or column) outside the box.
 */
export function findPointing(board: Board): IntersectionResult | null {
  const grid = buildCandidatesGrid(board);
  const { cells } = board;

  for (const box of iterateBoxes(board)) {
    // Digits already placed inside the box can't produce a pointing elimination.
    const presentInBox = new Set<Digit>();
    for (const pos of box.cells) {
      const v = cells[pos.row][pos.col].value;
      if (v != null) presentInBox.add(v);
    }

    for (const digit of board.variant.digits) {
      if (presentInBox.has(digit)) continue;

      // Collect all cells in the box whose candidates include digit.
      const candidateCells: Position[] = [];
      for (const pos of box.cells) {
        const cand = grid[pos.row][pos.col];
        if (cand != null && cand.has(digit)) candidateCells.push(pos);
      }
      if (candidateCells.length < 2) continue; // 0 = not possible, 1 = hidden single

      // Are they all in the same row?
      const firstRow = candidateCells[0].row;
      const sameRow = candidateCells.every((p) => p.row === firstRow);
      const firstCol = candidateCells[0].col;
      const sameCol = candidateCells.every((p) => p.col === firstCol);

      if (sameRow) {
        const boxKeys = new Set(box.cells.map(posKey));
        const eliminations: IntersectionElimination[] = [];
        for (let c = 0; c < board.variant.size; c++) {
          const target: Position = { row: firstRow, col: c };
          if (boxKeys.has(posKey(target))) continue;
          const cand = grid[target.row][target.col];
          if (cand == null) continue;
          if (cand.has(digit)) {
            eliminations.push({ cell: target, digits: [digit] });
          }
        }
        if (eliminations.length > 0) {
          return {
            technique: 'pointing',
            digit,
            sourceHouse: 'box',
            sourceHouseIndex: box.houseIndex,
            targetHouse: 'row',
            targetHouseIndex: firstRow,
            intersectionCells: candidateCells,
            eliminations,
            explanation: `When ${digit} can only go in ${houseLabel('row', firstRow)} within ${houseLabel('box', box.houseIndex)}, you can remove ${digit} from the rest of ${houseLabel('row', firstRow)}.`,
          };
        }
      }

      if (sameCol) {
        const boxKeys = new Set(box.cells.map(posKey));
        const eliminations: IntersectionElimination[] = [];
        for (let r = 0; r < board.variant.size; r++) {
          const target: Position = { row: r, col: firstCol };
          if (boxKeys.has(posKey(target))) continue;
          const cand = grid[target.row][target.col];
          if (cand == null) continue;
          if (cand.has(digit)) {
            eliminations.push({ cell: target, digits: [digit] });
          }
        }
        if (eliminations.length > 0) {
          return {
            technique: 'pointing',
            digit,
            sourceHouse: 'box',
            sourceHouseIndex: box.houseIndex,
            targetHouse: 'col',
            targetHouseIndex: firstCol,
            intersectionCells: candidateCells,
            eliminations,
            explanation: `When ${digit} can only go in ${houseLabel('col', firstCol)} within ${houseLabel('box', box.houseIndex)}, you can remove ${digit} from the rest of ${houseLabel('col', firstCol)}.`,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Box-line reduction (claiming): within a row or column, if all candidates
 * for a digit are in a single box, eliminate that digit from the other cells
 * in that box.
 */
export function findBoxLineReduction(board: Board): IntersectionResult | null {
  const grid = buildCandidatesGrid(board);
  const { cells, variant } = board;

  const lineIterators: Array<{
    iter: Generator<HouseCells>;
    kind: 'row' | 'col';
  }> = [
    { iter: iterateRows(board), kind: 'row' },
    { iter: iterateCols(board), kind: 'col' },
  ];

  for (const { iter } of lineIterators) {
    for (const line of iter) {
      const presentInLine = new Set<Digit>();
      for (const pos of line.cells) {
        const v = cells[pos.row][pos.col].value;
        if (v != null) presentInLine.add(v);
      }

      for (const digit of variant.digits) {
        if (presentInLine.has(digit)) continue;

        const candidateCells: Position[] = [];
        for (const pos of line.cells) {
          const cand = grid[pos.row][pos.col];
          if (cand != null && cand.has(digit)) candidateCells.push(pos);
        }
        if (candidateCells.length < 2) continue; // 0 = impossible, 1 = hidden single

        const firstBox = boxIndexFor(board, candidateCells[0]);
        const sameBox = candidateCells.every((p) => boxIndexFor(board, p) === firstBox);
        if (!sameBox) continue;

        // Build the set of cells belonging to that box.
        const boxesPerRow = variant.size / variant.boxWidth;
        const br = Math.floor(firstBox / boxesPerRow);
        const bc = firstBox % boxesPerRow;
        const startRow = br * variant.boxHeight;
        const startCol = bc * variant.boxWidth;
        const boxCellList: Position[] = [];
        for (let r = startRow; r < startRow + variant.boxHeight; r++) {
          for (let c = startCol; c < startCol + variant.boxWidth; c++) {
            boxCellList.push({ row: r, col: c });
          }
        }

        const lineKeys = new Set(line.cells.map(posKey));
        const eliminations: IntersectionElimination[] = [];
        for (const pos of boxCellList) {
          if (lineKeys.has(posKey(pos))) continue;
          const cand = grid[pos.row][pos.col];
          if (cand == null) continue;
          if (cand.has(digit)) {
            eliminations.push({ cell: pos, digits: [digit] });
          }
        }
        if (eliminations.length === 0) continue;

        return {
          technique: 'box-line-reduction',
          digit,
          sourceHouse: line.house,
          sourceHouseIndex: line.houseIndex,
          targetHouse: 'box',
          targetHouseIndex: firstBox,
          intersectionCells: candidateCells,
          eliminations,
          explanation: `When ${digit} can only go in ${houseLabel('box', firstBox)} within ${houseLabel(line.house, line.houseIndex)}, you can remove ${digit} from the rest of ${houseLabel('box', firstBox)}.`,
        };
      }
    }
  }

  return null;
}

/**
 * Find the first intersection-based elimination (pointing first, then
 * box-line reduction). Returns null if neither applies.
 */
export function findIntersection(board: Board): IntersectionResult | null {
  return findPointing(board) ?? findBoxLineReduction(board);
}
