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
 * XY-Wing fixture (Classic 9x9).
 *
 * The givens leave three bivalue cells that form an XY-Wing on Z = 3:
 *   - pivot   R1C1 = {1, 2}        (sees both pincers)
 *   - pincer  R1C5 = {2, 3}        (shares row 1 with pivot)
 *   - pincer  R3C3 = {1, 3}        (shares box 1 with pivot)
 * R1C5 and R3C3 do not share a house with each other. Whichever digit the
 * pivot takes, one pincer is forced to 3 — so 3 is eliminated from every cell
 * that sees both pincers.
 *
 *   . . . | 4 . 5 | 9 . .
 *   4 5 6 | . 1 . | . . .
 *   7 8 . | . . . | . . .
 *   ------+-------+------
 *   . . 9 | . 6 . | . . .
 *   . . . | . 7 . | . . .
 *   3 . 2 | . 8 . | . . .
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
    '78.......' +
    '..9.6....' +
    '....7....' +
    '3.2.8....' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pivot' },
    { pos: { row: 0, col: 4 }, role: 'pincer' },
    { pos: { row: 2, col: 2 }, role: 'pincer' },
    { pos: { row: 0, col: 1 }, role: 'elimination' },
    { pos: { row: 0, col: 2 }, role: 'elimination' },
    { pos: { row: 2, col: 3 }, role: 'elimination' },
    { pos: { row: 2, col: 4 }, role: 'elimination' },
    { pos: { row: 2, col: 5 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 1 }, digits: [3] },
      { pos: { row: 0, col: 2 }, digits: [3] },
      { pos: { row: 2, col: 3 }, digits: [3] },
      { pos: { row: 2, col: 4 }, digits: [3] },
      { pos: { row: 2, col: 5 }, digits: [3] },
    ],
  },
  description:
    "Find a centre cell with only two possible numbers — call them A and B. Find one cell that shares a row, column, or box with it and contains A plus a third number C, and another cell that also touches the centre and contains B plus C. No matter what value the centre cell takes, one of the two outer cells must be C. You can rule out C from any empty cell that can see both outer cells.",
};
