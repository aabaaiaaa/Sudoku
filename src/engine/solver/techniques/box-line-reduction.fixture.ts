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
 * Box/Line Reduction fixture (Classic 9x9).
 *
 * Row 4 cols 0-2 and 6-8 hold non-1 digits 2..7. The only empty cells of
 * row 4 are (4,3), (4,4), (4,5) — all inside box 4. Digit 1 must appear on
 * row 4 within box 4, so it can be eliminated from box 4 cells outside the
 * row: (3,3), (3,4), (3,5), (5,3), (5,4), (5,5).
 *
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   2 3 4 | . . . | 5 6 7
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
    '.........' +
    '.........' +
    '.........' +
    '234...567' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  patternCells: [
    { row: 4, col: 3 },
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 3, col: 3 }, digits: [1] },
      { pos: { row: 3, col: 4 }, digits: [1] },
      { pos: { row: 3, col: 5 }, digits: [1] },
      { pos: { row: 5, col: 3 }, digits: [1] },
      { pos: { row: 5, col: 4 }, digits: [1] },
      { pos: { row: 5, col: 5 }, digits: [1] },
    ],
  },
  description:
    "When a digit's only candidate cells inside a row or column all fall within a single box, that digit must lie at their intersection — so it can be eliminated from every other cell of the box.",
};
