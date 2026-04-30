import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface TwoStringKiteElimination {
  cell: Position;
  digits: Digit[];
}

export interface TwoStringKiteResult {
  technique: 'two-string-kite';
  digit: Digit;
  /** Row holding the row strong link. */
  rowLinkRow: number;
  /** Column holding the column strong link. */
  colLinkCol: number;
  /** Row-link cell that shares a box with `colBoxCell` (the box-pair). */
  rowBoxCell: Position;
  /** Column-link cell that shares a box with `rowBoxCell` (the box-pair). */
  colBoxCell: Position;
  /** Row-link cell NOT in the box-pair — one of the two kite endpoints. */
  rowTail: Position;
  /** Column-link cell NOT in the box-pair — the other kite endpoint. */
  colTail: Position;
  eliminations: TwoStringKiteElimination[];
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

function sameBox(variant: Variant, a: Position, b: Position): boolean {
  return (
    Math.floor(a.row / variant.boxHeight) ===
      Math.floor(b.row / variant.boxHeight) &&
    Math.floor(a.col / variant.boxWidth) ===
      Math.floor(b.col / variant.boxWidth)
  );
}

function sharesHouse(variant: Variant, a: Position, b: Position): boolean {
  if (a.row === b.row && a.col === b.col) return false;
  if (a.row === b.row) return true;
  if (a.col === b.col) return true;
  return sameBox(variant, a, b);
}

/**
 * Two-String Kite.
 *
 * Cousin of the Skyscraper, but the two strong links are in different
 * orientations — one in a row, one in a column — and they connect via a
 * shared box rather than a shared row or column:
 *
 *     . . . | . . . | . . .
 *     . A . | . . . | . T .         row r:  (r, c_box)  and  (r, c_tail)
 *     . . B | . . . | . . .             A  is the row-link cell in the
 *     ------+-------+------              shared box; T is the row-link
 *     . . . | . . . | . . .              cell outside it (the row tail).
 *     . . . | . . . | . . .
 *     . . . | . . . | . . .         col c:  (r_box, c)  and  (r_tail, c)
 *     ------+-------+------             B  is the col-link cell in the
 *     . . . | . . . | . . .              shared box; t is the col-link
 *     . . t | . . . | . . .              cell outside it (the col tail).
 *     . . . | . . . | . . .
 *
 * Reasoning: the shared box may hold the digit only once, so at most one of
 * A and B holds it. Each strong link must place the digit in one of its two
 * cells, so at least one of the tails T or t must hold the digit. Any cell
 * that sees both tails (via row, column, or box) therefore cannot hold the
 * digit and may be eliminated.
 *
 * The non-redundant elimination lands at the "rectangle corner" — the cell
 * at (col-tail row, row-tail column). The mirror corner at (row r, col c) is
 * always either one of the four pattern cells or already excluded by one of
 * the strong links, so it never produces a new elimination.
 *
 * Pairs whose two strong links share a cell — i.e., the row-link row index
 * appears in the col link AND the col-link column index appears in the row
 * link — are skipped: any "kite" they would form collapses to one of the
 * strong links and yields no new eliminations.
 *
 * Iteration: digits in `variant.digits` order, then row strong links by row
 * index ascending, then col strong links by column index ascending, then the
 * four (row-cell, col-cell) box-pair candidates in row-cell-then-col-cell
 * order. The first combination producing non-empty eliminations wins.
 */
export function findTwoStringKite(board: Board): TwoStringKiteResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);

  for (const digit of variant.digits) {
    const rowLinks: Array<{ row: number; cols: [number, number] }> = [];
    for (let r = 0; r < size; r++) {
      const cols: number[] = [];
      for (let c = 0; c < size; c++) {
        const cand = grid[r][c];
        if (cand != null && cand.has(digit)) cols.push(c);
      }
      if (cols.length === 2) {
        rowLinks.push({ row: r, cols: [cols[0], cols[1]] });
      }
    }

    const colLinks: Array<{ col: number; rows: [number, number] }> = [];
    for (let c = 0; c < size; c++) {
      const rows: number[] = [];
      for (let r = 0; r < size; r++) {
        const cand = grid[r][c];
        if (cand != null && cand.has(digit)) rows.push(r);
      }
      if (rows.length === 2) {
        colLinks.push({ col: c, rows: [rows[0], rows[1]] });
      }
    }

    for (const rowLink of rowLinks) {
      const r = rowLink.row;
      const [rc1, rc2] = rowLink.cols;
      for (const colLink of colLinks) {
        const c = colLink.col;
        const [cr1, cr2] = colLink.rows;

        const sharedCell =
          (c === rc1 || c === rc2) && (r === cr1 || r === cr2);
        if (sharedCell) continue;

        for (const rcc of [rc1, rc2]) {
          for (const crr of [cr1, cr2]) {
            const rowCell: Position = { row: r, col: rcc };
            const colCell: Position = { row: crr, col: c };
            if (rowCell.row === colCell.row && rowCell.col === colCell.col) {
              continue;
            }
            if (!sameBox(variant, rowCell, colCell)) continue;

            const rowTailCol = rcc === rc1 ? rc2 : rc1;
            const colTailRow = crr === cr1 ? cr2 : cr1;
            const rowTail: Position = { row: r, col: rowTailCol };
            const colTail: Position = { row: colTailRow, col: c };

            const eliminations: TwoStringKiteElimination[] = [];
            for (let er = 0; er < size; er++) {
              for (let ec = 0; ec < size; ec++) {
                if (
                  (er === rowCell.row && ec === rowCell.col) ||
                  (er === colCell.row && ec === colCell.col) ||
                  (er === rowTail.row && ec === rowTail.col) ||
                  (er === colTail.row && ec === colTail.col)
                ) {
                  continue;
                }
                const cand = grid[er][ec];
                if (cand == null || !cand.has(digit)) continue;
                const target: Position = { row: er, col: ec };
                if (!sharesHouse(variant, target, rowTail)) continue;
                if (!sharesHouse(variant, target, colTail)) continue;
                eliminations.push({ cell: target, digits: [digit] });
              }
            }
            if (eliminations.length === 0) continue;

            return {
              technique: 'two-string-kite',
              digit,
              rowLinkRow: r,
              colLinkCol: c,
              rowBoxCell: rowCell,
              colBoxCell: colCell,
              rowTail,
              colTail,
              eliminations,
              explanation: `When a row and a column each have ${digit} in only two cells, and one cell from the row and one from the column share a box, the two remaining "tail" cells are linked. Any cell that can see both tails cannot be ${digit} — remove it.`,
            };
          }
        }
      }
    }
  }

  return null;
}
