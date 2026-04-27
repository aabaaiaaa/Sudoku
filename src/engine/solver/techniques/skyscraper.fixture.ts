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
  patternCells: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 8, col: 0 },
    { row: 8, col: 2 },
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
    'Pick a digit and look for two rows where the digit has exactly two candidate cells each, with one shared column. The shared column is the "base", and the two non-shared cells are the "roofs". Because the base column can only hold the digit once, at least one of the two roofs must hold the digit — so any cell that sees both roofs (via row, column, or box) cannot hold the digit and is eliminated. The mirror works for two columns sharing one row.',
};
