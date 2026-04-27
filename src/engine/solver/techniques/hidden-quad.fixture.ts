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
 * Hidden Quad fixture (Classic 9x9).
 *
 * Givens are arranged so that in row 1 (zero-indexed: row 0), digits 1, 2, 3
 * and 4 can only appear in the first four cells. Those four cells still hold
 * all nine candidates; the hidden quad lets us eliminate {5,6,7,8,9} from
 * each of them.
 *
 * Box top-right (rows 0-2, cols 6-8) gets 1, 2, 3, 4 across rows 1-2, killing
 * those four candidates from cells (0,6)..(0,8). Column 4 is filled with
 * 1, 2, 3, 4 in rows 3-6, eliminating 1-4 from cell (0,4). Column 5 is
 * filled with 4, 1, 2, 3 in rows 5-8, eliminating 1-4 from cell (0,5).
 *
 *   . . . | . . . | . . .
 *   . . . | . . . | 1 2 3
 *   . . . | . . . | 4 . .
 *   ------+-------+------
 *   . . . | . 1 . | . . .
 *   . . . | . 2 . | . . .
 *   . . . | . 3 4 | . . .
 *   ------+-------+------
 *   . . . | . 4 1 | . . .
 *   . . . | . . 2 | . . .
 *   . . . | . . 3 | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '......123' +
    '......4..' +
    '....1....' +
    '....2....' +
    '....34...' +
    '....41...' +
    '.....2...' +
    '.....3...',
  patternCells: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [5, 6, 7, 8, 9] },
      { pos: { row: 0, col: 1 }, digits: [5, 6, 7, 8, 9] },
      { pos: { row: 0, col: 2 }, digits: [5, 6, 7, 8, 9] },
      { pos: { row: 0, col: 3 }, digits: [5, 6, 7, 8, 9] },
    ],
  },
  description:
    'In a row, column, or box, four digits whose only candidate cells are the same four cells form a hidden quad. Those four cells must hold those four digits between them, so all other candidates can be eliminated from them.',
};
