import type { Digit, Position } from '../../types';

export interface TechniqueFixture {
  variant: 'classic' | 'six' | 'mini';
  /**
   * Serialized board: row-major, one character per cell. Digits 1-9 are
   * givens; '.' or '0' marks an empty cell. Whitespace is ignored.
   */
  board: string;
  /** Cells highlighted in the help screen's "highlight pattern" step. */
  patternCells: Position[];
  deduction: {
    eliminations?: Array<{ pos: Position; digits: Digit[] }>;
    placement?: { pos: Position; digit: Digit };
  };
  /** Plain-language "When to look for it" description. */
  description: string;
}

/**
 * ALS-XZ fixture (Classic 9x9), built from a complete BUG solution by erasing
 * seven cells. After erasure the empty cells take these candidates:
 *
 *   R1C1 = {1, 2}     R1C2 = {1, 2}
 *   R4C1 = {1, 2}     R4C2 = {1, 2}
 *   R5C1 = {1, 3}     R5C2 = {1, 6}     R5C8 = {1}   (forced single)
 *
 * Each of R1C1 and R4C1 is a single-cell Almost Locked Set (a bivalue cell:
 * 1 cell, 2 candidates). They share column 1, so digit 2 is restricted-common
 * — exactly one of them can carry the 2. Whichever takes 2 forces the other
 * to take 1, so digit 1 must appear in either R1C1 or R4C1. Any cell that
 * sees both with 1 still in its candidates therefore cannot itself be 1.
 *
 * R5C1 is the lone such cell: it sees R1C1 and R4C1 through column 1 and
 * carries 1 in its candidate set ({1, 3}). Digit 1 is eliminated from R5C1,
 * leaving R5C1 = {3}. This degenerate two-bivalue case coincides with a
 * Naked Pair on {1, 2} in column 1 — ALS-XZ generalises the same idea to
 * larger ALS pairs. The fixture is sufficient to exercise the detector and
 * the help screen explanation distinguishes the two framings.
 *
 * Solution grid (with the seven erased cells shown as `.`):
 *
 *   . . 3 | 4 5 6 | 7 8 9
 *   4 5 6 | 7 8 9 | 1 2 3
 *   7 8 9 | 1 2 3 | 4 5 6
 *   ------+-------+------
 *   . . 4 | 3 6 5 | 8 9 7
 *   . . 5 | 8 9 7 | 2 . 4
 *   8 9 7 | 2 1 4 | 3 6 5
 *   ------+-------+------
 *   5 3 1 | 6 4 2 | 9 7 8
 *   6 4 2 | 9 7 8 | 5 3 1
 *   9 7 8 | 5 3 1 | 6 4 2
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '..3456789' +
    '456789123' +
    '789123456' +
    '..4365897' +
    '..58972.4' +
    '897214365' +
    '531642978' +
    '642978531' +
    '978531642',
  patternCells: [
    { row: 0, col: 0 },
    { row: 3, col: 0 },
  ],
  deduction: {
    eliminations: [{ pos: { row: 4, col: 0 }, digits: [1] }],
  },
  description:
    'Two Almost Locked Sets (ALS-A and ALS-B) — each an N-cell set in a single house with N+1 candidates — share a "restricted common" digit X: every X-candidate cell of A sees every X-candidate cell of B. So at most one ALS holds X, and the other is forced into a true locked set whose remaining candidates are pinned. For any other common candidate Z, one of the two ALSes must therefore carry Z; any cell outside both ALSes that sees every Z-candidate cell in A and in B cannot be Z, so Z is eliminated from it.',
};
