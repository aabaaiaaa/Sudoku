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
 * Empty Rectangle fixture (Classic 9x9), digit 1.
 *
 * Box 1 (rows 1-3, cols 1-3) has four cells filled with non-1 givens, leaving
 * five empty cells: the entire row 1 portion (R1C1, R1C2, R1C3) and the entire
 * column 1 portion (R1C1, R2C1, R3C1). Digit 1 is a candidate at every one of
 * those empty cells, so its candidates within box 1 are confined to row 1 ∪
 * column 1, with the cross at R1C1.
 *
 * Column 5 has givens 2-8 at every row except 1 and 6, so the missing digits
 * 1 and 9 must occupy R1C5 and R6C5. Digit 1 in column 5 is therefore a
 * conjugate pair (strong link) between R1C5 and R6C5. R1C5 is on the ER row
 * (row 1), and R6C5 is outside the rows of box 1.
 *
 * Either R1C5 holds the 1 — forcing box 1's 1 into column 1 — or R6C5 holds
 * the 1, putting a 1 in row 6. Either way, R6C1 cannot be 1: it is in column
 * 1 (already forced full) or in row 6 (already taken).
 *
 *   . . . | . . . | . . .
 *   . 5 6 | . 2 . | . . .
 *   . 7 8 | . 3 . | . . .
 *   ------+-------+------
 *   . . . | . 4 . | . . .
 *   . . . | . 5 . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . 6 . | . . .
 *   . . . | . 7 . | . . .
 *   . . . | . 8 . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '.56.2....' +
    '.78.3....' +
    '....4....' +
    '....5....' +
    '.........' +
    '....6....' +
    '....7....' +
    '....8....',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 2 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 4 }, role: 'pattern-primary' },
    { pos: { row: 5, col: 4 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 5, col: 0 }, digits: [1] }],
  },
  description:
    'Look at one digit in one box. If every candidate of that digit in the box lies on a single row R and a single column C of the box (with cells on each line — otherwise it is a pointing pair), the box must place the digit either somewhere along R or somewhere along C. Now find a strong link for the same digit in another house: a row or column where the digit appears in only two cells, with one of those cells sitting on R or C but in another box. The cell at the intersection of the two ends — the row R or column C of the empty rectangle and the line of the strong link — cannot hold the digit and is eliminated.',
};
