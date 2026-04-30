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
 * XYZ-Wing fixture (Classic 9x9).
 *
 * The givens leave a trivalue pivot and two bivalue pincers that form an
 * XYZ-Wing on Z = 3:
 *   - pivot   R1C1 = {1, 2, 3}      (sees both pincers)
 *   - pincer  R1C5 = {2, 3}         (shares row 1 with pivot)
 *   - pincer  R3C3 = {1, 3}         (shares box 1 with pivot)
 * In every assignment of the pivot, exactly one of these three cells must
 * be 3 — so 3 can be eliminated from any cell that sees the pivot AND
 * both pincers (here R1C2 and R1C3, which share row 1 with the pivot and
 * pincer R1C5, and box 1 with pincer R3C3).
 *
 *   . . . | 4 . 5 | 9 . .
 *   4 5 6 | . 1 . | . . .
 *   7 8 . | . . . | . 2 .
 *   ------+-------+------
 *   . . 9 | . 6 . | . . .
 *   . . . | . 7 . | . . .
 *   . . . | . 8 . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '...4.59..' +
    '456.1....' +
    '78.....2.' +
    '..9.6....' +
    '....7....' +
    '....8....' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pivot' },
    { pos: { row: 0, col: 4 }, role: 'pincer' },
    { pos: { row: 2, col: 2 }, role: 'pincer' },
    { pos: { row: 0, col: 1 }, role: 'elimination' },
    { pos: { row: 0, col: 2 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 1 }, digits: [3] },
      { pos: { row: 0, col: 2 }, digits: [3] },
    ],
  },
  description:
    'Find a centre cell with exactly three possible numbers — call them A, B, and C. Find two outer cells: one with A and C, another with B and C, each sharing a row, column, or box with the centre. No matter what the centre takes, one of the three cells must end up as C. You can rule out C from any empty cell that can see all three cells at once.',
};
