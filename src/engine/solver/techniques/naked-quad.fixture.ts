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
 * Naked Quad fixture (Classic 9x9).
 *
 * Givens are arranged so that in row 1 (zero-indexed: row 0), the first four
 * cells each have candidates {1, 2, 3, 4}: those four cells together can only
 * hold those four digits, so {1, 2, 3, 4} can be eliminated from the rest of
 * row 0.
 *
 * Box 0 (rows 0-2, cols 0-2) is filled with 5, 6, 7, 8, 9 in rows 1-2, which
 * eliminates 5-9 from cells (0,0), (0,1) and (0,2). Column 3 is filled with
 * 5, 6, 7, 8, 9 in rows 1-5, eliminating 5-9 from cell (0,3).
 *
 *   . . . | . . . | . . .
 *   5 6 7 | 8 . . | . . .
 *   8 9 . | 5 . . | . . .
 *   ------+-------+------
 *   . . . | 6 . . | . . .
 *   . . . | 7 . . | . . .
 *   . . . | 9 . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '5678.....' +
    '89.5.....' +
    '...6.....' +
    '...7.....' +
    '...9.....' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 2 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 4 }, role: 'elimination' },
    { pos: { row: 0, col: 5 }, role: 'elimination' },
    { pos: { row: 0, col: 6 }, role: 'elimination' },
    { pos: { row: 0, col: 7 }, role: 'elimination' },
    { pos: { row: 0, col: 8 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 4 }, digits: [1, 2, 3, 4] },
      { pos: { row: 0, col: 5 }, digits: [1, 2, 3, 4] },
      { pos: { row: 0, col: 6 }, digits: [1, 2, 3, 4] },
      { pos: { row: 0, col: 7 }, digits: [1, 2, 3, 4] },
      { pos: { row: 0, col: 8 }, digits: [1, 2, 3, 4] },
    ],
  },
  description:
    'When four cells in the same row, column, or box can only hold the same four numbers between them, those numbers must go in those four cells. You can rule them out everywhere else in that row, column, or box.',
};
