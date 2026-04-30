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
 * Hidden Triple fixture (Classic 9x9).
 *
 * Givens are arranged so that in row 1 (zero-indexed: row 0), digits 1, 2 and
 * 3 can only appear in the first three cells. Those three cells still hold
 * all nine candidates; the hidden triple lets us eliminate {4,5,6,7,8,9} from
 * each of them.
 *
 * In box top-middle (rows 1-2, cols 3-5) we place 1, 2, 3 across row 1 so
 * that cells (0,3)..(0,5) lose 1, 2 and 3 as candidates. Similarly box
 * top-right gets 1, 2, 3 across row 2, killing those three candidates in
 * cells (0,6)..(0,8).
 *
 *   . . . | . . . | . . .
 *   . . . | 1 2 3 | . . .
 *   . . . | . . . | 1 2 3
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
    '...123...' +
    '......123' +
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
      { pos: { row: 0, col: 0 }, digits: [4, 5, 6, 7, 8, 9] },
      { pos: { row: 0, col: 1 }, digits: [4, 5, 6, 7, 8, 9] },
      { pos: { row: 0, col: 2 }, digits: [4, 5, 6, 7, 8, 9] },
    ],
  },
  description:
    'When three numbers can only fit within the same three cells in a row, column, or box, those three numbers must occupy those three cells. You can remove every other possibility from those three cells.',
};
