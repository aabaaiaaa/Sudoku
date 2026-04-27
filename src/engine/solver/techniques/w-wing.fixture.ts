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
 * W-Wing fixture (Classic 9x9).
 *
 * The givens leave two bivalue cells {1, 2} connected by a strong link on 2:
 *   - bivalue   R1C1 = {1, 2}
 *   - bivalue   R3C9 = {1, 2}
 * In column 5, digit 2 is restricted to exactly two cells:
 *   - R1C5 (sees R1C1 via row 1)
 *   - R3C5 (sees R3C9 via row 3)
 * Whichever end of the strong link holds 2, the bivalue cell on the same row
 * is forced to 1 — so 1 can be eliminated from any cell that sees both
 * bivalue cells. The only such empty cell is R3C3.
 *
 *   . . . | . . . | 5 6 7
 *   4 5 6 | . 1 . | 8 9 .
 *   7 8 . | . . . | . . .
 *   ------+-------+------
 *   9 . . | . . . | . . .
 *   . . . | 2 . . | . . 3
 *   3 . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . 4
 *   . . . | . . 2 | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '......567' +
    '456.1.89.' +
    '78.......' +
    '9........' +
    '...2....3' +
    '3........' +
    '........4' +
    '.....2...' +
    '.........',
  patternCells: [
    { row: 0, col: 0 },
    { row: 2, col: 8 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 2, col: 2 }, digits: [1] },
    ],
  },
  description:
    'Two bivalue cells with the same two candidates {X, Y} connected by a strong link on Y — a house where Y must appear in one of two cells, each of which sees one of the bivalue cells. Whichever cell of the strong link is Y, the bivalue it sees is forced to X; therefore X can be eliminated from any cell that sees both bivalue cells.',
};
