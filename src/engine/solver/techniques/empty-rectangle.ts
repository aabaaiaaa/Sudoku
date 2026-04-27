import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export interface EmptyRectangleElimination {
  cell: Position;
  digits: Digit[];
}

export interface EmptyRectangleStrongLink {
  from: Position;
  to: Position;
  /** House description, e.g. "row 5" or "column 7". */
  house: string;
  /** Orientation of the strong link. */
  orientation: 'row' | 'column';
}

export interface EmptyRectangleResult {
  technique: 'empty-rectangle';
  digit: Digit;
  /** Box index, top-to-bottom, left-to-right (0-indexed). */
  box: number;
  /** Row of the ER cross (0-indexed). */
  erRow: number;
  /** Column of the ER cross (0-indexed). */
  erCol: number;
  /** All cells in the ER box that have the digit as a candidate. */
  boxCells: Position[];
  /** The conjugate pair forming the strong link in another house. */
  strongLink: EmptyRectangleStrongLink;
  /** The single eliminated cell. */
  eliminations: EmptyRectangleElimination[];
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
 * Empty Rectangle.
 *
 * Within a box B, the candidate cells for digit X are confined to a single
 * row R and a single column C of B (the cells form an "L", "T", or "+" along
 * the cross at (R, C)). The intersection cell (R, C) — the ER cell — does not
 * itself need to contain the candidate; what matters is that every candidate
 * in the box lies on row R or column C, with at least one cell on each line
 * (otherwise the pattern degenerates to a Pointing Pair).
 *
 * The ER condition implies: if X is not placed in row R within box B, then it
 * must be placed in column C within box B (and vice versa). Combined with a
 * strong link for X in another house, an elimination follows:
 *
 *  - **Column variant**: a conjugate pair on X in some column C′ (outside the
 *    columns of B) with one end at (R, C′) and the other at (R″, C′), where
 *    R″ is outside the rows of B. Either X is at (R, C′), forcing X in box B
 *    into column C, or X is at (R″, C′). Either way, X cannot be at (R″, C),
 *    which is therefore eliminated.
 *  - **Row variant**: symmetrically, a conjugate pair on X in some row R′
 *    (outside the rows of B) with ends at (R′, C) and (R′, C″) eliminates X
 *    from (R, C″).
 *
 * The search iterates digits in `variant.digits` order, then boxes in
 * row-major order, then ER cross positions, and for each ER tries the column
 * variant before the row variant. It returns the first elimination found.
 */
export function findEmptyRectangle(board: Board): EmptyRectangleResult | null {
  const { variant } = board;
  const { size, boxWidth, boxHeight } = variant;
  const grid = buildCandidatesGrid(board);

  const boxesPerCol = Math.floor(size / boxHeight);
  const boxesPerRow = Math.floor(size / boxWidth);

  for (const digit of variant.digits) {
    for (let bi = 0; bi < boxesPerCol; bi++) {
      for (let bj = 0; bj < boxesPerRow; bj++) {
        const boxIndex = bi * boxesPerRow + bj;
        const startRow = bi * boxHeight;
        const startCol = bj * boxWidth;
        const boxRows: number[] = [];
        for (let dr = 0; dr < boxHeight; dr++) boxRows.push(startRow + dr);
        const boxCols: number[] = [];
        for (let dc = 0; dc < boxWidth; dc++) boxCols.push(startCol + dc);

        const boxCells: Position[] = [];
        for (const r of boxRows) {
          for (const c of boxCols) {
            const cand = grid[r][c];
            if (cand != null && cand.has(digit)) {
              boxCells.push({ row: r, col: c });
            }
          }
        }
        if (boxCells.length < 2) continue;

        for (const erRow of boxRows) {
          for (const erCol of boxCols) {
            let valid = true;
            let rowOnly = 0;
            let colOnly = 0;
            for (const cell of boxCells) {
              const onRow = cell.row === erRow;
              const onCol = cell.col === erCol;
              if (!onRow && !onCol) {
                valid = false;
                break;
              }
              if (onRow && !onCol) rowOnly++;
              if (onCol && !onRow) colOnly++;
            }
            if (!valid) continue;
            // Non-degeneracy: at least one cell on each line of the cross.
            // A purely-row-aligned or purely-column-aligned set is a Pointing
            // Pair, which is a strictly easier technique.
            if (rowOnly === 0 || colOnly === 0) continue;

            // Column variant.
            for (let cPrime = 0; cPrime < size; cPrime++) {
              if (boxCols.includes(cPrime)) continue;
              const colCells: Position[] = [];
              for (let r = 0; r < size; r++) {
                const cand = grid[r][cPrime];
                if (cand != null && cand.has(digit)) {
                  colCells.push({ row: r, col: cPrime });
                }
              }
              if (colCells.length !== 2) continue;
              const idx = colCells.findIndex((p) => p.row === erRow);
              if (idx === -1) continue;
              const linkRowEnd = colCells[idx];
              const otherEnd = colCells[1 - idx];
              if (boxRows.includes(otherEnd.row)) continue;
              const elimCell: Position = { row: otherEnd.row, col: erCol };
              const elimCand = grid[elimCell.row][elimCell.col];
              if (elimCand == null || !elimCand.has(digit)) continue;
              return {
                technique: 'empty-rectangle',
                digit,
                box: boxIndex,
                erRow,
                erCol,
                boxCells: boxCells.slice(),
                strongLink: {
                  from: linkRowEnd,
                  to: otherEnd,
                  house: `column ${cPrime + 1}`,
                  orientation: 'column',
                },
                eliminations: [{ cell: elimCell, digits: [digit] }],
                explanation: `Empty rectangle on ${digit} in box ${boxIndex + 1} (cross at R${erRow + 1}C${erCol + 1}); strong link in column ${cPrime + 1} between R${linkRowEnd.row + 1}C${linkRowEnd.col + 1} and R${otherEnd.row + 1}C${otherEnd.col + 1}; eliminate ${digit} from R${elimCell.row + 1}C${elimCell.col + 1}`,
              };
            }

            // Row variant.
            for (let rPrime = 0; rPrime < size; rPrime++) {
              if (boxRows.includes(rPrime)) continue;
              const rowCells: Position[] = [];
              for (let c = 0; c < size; c++) {
                const cand = grid[rPrime][c];
                if (cand != null && cand.has(digit)) {
                  rowCells.push({ row: rPrime, col: c });
                }
              }
              if (rowCells.length !== 2) continue;
              const idx = rowCells.findIndex((p) => p.col === erCol);
              if (idx === -1) continue;
              const linkColEnd = rowCells[idx];
              const otherEnd = rowCells[1 - idx];
              if (boxCols.includes(otherEnd.col)) continue;
              const elimCell: Position = { row: erRow, col: otherEnd.col };
              const elimCand = grid[elimCell.row][elimCell.col];
              if (elimCand == null || !elimCand.has(digit)) continue;
              return {
                technique: 'empty-rectangle',
                digit,
                box: boxIndex,
                erRow,
                erCol,
                boxCells: boxCells.slice(),
                strongLink: {
                  from: linkColEnd,
                  to: otherEnd,
                  house: `row ${rPrime + 1}`,
                  orientation: 'row',
                },
                eliminations: [{ cell: elimCell, digits: [digit] }],
                explanation: `Empty rectangle on ${digit} in box ${boxIndex + 1} (cross at R${erRow + 1}C${erCol + 1}); strong link in row ${rPrime + 1} between R${linkColEnd.row + 1}C${linkColEnd.col + 1} and R${otherEnd.row + 1}C${otherEnd.col + 1}; eliminate ${digit} from R${elimCell.row + 1}C${elimCell.col + 1}`,
              };
            }
          }
        }
      }
    }
  }

  return null;
}
