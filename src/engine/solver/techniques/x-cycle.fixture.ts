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
 * X-Cycle fixture (Classic 9x9), continuous nice loop on digit 1.
 *
 * Rows 1 and 6 are filled so that the only empty cells in each row are at
 * columns 4 and 7 (1-indexed). Row 1 is missing {1, 9} and row 6 is missing
 * {1, 9}, so digit 1 in each of those two rows is a strong link between the
 * cells at columns 4 and 7. The two strong links combine through the columns
 * to form a four-cell alternating cycle:
 *
 *   R1C4 -[strong, row 1]- R1C7 -[weak, column 7]- R6C7 -[strong, row 6]-
 *   R6C4 -[weak, column 4]- R1C4
 *
 * Both column 4 and column 7 are otherwise free of givens, so digit 1 remains
 * a candidate in every other row of those columns. The continuous cycle's
 * weak links eliminate digit 1 from every cell of columns 4 and 7 in rows
 * 2-5 and 7-9.
 *
 *   2 3 4 | . 5 6 | . 7 8
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   5 6 7 | . 8 2 | . 3 4
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '234.56.78' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '567.82.34' +
    '.........' +
    '.........' +
    '.........',
  patternCells: [
    { row: 0, col: 3 },
    { row: 0, col: 6 },
    { row: 5, col: 3 },
    { row: 5, col: 6 },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 1, col: 3 }, digits: [1] },
      { pos: { row: 1, col: 6 }, digits: [1] },
      { pos: { row: 2, col: 3 }, digits: [1] },
      { pos: { row: 2, col: 6 }, digits: [1] },
      { pos: { row: 3, col: 3 }, digits: [1] },
      { pos: { row: 3, col: 6 }, digits: [1] },
      { pos: { row: 4, col: 3 }, digits: [1] },
      { pos: { row: 4, col: 6 }, digits: [1] },
      { pos: { row: 6, col: 3 }, digits: [1] },
      { pos: { row: 6, col: 6 }, digits: [1] },
      { pos: { row: 7, col: 3 }, digits: [1] },
      { pos: { row: 7, col: 6 }, digits: [1] },
      { pos: { row: 8, col: 3 }, digits: [1] },
      { pos: { row: 8, col: 6 }, digits: [1] },
    ],
  },
  description:
    'Pick a digit. Build its link graph: a "strong" link joins two cells when the digit appears in only those two cells of some house, and a "weak" link joins any two cells of the same house that both have the digit as a candidate. A closed alternating chain of strong/weak links is an X-Cycle. When the alternation is consistent all the way around the loop (continuous), the digit can be removed from any cell outside the cycle that sees both endpoints of any weak link in the cycle. When the alternation breaks at one cell (discontinuous), that cell is forced — two strong links meeting there place the digit there, two weak links meeting there eliminate it.',
};
