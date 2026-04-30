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
 * Naked Triple fixture (Classic 9x9).
 *
 * Box 0 rows 1-2 hold 4..9, so the three empty box-0 cells (0,0), (0,1),
 * (0,2) can only hold {1,2,3}. Their union of candidates is exactly three
 * digits — a naked triple in row 0.
 *
 *   . . . | . . . | . . .
 *   4 5 6 | . . . | . . .
 *   7 8 9 | . . . | . . .
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
    '456......' +
    '789......' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 2 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 3 }, digits: [1, 2, 3] },
      { pos: { row: 0, col: 4 }, digits: [1, 2, 3] },
      { pos: { row: 0, col: 5 }, digits: [1, 2, 3] },
      { pos: { row: 0, col: 6 }, digits: [1, 2, 3] },
      { pos: { row: 0, col: 7 }, digits: [1, 2, 3] },
      { pos: { row: 0, col: 8 }, digits: [1, 2, 3] },
    ],
  },
  description:
    'Three cells in a row, column, or box whose combined candidates total exactly three digits form a naked triple. Those three digits are confined to those cells, so they can be eliminated from every other cell in the house.',
};
