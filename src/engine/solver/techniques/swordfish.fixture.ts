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
 * Swordfish fixture (Classic 9x9), row orientation.
 *
 * Rows 1, 5, and 9 (zero-indexed: 0, 4, 8) are nearly filled, leaving columns
 * 1, 5, and 9 (zero-indexed: 0, 4, 8) empty in each. The givens are chosen so
 * that digit 1 is the only digit whose candidate columns in all three rows are
 * exactly {0, 4, 8}. Therefore digit 1 can be eliminated from columns 0, 4,
 * and 8 in every other row.
 *
 *   . 2 3 4 | . 5 6 7 | .
 *   . . . . | . . . . | .
 *   . . . . | . . . . | .
 *   --------+----------+--
 *   . . . . | . . . . | .
 *   . 4 5 6 | . 7 8 9 | .
 *   . . . . | . . . . | .
 *   --------+----------+--
 *   . . . . | . . . . | .
 *   . . . . | . . . . | .
 *   . 3 2 7 | . 8 9 4 | .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.234.567.' +
    '.........' +
    '.........' +
    '.........' +
    '.456.789.' +
    '.........' +
    '.........' +
    '.........' +
    '.327.894.',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 4 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 8 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 4 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 8 }, role: 'pattern-primary' },
    { pos: { row: 8, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 8, col: 4 }, role: 'pattern-primary' },
    { pos: { row: 8, col: 8 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 0 }, role: 'elimination' },
    { pos: { row: 1, col: 4 }, role: 'elimination' },
    { pos: { row: 1, col: 8 }, role: 'elimination' },
    { pos: { row: 2, col: 0 }, role: 'elimination' },
    { pos: { row: 2, col: 4 }, role: 'elimination' },
    { pos: { row: 2, col: 8 }, role: 'elimination' },
    { pos: { row: 3, col: 0 }, role: 'elimination' },
    { pos: { row: 3, col: 4 }, role: 'elimination' },
    { pos: { row: 3, col: 8 }, role: 'elimination' },
    { pos: { row: 5, col: 0 }, role: 'elimination' },
    { pos: { row: 5, col: 4 }, role: 'elimination' },
    { pos: { row: 5, col: 8 }, role: 'elimination' },
    { pos: { row: 6, col: 0 }, role: 'elimination' },
    { pos: { row: 6, col: 4 }, role: 'elimination' },
    { pos: { row: 6, col: 8 }, role: 'elimination' },
    { pos: { row: 7, col: 0 }, role: 'elimination' },
    { pos: { row: 7, col: 4 }, role: 'elimination' },
    { pos: { row: 7, col: 8 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 1, col: 0 }, digits: [1] },
      { pos: { row: 1, col: 4 }, digits: [1] },
      { pos: { row: 1, col: 8 }, digits: [1] },
      { pos: { row: 2, col: 0 }, digits: [1] },
      { pos: { row: 2, col: 4 }, digits: [1] },
      { pos: { row: 2, col: 8 }, digits: [1] },
      { pos: { row: 3, col: 0 }, digits: [1] },
      { pos: { row: 3, col: 4 }, digits: [1] },
      { pos: { row: 3, col: 8 }, digits: [1] },
      { pos: { row: 5, col: 0 }, digits: [1] },
      { pos: { row: 5, col: 4 }, digits: [1] },
      { pos: { row: 5, col: 8 }, digits: [1] },
      { pos: { row: 6, col: 0 }, digits: [1] },
      { pos: { row: 6, col: 4 }, digits: [1] },
      { pos: { row: 6, col: 8 }, digits: [1] },
      { pos: { row: 7, col: 0 }, digits: [1] },
      { pos: { row: 7, col: 4 }, digits: [1] },
      { pos: { row: 7, col: 8 }, digits: [1] },
    ],
  },
  description:
    "Look for three rows where one number can only go in cells that all land in the same three columns. That number must appear once in each of those rows, and it can only use those three columns to do so — so you can rule it out from every other empty cell in those three columns. (The same idea works with three columns and three rows.)",
};
