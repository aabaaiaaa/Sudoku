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
 * Skyscraper fixture (Classic 9x9), digit 1.
 *
 * Row 1 has digits 2-8 placed at columns 3-9, leaving R1C1 and R1C2 as the
 * only cells where digit 1 can go in row 1 — a strong link.
 *
 * Row 9 has digits placed everywhere except R9C1 and R9C3, and the placement
 * at R9C2 is non-1, so R9C1 and R9C3 are the only cells in row 9 where digit
 * 1 can go — another strong link.
 *
 * Both strong links share column 1 (the base): one end of each link is in
 * column 1. The roof cells are R1C2 and R9C3. Either R1C2 holds the 1 or R9C3
 * holds the 1 (otherwise both row-1 and row-9 1s would have to lie in column
 * 1, which can hold 1 only once). Any cell that is a peer of both roofs
 * therefore cannot be 1.
 *
 * The cells seeing both roofs are R2C3, R3C3 (column-peer of R9C3 and
 * box-peer of R1C2 via box 1) and R7C2, R8C2 (column-peer of R1C2 and
 * box-peer of R9C3 via box 7). Digit 1 is eliminated from all four.
 *
 *   . . 2 | 3 4 5 | 6 7 8
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . 3 . | 2 5 4 | 7 6 9
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '..2345678' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.3.254769',
  roles: [
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 8, col: 2 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 0 }, role: 'pattern-secondary' },
    { pos: { row: 8, col: 0 }, role: 'pattern-secondary' },
    { pos: { row: 1, col: 2 }, role: 'elimination' },
    { pos: { row: 2, col: 2 }, role: 'elimination' },
    { pos: { row: 6, col: 1 }, role: 'elimination' },
    { pos: { row: 7, col: 1 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 1, col: 2 }, digits: [1] },
      { pos: { row: 2, col: 2 }, digits: [1] },
      { pos: { row: 6, col: 1 }, digits: [1] },
      { pos: { row: 7, col: 1 }, digits: [1] },
    ],
  },
  description:
    'Pick a number and find two rows where it can only go in exactly two cells each. If one cell from each row lies in the same column, that column can hold the number only once — meaning the number must go in one of the two cells not in the shared column. Any cell that can see both of those outer cells cannot hold the number. The same works with two columns sharing a row.',
};
