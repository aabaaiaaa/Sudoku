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
 * X-Wing fixture (Classic 9x9).
 *
 * Rows 0 and 5 are filled with seven non-1 digits each, leaving columns 3
 * and 6 as the only empty cells in each of those rows. Digit 1 in row 0
 * must go in col 3 or col 6, and the same for row 5 — so columns 3 and 6
 * each get exactly one of those two 1s. Digit 1 can be eliminated from
 * cols 3 and 6 in every other row.
 *
 *   2 3 4 | . 5 6 | . 7 8
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   5 6 7 | . 8 2 | . 3 4
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '234.56.78' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '567.82.34' +
    '.........' +
    '.........' +
    '.........',
  patternCells: [
    { row: 0, col: 3 },
    { row: 0, col: 6 },
    { row: 5, col: 3 },
    { row: 5, col: 6 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 1, col: 3 }, digits: [1] },
      { pos: { row: 1, col: 6 }, digits: [1] },
      { pos: { row: 2, col: 3 }, digits: [1] },
      { pos: { row: 2, col: 6 }, digits: [1] },
      { pos: { row: 3, col: 3 }, digits: [1] },
      { pos: { row: 3, col: 6 }, digits: [1] },
      { pos: { row: 4, col: 3 }, digits: [1] },
      { pos: { row: 4, col: 6 }, digits: [1] },
      { pos: { row: 6, col: 3 }, digits: [1] },
      { pos: { row: 6, col: 6 }, digits: [1] },
      { pos: { row: 7, col: 3 }, digits: [1] },
      { pos: { row: 7, col: 6 }, digits: [1] },
      { pos: { row: 8, col: 3 }, digits: [1] },
      { pos: { row: 8, col: 6 }, digits: [1] },
    ],
  },
  description:
    "Two rows where a digit's candidate cells are confined to the same two columns form an X-Wing. Whichever way the digit ends up placed, those two columns must hold it on those rows — so it can be eliminated from those columns in every other row. The same idea works with rows and columns swapped.",
};
