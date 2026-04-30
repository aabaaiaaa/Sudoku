import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export interface SwordfishElimination {
  cell: Position;
  digits: Digit[];
}

export interface SwordfishResult {
  technique: 'swordfish';
  digit: Digit;
  /**
   * 'rows' — the three base houses are rows; the digit's candidate cells in
   *   each base row are confined to the same set of three columns; eliminations
   *   occur in those three columns in all other rows.
   * 'cols' — mirror: base houses are three columns whose candidate cells for
   *   the digit are confined to the same three rows; eliminations occur in
   *   those rows in all other columns.
   */
  orientation: 'rows' | 'cols';
  /** The three base house indices (rows for 'rows', cols for 'cols'). */
  baseHouses: [number, number, number];
  /** The three cover (intersecting) house indices, sorted ascending. */
  coverHouses: [number, number, number];
  /**
   * The candidate cells in the base houses that belong to the swordfish (each
   * base house contributes 2 or 3 cells, all lying within the cover houses).
   */
  cells: Position[];
  eliminations: SwordfishElimination[];
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
 * Detect a swordfish pattern for any digit. A swordfish exists when the
 * digit's candidate cells across three rows are confined to the same three
 * columns (row orientation) — equivalently, the union of those three rows'
 * candidate columns has size exactly three. Each base row may contribute two
 * or three candidate cells. The digit can then be eliminated from those three
 * columns in every other row. The column orientation is the mirror.
 *
 * Returns the first pattern found with non-empty eliminations, preferring the
 * row orientation and lower digits.
 */
export function findSwordfish(board: Board): SwordfishResult | null {
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
      if (n >= 2 && n <= 3) baseRows.push(r);
    }

    for (let i = 0; i < baseRows.length; i++) {
      for (let j = i + 1; j < baseRows.length; j++) {
        for (let k = j + 1; k < baseRows.length; k++) {
          const r1 = baseRows[i];
          const r2 = baseRows[j];
          const r3 = baseRows[k];
          const colSet = new Set<number>();
          for (const c of rowCols[r1]) colSet.add(c);
          for (const c of rowCols[r2]) colSet.add(c);
          for (const c of rowCols[r3]) colSet.add(c);
          if (colSet.size !== 3) continue;
          const cols = [...colSet].sort((a, b) => a - b);
          const [c1, c2, c3] = cols;

          const eliminations: SwordfishElimination[] = [];
          for (let r = 0; r < size; r++) {
            if (r === r1 || r === r2 || r === r3) continue;
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
          for (const r of [r1, r2, r3]) {
            for (const c of cols) {
              const cand = grid[r][c];
              if (cand != null && cand.has(digit)) {
                cells.push({ row: r, col: c });
              }
            }
          }

          return {
            technique: 'swordfish',
            digit,
            orientation: 'rows',
            baseHouses: [r1, r2, r3],
            coverHouses: [c1, c2, c3],
            cells,
            eliminations,
            explanation: `In rows ${r1 + 1}, ${r2 + 1}, and ${r3 + 1}, ${digit} only appears in columns ${c1 + 1}, ${c2 + 1}, and ${c3 + 1}. Because ${digit} must go in those columns within those rows, you can remove it from the rest of those three columns.`,
          };
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
      if (n >= 2 && n <= 3) baseCols.push(c);
    }

    for (let i = 0; i < baseCols.length; i++) {
      for (let j = i + 1; j < baseCols.length; j++) {
        for (let k = j + 1; k < baseCols.length; k++) {
          const c1 = baseCols[i];
          const c2 = baseCols[j];
          const c3 = baseCols[k];
          const rowSet = new Set<number>();
          for (const r of colRows[c1]) rowSet.add(r);
          for (const r of colRows[c2]) rowSet.add(r);
          for (const r of colRows[c3]) rowSet.add(r);
          if (rowSet.size !== 3) continue;
          const rows = [...rowSet].sort((a, b) => a - b);
          const [r1, r2, r3] = rows;

          const eliminations: SwordfishElimination[] = [];
          for (let c = 0; c < size; c++) {
            if (c === c1 || c === c2 || c === c3) continue;
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
          for (const c of [c1, c2, c3]) {
            for (const r of rows) {
              const cand = grid[r][c];
              if (cand != null && cand.has(digit)) {
                cells.push({ row: r, col: c });
              }
            }
          }

          return {
            technique: 'swordfish',
            digit,
            orientation: 'cols',
            baseHouses: [c1, c2, c3],
            coverHouses: [r1, r2, r3],
            cells,
            eliminations,
            explanation: `In columns ${c1 + 1}, ${c2 + 1}, and ${c3 + 1}, ${digit} only appears in rows ${r1 + 1}, ${r2 + 1}, and ${r3 + 1}. Because ${digit} must go in those rows within those columns, you can remove it from the rest of those three rows.`,
          };
        }
      }
    }
  }

  return null;
}
