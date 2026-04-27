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
  patternCells: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [3, 4, 5, 6, 7, 8, 9] },
      { pos: { row: 0, col: 1 }, digits: [3, 4, 5, 6, 7, 8, 9] },
    ],
  },
  description:
    'In a row, column, or box, two digits whose only candidate cells are the same two cells form a hidden pair. Those two cells must hold those two digits between them, so all other candidates can be eliminated from them.',
};
