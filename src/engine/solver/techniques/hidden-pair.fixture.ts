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
 * Hidden Pair fixture (Classic 9x9).
 *
 * Givens are placed so that in row 1 (zero-indexed: row 0), digits 1 and 2 can
 * only appear in the first two cells. Those two cells have all nine candidates
 * absent the placements; the hidden pair lets us eliminate {3,4,5,6,7,8,9}
 * from both.
 *
 *   . . . | . . . | . . .
 *   . . . | 1 . . | 2 . .
 *   . . . | 2 . . | 1 . .
 *   ------+-------+------
 *   . . 1 | . . . | . . .
 *   . . 2 | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '...1..2..' +
    '...2..1..' +
    '..1......' +
    '..2......' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [3, 4, 5, 6, 7, 8, 9] },
      { pos: { row: 0, col: 1 }, digits: [3, 4, 5, 6, 7, 8, 9] },
    ],
  },
  description:
    'When two numbers can only fit in the same two cells within a row, column, or box — even though those cells still show other possibilities — those two numbers must go in those two cells. You can remove every other possibility from those two cells.',
};
