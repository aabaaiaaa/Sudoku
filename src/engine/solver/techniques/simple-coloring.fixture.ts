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
 * Simple Coloring fixture (Classic 9x9).
 *
 * The givens leave digit 1 with exactly four strong links forming one chain:
 *   - row 1: 1 only at R1C1 and R1C2
 *   - column 2: 1 only at R1C2 and R3C2
 *   - row 3: 1 only at R3C2 and R3C4
 *   - column 4: 1 only at R3C4 and R5C4
 * Two-coloring the chain from R1C1 yields:
 *   A = { R1C1, R3C2, R5C4 }
 *   B = { R1C2, R3C4 }
 * Colors A cells R1C1 and R3C2 both lie in box 1, so color A cannot be the
 * "true" set — placing 1 in both would put 1 twice in box 1. Therefore digit 1
 * is eliminated from every color-A cell: R1C1, R3C2 and R5C4.
 *
 *   . . . | 2 3 4 | . . .
 *   . . . | . . . | . 1 .
 *   4 . . | . 5 6 | . . .
 *   ------+-------+------
 *   . . . | . . . | . . 1
 *   . 2 . | . . . | . . .
 *   . 3 . | 5 . . | . . .
 *   ------+-------+------
 *   . . . | . . 1 | . . .
 *   . . . | . . . | . . .
 *   . . 1 | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '...234...' +
    '.......1.' +
    '4...56...' +
    '........1' +
    '.2.......' +
    '.3.5.....' +
    '.....1...' +
    '.........' +
    '..1......',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 3 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [1] },
      { pos: { row: 2, col: 1 }, digits: [1] },
      { pos: { row: 4, col: 3 }, digits: [1] },
    ],
  },
  description:
    'Pick a digit. Within each house where that digit has only two candidate cells, the two cells form a "strong link" — one of them must be the digit. Two-color the resulting graph by alternating colors along the links. If two same-colored cells ever share a house, that color cannot be the true set (the digit would appear twice in the shared house), so the digit can be eliminated from every cell of that color.',
};
