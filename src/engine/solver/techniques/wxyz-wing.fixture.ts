import type { Digit, Position } from '../../types';

export interface TechniqueFixture {
  variant: 'classic' | 'six' | 'mini';
  /**
   * Serialized board: row-major, one character per cell. Digits 1-9 are
   * givens; '.' or '0' marks an empty cell. Whitespace is ignored.
   */
  board: string;
  /** Cells highlighted in the help screen's "highlight pattern" step. */
  roles: Array<{ pos: Position; role: 'pattern-primary' }>;
  deduction: {
    eliminations?: Array<{ pos: Position; digits: Digit[] }>;
    placement?: { pos: Position; digit: Digit };
  };
  /** Plain-language "When to look for it" description. */
  description: string;
}

/**
 * WXYZ-Wing fixture (Classic 9x9).
 *
 * The givens leave a four-candidate hinge and three bivalue pincers that
 * form a WXYZ-Wing on Z = 4:
 *   - hinge   R1C1 = {1, 2, 3, 4}    (sees all three pincers)
 *   - pincer  R1C4 = {3, 4}          (shares row 1 with the hinge)
 *   - pincer  R2C3 = {1, 4}          (shares box 1 with the hinge)
 *   - pincer  R3C2 = {2, 4}          (shares box 1 with the hinge)
 * In every assignment of the hinge, exactly one of these four cells must
 * be 4 — so 4 can be eliminated from any cell that sees the hinge and all
 * three pincers. Here R1C2 is that cell: it shares row 1 and box 1 with
 * the hinge, box 1 with pincer R2C3, column 2 with pincer R3C2, and row 1
 * with pincer R1C4.
 *
 *   . . 5 | . 7 6 | . 8 .
 *   6 7 . | . 9 2 | 3 . .
 *   8 . 9 | . . 1 | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . 3 . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '..5.76.8.' +
    '67..923..' +
    '8.9..1...' +
    '.........' +
    '.........' +
    '.3.......' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 2 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 1 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 0, col: 1 }, digits: [4] }],
  },
  description:
    'A four-candidate hinge cell {W, X, Y, Z} together with three bivalue pincer cells {W, Z}, {X, Z} and {Y, Z}, where each pincer shares a house with the hinge. One of the four cells must be Z, so Z can be eliminated from every cell that sees all four.',
};
