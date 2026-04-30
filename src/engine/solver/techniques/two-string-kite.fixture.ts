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
 * Two-String Kite fixture (Classic 9x9), digit 1.
 *
 * Row 1 has digits 2, 3, 4, 5, 6, 7, 8 placed at columns 1, 2, 3, 4, 6, 7, 9
 * (everywhere except columns 5 and 8). The two missing digits (1 and 9) must
 * occupy R1C5 and R1C8, so digit 1 in row 1 is confined to those two cells —
 * a row strong link.
 *
 * Column 6 has digits 6, 2, 3, 4, 5, 7, 8 placed at rows 1, 3, 4, 5, 6, 7, 9
 * (everywhere except rows 2 and 8). The two missing digits (1 and 9) must
 * occupy R2C6 and R8C6, so digit 1 in column 6 is confined to those two cells
 * — a column strong link.
 *
 * Row-link cell R1C5 and column-link cell R2C6 both lie in box 2 (rows 1-3,
 * cols 4-6) — the "shared box" connecting the two strong links. The remaining
 * row-link cell R1C8 (the row tail) and column-link cell R8C6 (the column
 * tail) are the kite endpoints.
 *
 * Box 2 may hold digit 1 only once, so at most one of R1C5 and R2C6 holds it.
 * Each strong link must place digit 1 somewhere, so at least one of the tails
 * R1C8 or R8C6 must hold it. Cell R8C8 sees R1C8 (column 8) and R8C6 (row 8)
 * — whichever tail holds the 1, R8C8 cannot. Digit 1 is eliminated from R8C8.
 *
 *   2 3 4 | 5 . 6 | 7 . 8
 *   . . . | . . . | . . .
 *   . . . | . . 2 | . . .
 *   ------+-------+------
 *   . . . | . . 3 | . . .
 *   . . . | . . 4 | . . .
 *   . . . | . . 5 | . . .
 *   ------+-------+------
 *   . . . | . . 7 | . . .
 *   . . . | . . . | . . .
 *   . . . | . . 8 | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '2345.67.8' +
    '.........' +
    '.....2...' +
    '.....3...' +
    '.....4...' +
    '.....5...' +
    '.....7...' +
    '.........' +
    '.....8...',
  roles: [
    { pos: { row: 0, col: 4 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 7 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 5 }, role: 'pattern-primary' },
    { pos: { row: 7, col: 5 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 7, col: 7 }, digits: [1] }],
  },
  description:
    'Pick a digit and look for one row and one column that each have the digit confined to exactly two cells, where one row cell and one column cell share a box. The shared box can hold the digit only once, so at most one of those two cells holds it; the other end of each strong link — the two "tails" — must therefore between them place the digit. Any cell that sees both tails (via row, column, or box) cannot hold the digit and is eliminated.',
};
