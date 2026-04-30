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
  roles: [
    { pos: { row: 0, col: 3 }, role: 'chain-link' },
    { pos: { row: 0, col: 6 }, role: 'chain-link' },
    { pos: { row: 5, col: 3 }, role: 'chain-link' },
    { pos: { row: 5, col: 6 }, role: 'chain-link' },
    { pos: { row: 1, col: 3 }, role: 'elimination' },
    { pos: { row: 1, col: 6 }, role: 'elimination' },
    { pos: { row: 2, col: 3 }, role: 'elimination' },
    { pos: { row: 2, col: 6 }, role: 'elimination' },
    { pos: { row: 3, col: 3 }, role: 'elimination' },
    { pos: { row: 3, col: 6 }, role: 'elimination' },
    { pos: { row: 4, col: 3 }, role: 'elimination' },
    { pos: { row: 4, col: 6 }, role: 'elimination' },
    { pos: { row: 6, col: 3 }, role: 'elimination' },
    { pos: { row: 6, col: 6 }, role: 'elimination' },
    { pos: { row: 7, col: 3 }, role: 'elimination' },
    { pos: { row: 7, col: 6 }, role: 'elimination' },
    { pos: { row: 8, col: 3 }, role: 'elimination' },
    { pos: { row: 8, col: 6 }, role: 'elimination' },
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
    'Trace a closed loop of cells for one number: each step between consecutive cells is either a must (the number fits only those two cells in a row, column, or box) or a maybe (both cells share a row, column, or box and both still allow the number). Alternate must and maybe steps all the way around the loop. If the loop closes evenly, remove the number from any cell outside the loop that can see both ends of a maybe step. If one cell has two must-steps meeting it, place the number there; if one cell has two maybe-steps meeting it, remove it from that cell.',
};
