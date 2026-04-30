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
  roles: [
    { pos: { row: 4, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 4 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 5 }, role: 'pattern-primary' },
    { pos: { row: 3, col: 3 }, role: 'elimination' },
    { pos: { row: 3, col: 4 }, role: 'elimination' },
    { pos: { row: 3, col: 5 }, role: 'elimination' },
    { pos: { row: 5, col: 3 }, role: 'elimination' },
    { pos: { row: 5, col: 4 }, role: 'elimination' },
    { pos: { row: 5, col: 5 }, role: 'elimination' },
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
    "Look for a row or column where one number can only go in cells that are all inside the same box. Since one of those cells must hold the number, you can rule it out from every other cell in that box.",
};
