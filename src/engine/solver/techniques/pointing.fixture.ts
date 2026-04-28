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
 * Pointing Pair/Triple fixture (Classic 9x9).
 *
 * Box 0 rows 1-2 hold non-1 digits 2..7, so within box 0 digit 1 can only
 * appear in row 0 (cells (0,0), (0,1), (0,2)). Whichever of those cells
 * eventually gets the 1, the line constraint means digit 1 is also locked
 * out of the rest of row 0.
 *
 *   . . . | . . . | . . .
 *   2 3 4 | . . . | . . .
 *   5 6 7 | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
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
    '234......' +
    '567......' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  patternCells: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 3 }, digits: [1] },
      { pos: { row: 0, col: 4 }, digits: [1] },
      { pos: { row: 0, col: 5 }, digits: [1] },
      { pos: { row: 0, col: 6 }, digits: [1] },
      { pos: { row: 0, col: 7 }, digits: [1] },
      { pos: { row: 0, col: 8 }, digits: [1] },
    ],
  },
  description:
    "When a digit's only candidate cells inside a box all lie on the same row or column, that digit must be placed somewhere on that line within the box — so it can be eliminated from every other cell of the line.",
};
