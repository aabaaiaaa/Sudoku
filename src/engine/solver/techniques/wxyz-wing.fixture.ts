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
 * WXYZ-Wing fixture (Classic 9x9).
 *
 * The givens leave a four-candidate hinge and three bivalue pincers that
 * form a WXYZ-Wing on Z = 4:
 *   - hinge   R1C1 = {1, 2, 3, 4}    (sees all three pincers)
 *   - pincer  R1C4 = {3, 4}          (shares row 1 with the hinge)
 *   - pincer  R2C3 = {1, 4}          (shares box 1 with the hinge)
 *   - pincer  R3C2 = {2, 4}          (shares box 1 with the hinge)
 * In every assignment of the hinge, exactly one of these four cells must
 * be 4 — so 4 can be eliminated from any cell that sees the hinge and all
 * three pincers. Here R1C2 is that cell: it shares row 1 and box 1 with
 * the hinge, box 1 with pincer R2C3, column 2 with pincer R3C2, and row 1
 * with pincer R1C4.
 *
 *   . . 5 | . 7 6 | . 8 .
 *   6 7 . | . 9 2 | 3 . .
 *   8 . 9 | . . 1 | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . 3 . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '..5.76.8.' +
    '67..923..' +
    '8.9..1...' +
    '.........' +
    '.........' +
    '.3.......' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pivot' },
    { pos: { row: 0, col: 3 }, role: 'pincer' },
    { pos: { row: 1, col: 2 }, role: 'pincer' },
    { pos: { row: 2, col: 1 }, role: 'pincer' },
    { pos: { row: 0, col: 1 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 0, col: 1 }, digits: [4] }],
  },
  description:
    'Look for a cell with four possible numbers (the pivot) and three cells each with only two possible numbers (the pincers), where every pincer shares a row, column, or box with the pivot, and all four cells share one common possible number. No matter which number goes into the pivot, one of the four cells must end up holding that shared number. Remove it from any cell that can see all four cells at once.',
};
