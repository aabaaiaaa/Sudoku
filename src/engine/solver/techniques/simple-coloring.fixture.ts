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
    { pos: { row: 0, col: 0 }, role: 'cluster-a' },
    { pos: { row: 0, col: 1 }, role: 'cluster-b' },
    { pos: { row: 2, col: 1 }, role: 'cluster-a' },
    { pos: { row: 2, col: 3 }, role: 'cluster-b' },
    { pos: { row: 4, col: 3 }, role: 'cluster-a' },
    { pos: { row: 0, col: 0 }, role: 'elimination' },
    { pos: { row: 2, col: 1 }, role: 'elimination' },
    { pos: { row: 4, col: 3 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [1] },
      { pos: { row: 2, col: 1 }, digits: [1] },
      { pos: { row: 4, col: 3 }, digits: [1] },
    ],
  },
  description:
    'Pick a number. In each row, column, and box where that number can only go in two cells, those two cells are paired — one of them must hold the number. Follow a chain of these pairs and label the cells in two alternating groups (A and B). If two A-cells end up in the same row, column, or box, they cannot both be right, so remove the number from every A-cell. The same goes if two B-cells clash.',
};
