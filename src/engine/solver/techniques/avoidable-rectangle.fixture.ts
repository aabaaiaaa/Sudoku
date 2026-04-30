import type { Digit, Position } from '../../types';
import type { CellRole } from './roles';

export interface TechniqueFixture {
  variant: 'classic' | 'six' | 'mini';
  /**
   * Serialized board: row-major, one character per cell. Whitespace is
   * ignored.
   *   '1'-'9'  given digit (clue)
   *   '.', '0' empty cell
   *   'a'-'i'  placed (non-given) digit 1-9 — a value that was filled in by
   *            the solver / player rather than supplied as a clue. The
   *            distinction matters for Avoidable Rectangle: only non-given
   *            placements are subject to the uniqueness swap that powers
   *            the deduction.
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
 * Avoidable Rectangle Type 1 fixture (Classic 9x9).
 *
 * Rectangle corners R1C1, R1C4, R2C1, R2C4 (rows 0-1, columns 0 and 3,
 * 0-indexed) span the top-left and top-middle boxes. Three corners are
 * already filled with non-given placements forming a {1, 2} pattern:
 *
 *   R1C1 = 1   (placed, non-given) — diagonal partner of the empty corner
 *   R1C4 = 2   (placed, non-given)
 *   R2C1 = 2   (placed, non-given)
 *
 * The fourth corner R2C4 is empty. The givens around it constrain its
 * candidates:
 *
 *   row 2: R2C5=4, R2C6=5    excludes 4, 5
 *   col 4: R3C4=8, R4C4=9    excludes 8, 9
 *   box 2: R1C5=6, R1C6=7    excludes 6, 7
 *
 * Combined with 2 already excluded by R1C4 and R2C1 in the row/column,
 * R2C4's only surviving candidates are {1, 3}, so it is bivalue.
 *
 * If R2C4 took 1, all four corners would carry exactly the deadly {1, 2}
 * configuration:
 *
 *   1 2     diag (R1C1, R2C4) = both 1
 *   2 1     diag (R1C4, R2C1) = both 2
 *
 * None of R1C1, R1C4, R2C1 is a given, so swapping 1↔2 at all four
 * corners — yielding (2, 1, 1, 2) — preserves every row, column, and box
 * constraint locally and leaves the rest of the puzzle untouched. Two
 * complete fillings would then satisfy the same set of givens, breaking
 * uniqueness. R2C4 = 1 is therefore rejected, and the bivalue {1, 3}
 * cell is forced to 3.
 *
 *   1 4 5 | 2 6 7 | . 8 9    (R1C1 and R1C4 are placed, the rest givens)
 *   2 . . | . 4 5 | . . .    (R2C1 placed; R2C4 empty)
 *   . . . | 8 . . | . . .
 *   ------+-------+------
 *   . . . | 9 . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    'a45b67.89' +
    'b...45...' +
    '...8.....' +
    '...9.....' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 3 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 1, col: 3 }, digits: [1] }],
  },
  description:
    'Look for four cells at the corners of a rectangle spanning two boxes, where you (not the original puzzle) have already filled in three of them using only two numbers. If the empty fourth corner has the same number as its diagonal partner as a possibility, placing that number there would let you swap the two numbers at all four corners and still satisfy every rule — giving the puzzle two answers. Remove that number from the empty corner.',
};
