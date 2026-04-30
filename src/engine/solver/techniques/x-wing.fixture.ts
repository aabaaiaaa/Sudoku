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
  roles: [
    { pos: { row: 0, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 6 }, role: 'pattern-primary' },
    { pos: { row: 5, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 5, col: 6 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 3 }, role: 'elimination' },
    { pos: { row: 1, col: 6 }, role: 'elimination' },
    { pos: { row: 2, col: 3 }, role: 'elimination' },
    { pos: { row: 2, col: 6 }, role: 'elimination' },
    { pos: { row: 3, col: 3 }, role: 'elimination' },
    { pos: { row: 3, col: 6 }, role: 'elimination' },
    { pos: { row: 4, col: 3 }, role: 'elimination' },
    { pos: { row: 4, col: 6 }, role: 'elimination' },
    { pos: { row: 6, col: 3 }, role: 'elimination' },
    { pos: { row: 6, col: 6 }, role: 'elimination' },
    { pos: { row: 7, col: 3 }, role: 'elimination' },
    { pos: { row: 7, col: 6 }, role: 'elimination' },
    { pos: { row: 8, col: 3 }, role: 'elimination' },
    { pos: { row: 8, col: 6 }, role: 'elimination' },
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
    "Look for two rows where one number can only go in two cells each, and those four cells line up to form a rectangle. The number has to go in two opposite corners of the rectangle. You can rule it out from any other cell in the rectangle's two columns. (The same idea works swapping rows and columns.)",
};
