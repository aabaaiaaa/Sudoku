import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface AvoidableRectangleElimination {
  cell: Position;
  digits: Digit[];
}

export interface AvoidableRectangleResult {
  technique: 'avoidable-rectangle';
  /** The two rectangle digits {U, V}, sorted ascending. */
  digits: [Digit, Digit];
  /** All four corner cells in row-major order. */
  corners: [Position, Position, Position, Position];
  /** The three filled corners (non-given placements), sorted row-major. */
  filledCorners: [Position, Position, Position];
  /** The empty bivalue corner where the elimination occurs. */
  targetCell: Position;
  /** The "deadly" digit (matching the diagonal partner) eliminated. */
  eliminatedDigit: Digit;
  /** The remaining candidate at the bivalue cell after the elimination. */
  forcedDigit: Digit;
  eliminations: AvoidableRectangleElimination[];
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
 * Avoidable Rectangle (Type 1).
 *
 * Four cells form a rectangle that spans exactly two boxes. Three of the
 * corners are already filled with non-given values from a digit pair
 * {U, V}: the diagonal corner D opposite the empty cell holds V, and the
 * two off-diagonal corners A and B both hold U. The fourth corner E
 * (diagonally opposite D) is empty with exactly two candidates {V, Z}.
 *
 * Reasoning (uniqueness): if E took V, the four corners would form the
 * deadly {U, V} pattern. Because A, B, and D are not original givens,
 * swapping U↔V across all four corners is locally consistent (each row,
 * column, and box still contains the same set of digits) and leaves the
 * rest of the puzzle untouched, giving a second solution. A
 * uniquely-solvable puzzle therefore cannot admit E = V, so V is
 * eliminated from E and the bivalue cell is forced to Z.
 *
 * Iteration order: rectangles by (r1 < r2, c1 < c2) ascending; within
 * each rectangle, every corner is tried as the empty target. The first
 * valid elimination is returned.
 */
export function findAvoidableRectangle(
  board: Board,
): AvoidableRectangleResult | null {
  const { variant } = board;
  const size = variant.size;

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

          for (let i = 0; i < 4; i++) {
            const result = tryEmptyCorner(board, corners, i);
            if (result !== null) return result;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Try interpreting `corners[emptyIndex]` as the empty bivalue corner of an
 * Avoidable Rectangle. Returns a result if the AR Type 1 pattern is
 * present at this rectangle/corner combination, otherwise null.
 *
 * Corners are laid out in row-major order, so `3 - emptyIndex` is always
 * the diagonal partner: 0 ↔ 3 and 1 ↔ 2.
 */
function tryEmptyCorner(
  board: Board,
  corners: [Position, Position, Position, Position],
  emptyIndex: number,
): AvoidableRectangleResult | null {
  const { cells } = board;

  const target = corners[emptyIndex];
  if (cells[target.row][target.col].value !== null) return null;

  const diagPartner = corners[3 - emptyIndex];
  const dCell = cells[diagPartner.row][diagPartner.col];
  if (dCell.value === null || dCell.given) return null;
  const V = dCell.value;

  const offIndices: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (i !== emptyIndex && i !== 3 - emptyIndex) offIndices.push(i);
  }
  const offA = corners[offIndices[0]];
  const offB = corners[offIndices[1]];
  const aCell = cells[offA.row][offA.col];
  const bCell = cells[offB.row][offB.col];
  if (aCell.value === null || aCell.given) return null;
  if (bCell.value === null || bCell.given) return null;
  if (aCell.value !== bCell.value) return null;
  const U = aCell.value;
  if (U === V) return null;

  const candidates = computeCandidates(board, target);
  if (candidates.size !== 2) return null;
  if (!candidates.has(V)) return null;

  let Z: Digit | null = null;
  for (const d of candidates) {
    if (d !== V) {
      Z = d;
      break;
    }
  }
  if (Z === null) return null;

  const filled: Position[] = [diagPartner, offA, offB];
  filled.sort((p, q) => p.row - q.row || p.col - q.col);
  const filledCorners: [Position, Position, Position] = [
    filled[0],
    filled[1],
    filled[2],
  ];

  const digitsPair: [Digit, Digit] = U < V ? [U, V] : [V, U];

  const eliminations: AvoidableRectangleElimination[] = [
    { cell: target, digits: [V] },
  ];

  return {
    technique: 'avoidable-rectangle',
    digits: digitsPair,
    corners,
    filledCorners,
    targetCell: target,
    eliminatedDigit: V,
    forcedDigit: Z,
    eliminations,
    explanation: `Avoidable Rectangle: three corners are already filled with ${digitsPair[0]} and ${digitsPair[1]}. If the empty corner also took ${V}, the puzzle would have two answers — so remove ${V} from the highlighted corner, leaving ${Z}.`,
  };
}
