import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export interface JellyfishElimination {
  cell: Position;
  digits: Digit[];
}

export interface JellyfishResult {
  technique: 'jellyfish';
  digit: Digit;
  /**
   * 'rows' — the four base houses are rows; the digit's candidate cells in
   *   each base row are confined to the same set of four columns; eliminations
   *   occur in those four columns in all other rows.
   * 'cols' — mirror: base houses are four columns whose candidate cells for
   *   the digit are confined to the same four rows; eliminations occur in
   *   those rows in all other columns.
   */
  orientation: 'rows' | 'cols';
  /** The four base house indices (rows for 'rows', cols for 'cols'). */
  baseHouses: [number, number, number, number];
  /** The four cover (intersecting) house indices, sorted ascending. */
  coverHouses: [number, number, number, number];
  /**
   * The candidate cells in the base houses that belong to the jellyfish (each
   * base house contributes 2, 3, or 4 cells, all lying within the cover
   * houses).
   */
  cells: Position[];
  eliminations: JellyfishElimination[];
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
 * Detect a jellyfish pattern for any digit. A jellyfish exists when the
 * digit's candidate cells across four rows are confined to the same four
 * columns (row orientation) — equivalently, the union of those four rows'
 * candidate columns has size exactly four. Each base row may contribute two,
 * three, or four candidate cells. The digit can then be eliminated from those
 * four columns in every other row. The column orientation is the mirror.
 *
 * Returns the first pattern found with non-empty eliminations, preferring the
 * row orientation and lower digits.
 */
export function findJellyfish(board: Board): JellyfishResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);

  // Row orientation
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

    const baseRows: number[] = [];
    for (let r = 0; r < size; r++) {
      const n = rowCols[r].length;
      if (n >= 2 && n <= 4) baseRows.push(r);
    }

    for (let i = 0; i < baseRows.length; i++) {
      for (let j = i + 1; j < baseRows.length; j++) {
        for (let k = j + 1; k < baseRows.length; k++) {
          for (let l = k + 1; l < baseRows.length; l++) {
            const r1 = baseRows[i];
            const r2 = baseRows[j];
            const r3 = baseRows[k];
            const r4 = baseRows[l];
            const colSet = new Set<number>();
            for (const c of rowCols[r1]) colSet.add(c);
            for (const c of rowCols[r2]) colSet.add(c);
            for (const c of rowCols[r3]) colSet.add(c);
            for (const c of rowCols[r4]) colSet.add(c);
            if (colSet.size !== 4) continue;
            const cols = [...colSet].sort((a, b) => a - b);
            const [c1, c2, c3, c4] = cols;

            const eliminations: JellyfishElimination[] = [];
            for (let r = 0; r < size; r++) {
              if (r === r1 || r === r2 || r === r3 || r === r4) continue;
              for (const c of cols) {
                const cand = grid[r][c];
                if (cand == null) continue;
                if (cand.has(digit)) {
                  eliminations.push({ cell: { row: r, col: c }, digits: [digit] });
                }
              }
            }
            if (eliminations.length === 0) continue;

            const cells: Position[] = [];
            for (const r of [r1, r2, r3, r4]) {
              for (const c of cols) {
                const cand = grid[r][c];
                if (cand != null && cand.has(digit)) {
                  cells.push({ row: r, col: c });
                }
              }
            }

            return {
              technique: 'jellyfish',
              digit,
              orientation: 'rows',
              baseHouses: [r1, r2, r3, r4],
              coverHouses: [c1, c2, c3, c4],
              cells,
              eliminations,
              explanation: `Digit ${digit} forms a jellyfish on rows ${r1 + 1}, ${r2 + 1}, ${r3 + 1}, ${r4 + 1}, confined to columns ${c1 + 1}, ${c2 + 1}, ${c3 + 1}, ${c4 + 1}; eliminate ${digit} from those columns in other rows`,
            };
          }
        }
      }
    }
  }

  // Column orientation (mirror of row orientation)
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

    const baseCols: number[] = [];
    for (let c = 0; c < size; c++) {
      const n = colRows[c].length;
      if (n >= 2 && n <= 4) baseCols.push(c);
    }

    for (let i = 0; i < baseCols.length; i++) {
      for (let j = i + 1; j < baseCols.length; j++) {
        for (let k = j + 1; k < baseCols.length; k++) {
          for (let l = k + 1; l < baseCols.length; l++) {
            const c1 = baseCols[i];
            const c2 = baseCols[j];
            const c3 = baseCols[k];
            const c4 = baseCols[l];
            const rowSet = new Set<number>();
            for (const r of colRows[c1]) rowSet.add(r);
            for (const r of colRows[c2]) rowSet.add(r);
            for (const r of colRows[c3]) rowSet.add(r);
            for (const r of colRows[c4]) rowSet.add(r);
            if (rowSet.size !== 4) continue;
            const rows = [...rowSet].sort((a, b) => a - b);
            const [r1, r2, r3, r4] = rows;

            const eliminations: JellyfishElimination[] = [];
            for (let c = 0; c < size; c++) {
              if (c === c1 || c === c2 || c === c3 || c === c4) continue;
              for (const r of rows) {
                const cand = grid[r][c];
                if (cand == null) continue;
                if (cand.has(digit)) {
                  eliminations.push({ cell: { row: r, col: c }, digits: [digit] });
                }
              }
            }
            if (eliminations.length === 0) continue;

            const cells: Position[] = [];
            for (const c of [c1, c2, c3, c4]) {
              for (const r of rows) {
                const cand = grid[r][c];
                if (cand != null && cand.has(digit)) {
                  cells.push({ row: r, col: c });
                }
              }
            }

            return {
              technique: 'jellyfish',
              digit,
              orientation: 'cols',
              baseHouses: [c1, c2, c3, c4],
              coverHouses: [r1, r2, r3, r4],
              cells,
              eliminations,
              explanation: `Digit ${digit} forms a jellyfish on columns ${c1 + 1}, ${c2 + 1}, ${c3 + 1}, ${c4 + 1}, confined to rows ${r1 + 1}, ${r2 + 1}, ${r3 + 1}, ${r4 + 1}; eliminate ${digit} from those rows in other columns`,
            };
          }
        }
      }
    }
  }

  return null;
}
