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
  patternCells: [
    { row: 0, col: 0 },
    { row: 0, col: 4 },
    { row: 2, col: 2 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 1 }, digits: [3] },
      { pos: { row: 0, col: 2 }, digits: [3] },
    ],
  },
  description:
    'A trivalue pivot cell {X, Y, Z} and two bivalue pincer cells {X, Z} and {Y, Z}, where each pincer shares a house with the pivot. One of the three cells must be Z, so Z can be eliminated from every cell that sees all three.',
};
