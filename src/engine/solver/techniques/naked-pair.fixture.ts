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
 * Naked Pair fixture (Classic 9x9).
 *
 * Box 0 rows 1-2 hold 3..8, leaving (0,0), (0,1), (0,2) as the only empty
 * cells with candidates {1,2,9}. Placing 9 elsewhere in columns 0 and 1
 * removes 9 from (0,0) and (0,1), reducing both to {1,2} — a naked pair in
 * row 0.
 *
 *   . . . | . . . | . . .
 *   3 4 5 | . . . | . . .
 *   6 7 8 | . . . | . . .
 *   ------+-------+------
 *   9 . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . 9 . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '345......' +
    '678......' +
    '9........' +
    '.........' +
    '.........' +
    '.........' +
    '.9.......' +
    '.........',
  patternCells: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 2 }, digits: [1, 2] },
      { pos: { row: 0, col: 3 }, digits: [1, 2] },
      { pos: { row: 0, col: 4 }, digits: [1, 2] },
      { pos: { row: 0, col: 5 }, digits: [1, 2] },
      { pos: { row: 0, col: 6 }, digits: [1, 2] },
      { pos: { row: 0, col: 7 }, digits: [1, 2] },
      { pos: { row: 0, col: 8 }, digits: [1, 2] },
    ],
  },
  description:
    'Two cells in a row, column, or box that share the same two candidates and only those two candidates form a naked pair. Those digits must occupy those two cells, so they can be eliminated from every other cell in the house.',
};
