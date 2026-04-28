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
 * Forcing Chains fixture (Classic 9x9). Source bivalue cell R1C1 = {1, 2};
 * each candidate, propagated through naked/hidden singles, places 4 at R1C4.
 *
 * Givens leave row 1 with these candidate sets (the row already holds 5-9 at
 * R1C5..R1C9, and column / box constraints elsewhere narrow the rest):
 *   R1C1 = {1, 2}   (the source — 1 placed elsewhere in column 1; 4 in box 1)
 *   R1C2 = {1, 3}   (column 2 has 2, 4)
 *   R1C3 = {2, 3}   (column 3 has 1; box 1 has 4)
 *   R1C4 = {3, 4}   (column 4 has 1, 2; box 2 has 1, 2, 5, 6)
 *
 * Branch R1C1 = 1:
 *   R1C2 loses 1 (peer) → R1C2 = {3}, place R1C2 = 3
 *   R1C3 loses 3 (peer) → R1C3 = {2}, place R1C3 = 2
 *   R1C4 loses 3 (peer) → R1C4 = {4}, place R1C4 = 4
 *
 * Branch R1C1 = 2:
 *   R1C3 loses 2 (peer) → R1C3 = {3}, place R1C3 = 3
 *   R1C2 loses 3 (peer) → R1C2 = {1}, place R1C2 = 1
 *   R1C4 loses 3 (peer) → R1C4 = {4}, place R1C4 = 4
 *
 * Both branches converge on R1C4 = 4, so R1C4 = 4 is forced regardless of
 * which value the source takes.
 *
 *   .  .  .  | .  5  6  | 7  8  9
 *   .  .  .  | 1  .  .  | .  .  .
 *   .  4  .  | 2  .  .  | .  .  .
 *   ---------+----------+---------
 *   3  .  1  | .  .  .  | .  .  .
 *   .  2  .  | .  .  .  | .  .  .
 *   .  .  .  | .  .  .  | .  .  .
 *   ---------+----------+---------
 *   .  .  .  | .  .  .  | .  .  .
 *   .  .  .  | .  .  .  | .  .  .
 *   .  .  .  | .  .  .  | .  .  .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '....56789' +
    '...1.....' +
    '.4.2.....' +
    '3.1......' +
    '.2.......' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  patternCells: [{ row: 0, col: 0 }],
  deduction: {
    placement: { pos: { row: 0, col: 3 }, digit: 4 },
  },
  description:
    'A forcing chain picks a cell with several candidates and, for each candidate, follows the logical implications (naked and hidden singles) that flow from placing that digit. If every branch eventually places the same digit at the same target cell, that placement is forced regardless of which candidate the source actually takes; equivalently, if every branch eliminates the same digit from the same cell, that elimination is forced. The technique caps the chain depth so the search stays bounded.',
};
