import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface HiddenRectangleElimination {
  cell: Position;
  digits: Digit[];
}

export interface HiddenRectangleResult {
  technique: 'hidden-rectangle';
  /** The two UR candidates {X, Y}, sorted ascending. */
  digits: [Digit, Digit];
  /** All four corner cells in row-major order. */
  corners: [Position, Position, Position, Position];
  /** The bivalue corner — its diagonally-opposite corner is the elimination
   *  target. */
  anchor: Position;
  /** The corner diagonally opposite the anchor (where the digit is
   *  eliminated). */
  diagonal: Position;
  /** The corner sharing the diagonal's row (and the anchor's column). */
  diagonalRowMate: Position;
  /** The corner sharing the diagonal's column (and the anchor's row). */
  diagonalColMate: Position;
  /** The digit eliminated from the diagonal corner. */
  eliminatedDigit: Digit;
  eliminations: HiddenRectangleElimination[];
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

function rectangleSpansTwoBoxes(
  variant: Variant,
  r1: number,
  r2: number,
  c1: number,
  c2: number,
): boolean {
  const sameBand =
    Math.floor(r1 / variant.boxHeight) === Math.floor(r2 / variant.boxHeight);
  const sameStack =
    Math.floor(c1 / variant.boxWidth) === Math.floor(c2 / variant.boxWidth);
  return sameBand !== sameStack;
}

/**
 * True iff digit Z is a candidate at exactly columns c1 and c2 within row r —
 * a conjugate pair on Z restricted to those two cells.
 */
function isStrongLinkInRow(
  grid: (Set<Digit> | null)[][],
  r: number,
  c1: number,
  c2: number,
  Z: Digit,
  size: number,
): boolean {
  const a = grid[r][c1];
  const b = grid[r][c2];
  if (a == null || !a.has(Z)) return false;
  if (b == null || !b.has(Z)) return false;
  for (let c = 0; c < size; c++) {
    if (c === c1 || c === c2) continue;
    const cell = grid[r][c];
    if (cell != null && cell.has(Z)) return false;
  }
  return true;
}

/** True iff digit Z is a candidate at exactly rows r1 and r2 within column c. */
function isStrongLinkInCol(
  grid: (Set<Digit> | null)[][],
  c: number,
  r1: number,
  r2: number,
  Z: Digit,
  size: number,
): boolean {
  const a = grid[r1][c];
  const b = grid[r2][c];
  if (a == null || !a.has(Z)) return false;
  if (b == null || !b.has(Z)) return false;
  for (let r = 0; r < size; r++) {
    if (r === r1 || r === r2) continue;
    const cell = grid[r][c];
    if (cell != null && cell.has(Z)) return false;
  }
  return true;
}

/**
 * Hidden Rectangle.
 *
 * Four cells form a rectangle that spans exactly two boxes, all four
 * containing X and Y as candidates. One corner — the anchor A — is bivalue
 * {X, Y}. Let D be the corner diagonally opposite A, B the corner sharing
 * A's row (and D's column), and C the corner sharing A's column (and D's
 * row). If a digit Z ∈ {X, Y} is a strong link in:
 *   - the row of D, between C and D, AND
 *   - the column of D, between B and D,
 * then Z can be eliminated from D.
 *
 * Reasoning (uniqueness): were D = Z, the two strong links would force
 * C ≠ Z and B ≠ Z. The bivalue anchor A could only resolve in a way that
 * pins B and C onto the other UR digit, completing a deadly {X, Y} pattern
 * across the four corners — impossible in a uniquely-solvable puzzle.
 *
 * Iteration: digit pairs (X, Y) ascending, then rectangle rows (r1 < r2),
 * then rectangle columns (c1 < c2). For each rectangle every bivalue corner
 * is tried as the anchor with Z trialed as both X and Y. The first valid
 * elimination is returned.
 */
export function findHiddenRectangle(
  board: Board,
): HiddenRectangleResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);
  const digits = variant.digits;

  for (let xi = 0; xi < digits.length; xi++) {
    const X = digits[xi];
    for (let yi = xi + 1; yi < digits.length; yi++) {
      const Y = digits[yi];

      for (let r1 = 0; r1 < size - 1; r1++) {
        for (let r2 = r1 + 1; r2 < size; r2++) {
          for (let c1 = 0; c1 < size - 1; c1++) {
            for (let c2 = c1 + 1; c2 < size; c2++) {
              if (!rectangleSpansTwoBoxes(variant, r1, r2, c1, c2)) continue;

              const corners: [Position, Position, Position, Position] = [
                { row: r1, col: c1 },
                { row: r1, col: c2 },
                { row: r2, col: c1 },
                { row: r2, col: c2 },
              ];

              let allHaveBoth = true;
              for (const pos of corners) {
                const cand = grid[pos.row][pos.col];
                if (cand == null || !cand.has(X) || !cand.has(Y)) {
                  allHaveBoth = false;
                  break;
                }
              }
              if (!allHaveBoth) continue;

              for (let i = 0; i < 4; i++) {
                const anchor = corners[i];
                const anchorCandidates = grid[anchor.row][anchor.col]!;
                if (anchorCandidates.size !== 2) continue;

                const diag = corners[3 - i];
                const diagonalRowMate: Position = {
                  row: diag.row,
                  col: anchor.col,
                };
                const diagonalColMate: Position = {
                  row: anchor.row,
                  col: diag.col,
                };

                for (const Z of [X, Y]) {
                  if (
                    !isStrongLinkInRow(
                      grid,
                      diag.row,
                      diagonalRowMate.col,
                      diag.col,
                      Z,
                      size,
                    )
                  ) {
                    continue;
                  }
                  if (
                    !isStrongLinkInCol(
                      grid,
                      diag.col,
                      diagonalColMate.row,
                      diag.row,
                      Z,
                      size,
                    )
                  ) {
                    continue;
                  }

                  const eliminations: HiddenRectangleElimination[] = [
                    { cell: diag, digits: [Z] },
                  ];

                  return {
                    technique: 'hidden-rectangle',
                    digits: [X, Y],
                    corners,
                    anchor,
                    diagonal: diag,
                    diagonalRowMate,
                    diagonalColMate,
                    eliminatedDigit: Z,
                    eliminations,
                    explanation: `Hidden Rectangle: one corner has only ${X} and ${Y}. In the opposite corner's row and column, ${Z} can only go in two places — a chain of limits that lets you remove ${Z} from the highlighted corner.`,
                  };
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}
