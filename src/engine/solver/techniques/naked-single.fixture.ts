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
 * Naked Single fixture (Classic 9x9).
 *
 * Box 0 is filled with 1..8 in every cell except (0,0). The peers of (0,0)
 * cover all digits except 9, so 9 is the only candidate.
 *
 *   . 1 2 | . . . | . . .
 *   3 5 6 | . . . | . . .
 *   4 7 8 | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
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
    '.12......' +
    '356......' +
    '478......' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  roles: [{ pos: { row: 0, col: 0 }, role: 'pattern-primary' }],
  deduction: {
    placement: { pos: { row: 0, col: 0 }, digit: 9 },
  },
  description:
    "A cell whose row, column, and box together rule out every digit except one. The remaining digit must be placed in that cell.",
};
