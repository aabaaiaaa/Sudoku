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
    { pos: { row: 0, col: 4 }, role: 'pattern-secondary' },
    { pos: { row: 5, col: 4 }, role: 'pattern-secondary' },
    { pos: { row: 5, col: 0 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 5, col: 0 }, digits: [1] }],
  },
  description:
    'Find a box where one number\'s possible positions all lie on one row and one column within the box. The number must end up somewhere along that row or column. Find another row or column outside the box where the number can only go in exactly two cells, with one of them on the box\'s constrained row or column. The far end of that pair is ruled out: one path places the number on the constrained line, the other places it in the far end\'s own row or column — either way, the far end is blocked.',
};
