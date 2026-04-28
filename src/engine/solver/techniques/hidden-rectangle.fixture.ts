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
  patternCells: [
    { row: 0, col: 0 },
    { row: 0, col: 3 },
    { row: 1, col: 0 },
    { row: 1, col: 3 },
  ],
  deduction: {
    eliminations: [{ pos: { row: 1, col: 3 }, digits: [1] }],
  },
  description:
    'Spot four cells at the corners of a rectangle that span exactly two ' +
    'boxes, with all four containing the same two candidates {X, Y}. One ' +
    'corner is bivalue {X, Y}. In the row and column of the diagonally ' +
    'opposite corner, look for one of {X, Y} to appear as a candidate only ' +
    'at the two rectangle cells of that line — a conjugate pair in both ' +
    'the row and the column. If you find such a digit, it can be ' +
    'eliminated from the diagonal corner; otherwise the four corners ' +
    'would collapse into a deadly {X, Y} pattern with two solutions.',
};
