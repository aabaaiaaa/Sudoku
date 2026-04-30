import type { Digit, Position } from '../../types';
import type { CellRole } from './roles';

export interface TechniqueFixture {
  variant: 'classic' | 'six' | 'mini';
  /**
   * Serialized board: row-major, one character per cell. Digits 1-9 are
   * givens; '.' or '0' marks an empty cell. Whitespace is ignored.
   */
  board: string;
  /** Cells highlighted in the help screen's "highlight pattern" step. */
  roles: Array<{ pos: Position; role: CellRole }>;
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
  roles: [
    { pos: { row: 0, col: 0 }, role: 'cluster-a' },
    { pos: { row: 3, col: 0 }, role: 'cluster-b' },
    { pos: { row: 4, col: 0 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 4, col: 0 }, digits: [1] }],
  },
  description:
    'Look for two small groups of cells where you almost know which numbers go in them — each group of N cells holds exactly N+1 possible numbers. Find a number X that appears in only one cell of each group, where those two cells can see each other. Because those two cells cannot both be X, each group is forced into its remaining numbers. If a second number Z appears in both groups, and every cell in both groups that could be Z can see a particular outside cell, that outside cell cannot be Z. Remove Z from it.',
};
