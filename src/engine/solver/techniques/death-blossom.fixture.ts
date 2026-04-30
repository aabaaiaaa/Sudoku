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
 * Death Blossom fixture (Classic 9x9).
 *
 * The givens leave R0C0, R0C2, R0C4 as bivalue cells in row 1:
 *
 *   stem    R0C0 = {1, 2}
 *   petal-1 R0C2 = {1, 3}   (single-cell ALS — restricted-common with stem on 1)
 *   petal-2 R0C4 = {2, 3}   (single-cell ALS — restricted-common with stem on 2)
 *
 * Each petal is a one-cell Almost Locked Set whose stem-digit cell sits in
 * row 1 with the stem, so placing that digit in the stem strips it from the
 * petal and forces the petal to take its other candidate. Either way, digit
 * 3 — absent from the stem but present in both petals — must end up in one of
 * R0C2 or R0C4.
 *
 * Every cell of row 1 outside {R0C0, R0C2, R0C4} therefore cannot itself be 3:
 *
 *   . . 3 4 . 5 9 . .   →   eliminations: R0C1=3, R0C7=3, R0C8=3
 *
 * (The same board also exhibits an XY-Wing on the same cells — XY-Wing is the
 * degenerate Death Blossom where every petal is a bivalue cell. The fixture
 * keeps the petals single-cell to make the relationship explicit.)
 *
 *   .  .  .  | 4  .  5  | 9  .  .
 *   4  5  6  | .  1  .  | .  .  .
 *   7  8  .  | .  .  .  | .  .  .
 *   ---------+----------+---------
 *   .  .  9  | .  6  .  | .  .  .
 *   .  .  .  | .  7  .  | .  .  .
 *   3  .  2  | .  8  .  | .  .  .
 *   ---------+----------+---------
 *   .  .  .  | .  .  .  | .  .  .
 *   .  .  .  | .  .  .  | .  .  .
 *   .  .  .  | .  .  .  | .  .  .
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
    { pos: { row: 0, col: 2 }, role: 'cluster-a' },
    { pos: { row: 0, col: 4 }, role: 'cluster-b' },
    { pos: { row: 0, col: 1 }, role: 'elimination' },
    { pos: { row: 0, col: 7 }, role: 'elimination' },
    { pos: { row: 0, col: 8 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 1 }, digits: [3] },
      { pos: { row: 0, col: 7 }, digits: [3] },
      { pos: { row: 0, col: 8 }, digits: [3] },
    ],
  },
  description:
    'Look for a pivot cell that has only two or three possible numbers, where each possible number connects to a different small group of cells that almost fills its row, column, or box (one number short of being complete). No matter which number ends up in the pivot, each connected group gets one of its possible numbers forced out, leaving one particular number — one that does not appear in the pivot itself — trapped somewhere in every group. Then you can remove that trapped number from any cell that can see all the cells holding it across every group.',
};
