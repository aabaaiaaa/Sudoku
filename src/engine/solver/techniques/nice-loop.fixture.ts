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
 * Nice Loop fixture (Classic 9×9), continuous case.
 *
 * Rows 1 and 6 are filled so that each row contains every digit except 1 and
 * 9, with the gaps at columns 4 and 7. Combined with empty columns 4 and 7,
 * this leaves four bivalue cells at the rectangle corners — R1C4, R1C7, R6C4,
 * R6C7 — each with candidates {1, 9}.
 *
 * The candidate graph contains a continuous nice loop on six nodes:
 *
 *   (R1C4,1) -[strong, cell R1C4]- (R1C4,9) -[weak, row 1]- (R1C7,9)
 *   -[strong, cell R1C7]- (R1C7,1) -[weak, column 7]- (R6C7,1)
 *   -[strong, row 6]- (R6C4,1) -[weak, column 4]- (R1C4,1)
 *
 * The two intra-cell strong links (at the bivalue corners R1C4 and R1C7) plus
 * the row-6 conjugate strong link on digit 1 give the alternation
 * S-W-S-W-S-W. The three weak inter-cell links contribute eliminations: the
 * column-7 link eliminates 1 from every other cell of column 7, and the
 * column-4 link eliminates 1 from every other cell of column 4. The two
 * row-1/row-6 weak links contribute nothing because those rows are otherwise
 * filled.
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
    'Treat each (cell, digit) candidate as a node. A strong link connects two nodes when at least one of them must be true (a bivalue cell between its two digits, or a digit conjugate in some house between its two cells). A weak link connects two nodes when at most one of them can be true (any two digits sharing a cell, or any two cells of a house both holding a digit). A nice loop is a closed cycle whose edges alternate strong/weak. When the alternation wraps cleanly all the way around (continuous), every weak link tightens to "exactly one true": for inter-cell weak links, the digit can be removed from any cell outside the loop seeing both endpoints; for intra-cell weak links, every other candidate of the cell can be removed.',
};
