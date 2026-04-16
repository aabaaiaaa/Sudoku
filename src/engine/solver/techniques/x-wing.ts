import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export interface XWingElimination {
  cell: Position;
  digits: Digit[];
}

export interface XWingResult {
  technique: 'x-wing';
  digit: Digit;
  /**
   * 'rows' — the two base houses are rows; the digit is confined to the same
   *   two columns within both rows; eliminations occur in those two columns in
   *   all other rows.
   * 'cols' — mirror: base houses are two columns with the digit confined to
   *   the same two rows; eliminations occur in those two rows in all other
   *   columns.
   */
  orientation: 'rows' | 'cols';
  /** The two base house indices (rows for 'rows' orientation, cols for 'cols'). */
  baseHouses: [number, number];
  /** The two cover (intersecting) house indices. */
  coverHouses: [number, number];
  /** The four corner cells in row-major order. */
  cells: Position[];
  eliminations: XWingElimination[];
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

/**
 * Detect an X-wing pattern for any digit. An X-wing exists when a digit is
 * confined to the same two columns in two different rows (row orientation) or
 * the same two rows in two different columns (column orientation). The four
 * corner cells form a rectangle; the digit can be eliminated from the cover
 * lines outside those corners.
 *
 * Returns the first pattern found with non-empty eliminations, preferring the
 * row orientation.
 */
export function findXWing(board: Board): XWingResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);

  // Row orientation: for each digit, for each row, collect the columns where
  // the digit is a candidate. Look for pairs of rows where this list is
  // exactly the same two columns.
  for (const digit of variant.digits) {
    const rowCols: number[][] = [];
    for (let r = 0; r < size; r++) {
      const cols: number[] = [];
      for (let c = 0; c < size; c++) {
        const cand = grid[r][c];
        if (cand != null && cand.has(digit)) cols.push(c);
      }
      rowCols.push(cols);
    }

    const rowsWithTwo: number[] = [];
    for (let r = 0; r < size; r++) {
      if (rowCols[r].length === 2) rowsWithTwo.push(r);
    }

    for (let i = 0; i < rowsWithTwo.length; i++) {
      for (let j = i + 1; j < rowsWithTwo.length; j++) {
        const r1 = rowsWithTwo[i];
        const r2 = rowsWithTwo[j];
        if (
          rowCols[r1][0] !== rowCols[r2][0] ||
          rowCols[r1][1] !== rowCols[r2][1]
        ) {
          continue;
        }
        const c1 = rowCols[r1][0];
        const c2 = rowCols[r1][1];

        const eliminations: XWingElimination[] = [];
        for (let r = 0; r < size; r++) {
          if (r === r1 || r === r2) continue;
          for (const c of [c1, c2]) {
            const cand = grid[r][c];
            if (cand == null) continue;
            if (cand.has(digit)) {
              eliminations.push({ cell: { row: r, col: c }, digits: [digit] });
            }
          }
        }
        if (eliminations.length === 0) continue;

        const cells: Position[] = [
          { row: r1, col: c1 },
          { row: r1, col: c2 },
          { row: r2, col: c1 },
          { row: r2, col: c2 },
        ];
        return {
          technique: 'x-wing',
          digit,
          orientation: 'rows',
          baseHouses: [r1, r2],
          coverHouses: [c1, c2],
          cells,
          eliminations,
          explanation: `Digit ${digit} forms an X-wing on rows ${r1 + 1} and ${r2 + 1}, confined to columns ${c1 + 1} and ${c2 + 1}; eliminate ${digit} from those columns in other rows`,
        };
      }
    }
  }

  // Column orientation: mirror of the row orientation.
  for (const digit of variant.digits) {
    const colRows: number[][] = [];
    for (let c = 0; c < size; c++) {
      const rows: number[] = [];
      for (let r = 0; r < size; r++) {
        const cand = grid[r][c];
        if (cand != null && cand.has(digit)) rows.push(r);
      }
      colRows.push(rows);
    }

    const colsWithTwo: number[] = [];
    for (let c = 0; c < size; c++) {
      if (colRows[c].length === 2) colsWithTwo.push(c);
    }

    for (let i = 0; i < colsWithTwo.length; i++) {
      for (let j = i + 1; j < colsWithTwo.length; j++) {
        const c1 = colsWithTwo[i];
        const c2 = colsWithTwo[j];
        if (
          colRows[c1][0] !== colRows[c2][0] ||
          colRows[c1][1] !== colRows[c2][1]
        ) {
          continue;
        }
        const r1 = colRows[c1][0];
        const r2 = colRows[c1][1];

        const eliminations: XWingElimination[] = [];
        for (let c = 0; c < size; c++) {
          if (c === c1 || c === c2) continue;
          for (const r of [r1, r2]) {
            const cand = grid[r][c];
            if (cand == null) continue;
            if (cand.has(digit)) {
              eliminations.push({ cell: { row: r, col: c }, digits: [digit] });
            }
          }
        }
        if (eliminations.length === 0) continue;

        const cells: Position[] = [
          { row: r1, col: c1 },
          { row: r1, col: c2 },
          { row: r2, col: c1 },
          { row: r2, col: c2 },
        ];
        return {
          technique: 'x-wing',
          digit,
          orientation: 'cols',
          baseHouses: [c1, c2],
          coverHouses: [r1, r2],
          cells,
          eliminations,
          explanation: `Digit ${digit} forms an X-wing on columns ${c1 + 1} and ${c2 + 1}, confined to rows ${r1 + 1} and ${r2 + 1}; eliminate ${digit} from those rows in other columns`,
        };
      }
    }
  }

  return null;
}
