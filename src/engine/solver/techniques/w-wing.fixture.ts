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
 * W-Wing fixture (Classic 9x9).
 *
 * The givens leave two bivalue cells {1, 2} connected by a strong link on 2:
 *   - bivalue   R1C1 = {1, 2}
 *   - bivalue   R3C9 = {1, 2}
 * In column 5, digit 2 is restricted to exactly two cells:
 *   - R1C5 (sees R1C1 via row 1)
 *   - R3C5 (sees R3C9 via row 3)
 * Whichever end of the strong link holds 2, the bivalue cell on the same row
 * is forced to 1 — so 1 can be eliminated from any cell that sees both
 * bivalue cells. The only such empty cell is R3C3.
 *
 *   . . . | . . . | 5 6 7
 *   4 5 6 | . 1 . | 8 9 .
 *   7 8 . | . . . | . . .
 *   ------+-------+------
 *   9 . . | . . . | . . .
 *   . . . | 2 . . | . . 3
 *   3 . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . 4
 *   . . . | . . 2 | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '......567' +
    '456.1.89.' +
    '78.......' +
    '9........' +
    '...2....3' +
    '3........' +
    '........4' +
    '.....2...' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 8 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 4 }, role: 'pattern-secondary' },
    { pos: { row: 2, col: 4 }, role: 'pattern-secondary' },
    { pos: { row: 2, col: 2 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 2, col: 2 }, digits: [1] },
    ],
  },
  description:
    "Find two cells that each contain exactly the same two possible numbers. Then look for a row, column, or box where one of those numbers can only go in exactly two cells — and each of those two cells can see a different one of the original pair. No matter which supporting cell ends up with that number, the paired cell next to it is forced to the other value. You can rule out that other value from any empty cell that can see both of the original pair.",
};
