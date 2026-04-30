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
 * Hidden Rectangle fixture (Classic 9×9).
 *
 * Rectangle corners R1C1, R1C4, R2C1, R2C4 (rows 0-1, columns 0 and 3
 * 0-indexed) span the top-left and top-middle boxes. The anchor R1C1 is
 * bivalue {1, 2}; the other three corners each have small extras —
 * R1C4 = {1, 2, 3}, R2C1 = {1, 2, 8}, R2C4 = {1, 2, 8}.
 *
 * Strong link on 1 in row 2: R2C1 and R2C4 are the only cells in row 2
 * where 1 is still a candidate (R2C2/R2C3/R2C5/R2C6/R2C8/R2C9 are filled,
 * R2C7 has 1 excluded by box because R3C9 = 1). Strong link on 1 in
 * column 4: R1C4 and R2C4 are the only cells where 1 survives — the four
 * cells in box (top-middle) above and below are filled, R3C4 has 1
 * excluded by row (R3C9 = 1), and R4C4..R9C4 all have 1 excluded by
 * box because of the givens R4C5 = 1 (box middle-middle) and R7C6 = 1
 * (box bottom-middle).
 *
 * If R2C4 took 1, the row strong link would force R2C1 ≠ 1 and the
 * column strong link would force R1C4 ≠ 1; with the bivalue anchor R1C1
 * the four corners would collapse into a deadly {1, 2} pattern with two
 * solutions. Therefore 1 is eliminated from R2C4.
 *
 *   . 4 5 | . 6 7 | . 8 9
 *   . 3 6 | . 9 4 | . 5 7
 *   . . . | . . . | . . 1
 *   ------+-------+------
 *   . . . | . 1 . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . 1 | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.45.67.89' +
    '.36.94.57' +
    '........1' +
    '....1....' +
    '.........' +
    '.........' +
    '.....1...' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'corner' },
    { pos: { row: 0, col: 3 }, role: 'corner' },
    { pos: { row: 1, col: 0 }, role: 'corner' },
    { pos: { row: 1, col: 3 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 1, col: 3 }, digits: [1] }],
  },
  description:
    'Spot four cells forming a rectangle that spans exactly two boxes, all four sharing two possible numbers, with one corner holding only those two. For the corner diagonally opposite that one, check its row and its column: if one of the two shared numbers can only go in the rectangle cells of both that row and that column, placing it in the diagonal corner would create a pattern with two valid answers — which is not allowed. Remove that number from the diagonal corner.',
};
