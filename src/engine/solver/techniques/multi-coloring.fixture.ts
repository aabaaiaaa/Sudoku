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
 * Multi-Coloring fixture (Classic 9x9), digit 1.
 *
 * Rows 1 and 6 are filled with non-1 givens at all columns except 4 and 7
 * (1-indexed), so digit 1 in each of those two rows is confined to a strong
 * link (conjugate pair) between the empty cells. The two strong links produce
 * two separate connected components in the digit-1 strong-link graph:
 *
 *   - Cluster 1: row 1, edge R1C4 — R1C7. Two-coloured A = {R1C4}, B = {R1C7}.
 *   - Cluster 2: row 6, edge R6C4 — R6C7. Two-coloured A = {R6C4}, B = {R6C7}.
 *
 * Columns 4 and 7 are otherwise empty, so digit 1 remains a candidate at every
 * other row of those columns. Column 4 is therefore *not* a strong-link house
 * (it has more than two candidates), so the cells R1C4 and R6C4 — both colour
 * A in their respective clusters — share column 4 across clusters without
 * being merged into a single component.
 *
 * Because R1C4 (cluster 1, colour A) and R6C4 (cluster 2, colour A) share
 * column 4, both cannot be the digit simultaneously. So at least one of the
 * opposite colours holds the 1: cluster 1 colour B (R1C7) or cluster 2 colour
 * B (R6C7). Any cell that sees R1C7 *and* R6C7 — that is, every cell of
 * column 7 outside the two cluster cells — therefore cannot hold the digit.
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
    { pos: { row: 0, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 6 }, role: 'pattern-primary' },
    { pos: { row: 5, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 5, col: 6 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 1, col: 6 }, digits: [1] },
      { pos: { row: 2, col: 6 }, digits: [1] },
      { pos: { row: 3, col: 6 }, digits: [1] },
      { pos: { row: 4, col: 6 }, digits: [1] },
      { pos: { row: 6, col: 6 }, digits: [1] },
      { pos: { row: 7, col: 6 }, digits: [1] },
      { pos: { row: 8, col: 6 }, digits: [1] },
    ],
  },
  description:
    'Pick a digit and build its strong-link graph: two cells share an edge whenever they are the only candidates for that digit in some house. Two-colour each connected component (cluster). If a cell of one colour in one cluster shares a house with a cell of one colour in another cluster — so neither pair of "true" cells can both hold the digit — then at least one of the *opposite* colours must hold it. Any cell that sees both opposite-colour cells therefore cannot be the digit.',
};
