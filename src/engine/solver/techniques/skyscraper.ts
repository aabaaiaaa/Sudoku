import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface SkyscraperElimination {
  cell: Position;
  digits: Digit[];
}

export interface SkyscraperResult {
  technique: 'skyscraper';
  digit: Digit;
  /**
   * 'rows' — the two strong links are in two rows, sharing one column (the
   *   base). The roof cells are the other two cells of the strong links.
   * 'cols' — mirror: the strong links are in two columns sharing one row.
   */
  orientation: 'rows' | 'cols';
  /** The two base house indices (row indices for 'rows', col indices for 'cols'). */
  baseHouses: [number, number];
  /** The shared house index — base column for 'rows', base row for 'cols'. */
  base: number;
  /** Roof cells in the same order as `baseHouses`. */
  roof: [Position, Position];
  /** Base cells (the two ends of the shared house) in the same order as `baseHouses`. */
  baseCells: [Position, Position];
  eliminations: SkyscraperElimination[];
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

function sharesHouse(variant: Variant, a: Position, b: Position): boolean {
  if (a.row === b.row && a.col === b.col) return false;
  if (a.row === b.row) return true;
  if (a.col === b.col) return true;
  const aBoxRow = Math.floor(a.row / variant.boxHeight);
  const aBoxCol = Math.floor(a.col / variant.boxWidth);
  const bBoxRow = Math.floor(b.row / variant.boxHeight);
  const bBoxCol = Math.floor(b.col / variant.boxWidth);
  return aBoxRow === bBoxRow && aBoxCol === bBoxCol;
}

/**
 * Skyscraper.
 *
 * Two rows where a digit X has exactly two candidate cells, with one column
 * shared between them, form a Skyscraper:
 *
 *     base       roof1
 *      .  ----  *           (row r1: X only at base col and roof1 col)
 *      |
 *     base       roof2
 *      .  ----  *           (row r2: X only at base col and roof2 col)
 *
 * The base column has X in either (r1, base) or (r2, base) — at most one,
 * because a column may hold X only once. So at least one of (r1, roof1) and
 * (r2, roof2) — the "roof" cells — must hold X. Any cell that is a peer of
 * both roofs (sees both via row, column, or box) therefore cannot hold X and
 * may be eliminated.
 *
 * The shared-column count must be exactly 1: zero shared columns means there
 * is no base; two shared columns mean the rows have the same candidate set,
 * which is an X-Wing (a strictly easier technique) — Skyscraper is a
 * single-fin / Turbot-fish degenerate case of fish reasoning.
 *
 * The mirror — two columns sharing one row — is searched as the 'cols'
 * orientation. The finder tries the row orientation first.
 *
 * Iteration: digits in `variant.digits` order, then row pairs (r1 < r2) in
 * ascending order, then the column-orientation mirror. Returns the first
 * pattern with non-empty eliminations.
 */
export function findSkyscraper(board: Board): SkyscraperResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);

  // Row orientation.
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
        const cols1 = rowCols[r1];
        const cols2 = rowCols[r2];

        const shared: number[] = [];
        for (const c of cols1) {
          if (cols2.includes(c)) shared.push(c);
        }
        if (shared.length !== 1) continue;
        const baseCol = shared[0];
        const roof1Col = cols1[0] === baseCol ? cols1[1] : cols1[0];
        const roof2Col = cols2[0] === baseCol ? cols2[1] : cols2[0];

        const roof1: Position = { row: r1, col: roof1Col };
        const roof2: Position = { row: r2, col: roof2Col };

        const eliminations: SkyscraperElimination[] = [];
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (r === roof1.row && c === roof1.col) continue;
            if (r === roof2.row && c === roof2.col) continue;
            const cand = grid[r][c];
            if (cand == null || !cand.has(digit)) continue;
            const target: Position = { row: r, col: c };
            if (!sharesHouse(variant, target, roof1)) continue;
            if (!sharesHouse(variant, target, roof2)) continue;
            eliminations.push({ cell: target, digits: [digit] });
          }
        }
        if (eliminations.length === 0) continue;

        return {
          technique: 'skyscraper',
          digit,
          orientation: 'rows',
          baseHouses: [r1, r2],
          base: baseCol,
          roof: [roof1, roof2],
          baseCells: [
            { row: r1, col: baseCol },
            { row: r2, col: baseCol },
          ],
          eliminations,
          explanation: `When two rows each have ${digit} in only two cells, and one of those cells is in the same column in both rows, the other two cells act like two possible tops of a tower. Any cell that can see both of those tops cannot be ${digit} — remove it.`,
        };
      }
    }
  }

  // Column orientation: mirror.
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
        const rows1 = colRows[c1];
        const rows2 = colRows[c2];

        const shared: number[] = [];
        for (const r of rows1) {
          if (rows2.includes(r)) shared.push(r);
        }
        if (shared.length !== 1) continue;
        const baseRow = shared[0];
        const roof1Row = rows1[0] === baseRow ? rows1[1] : rows1[0];
        const roof2Row = rows2[0] === baseRow ? rows2[1] : rows2[0];

        const roof1: Position = { row: roof1Row, col: c1 };
        const roof2: Position = { row: roof2Row, col: c2 };

        const eliminations: SkyscraperElimination[] = [];
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (r === roof1.row && c === roof1.col) continue;
            if (r === roof2.row && c === roof2.col) continue;
            const cand = grid[r][c];
            if (cand == null || !cand.has(digit)) continue;
            const target: Position = { row: r, col: c };
            if (!sharesHouse(variant, target, roof1)) continue;
            if (!sharesHouse(variant, target, roof2)) continue;
            eliminations.push({ cell: target, digits: [digit] });
          }
        }
        if (eliminations.length === 0) continue;

        return {
          technique: 'skyscraper',
          digit,
          orientation: 'cols',
          baseHouses: [c1, c2],
          base: baseRow,
          roof: [roof1, roof2],
          baseCells: [
            { row: baseRow, col: c1 },
            { row: baseRow, col: c2 },
          ],
          eliminations,
          explanation: `When two columns each have ${digit} in only two cells, and one of those cells is in the same row in both columns, the other two cells act like two possible tops of a tower. Any cell that can see both of those tops cannot be ${digit} — remove it.`,
        };
      }
    }
  }

  return null;
}
