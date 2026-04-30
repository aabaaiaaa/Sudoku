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
 * Grouped X-Cycle fixture (Classic 9×9), continuous case on digit 1.
 *
 * Row 2 (1-indexed) is filled so its only empty cells are R2C1, R2C2, R2C6,
 * leaving digit 1 as a candidate at exactly those three cells. Within box 1
 * (rows 1-3, columns 1-3), R2C3 is filled, so the box-1 row-2 intersection
 * is the **two-cell group** G = {R2C1, R2C2}. Together with the lone digit-1
 * candidate R2C6 in box 2, row 2 has only three digit-1 candidates, all in
 * G ∪ {R2C6} — a strong link in row 2 between G and R2C6.
 *
 * Row 3 is filled so its only empty cells are R3C3 and R3C6, both digit-1
 * candidates: a single-cell strong link in row 3 between R3C3 and R3C6.
 *
 * The four nodes form a continuous nice loop:
 *
 *   G -[strong, row 2]- R2C6 -[weak, column 6]- R3C6
 *     -[strong, row 3]- R3C3 -[weak, box 1]- G
 *
 * The two weak links contribute eliminations:
 *   - column 6 (weak) at R2C6 ↔ R3C6: every cell of column 6 outside the
 *     loop that has digit 1 as candidate, plus the empty box-2 cells of
 *     row 1 (R1C4, R1C5, R1C6), which share box 2 with both endpoints.
 *   - box 1 (weak) at R3C3 ↔ G: the empty box-1 cells of row 1 (R1C1, R1C2,
 *     R1C3) — they share box 1 with R3C3 and with both cells of G.
 *
 * Concretely, digit 1 is eliminated from R1C1, R1C2, R1C3, R1C4, R1C5, R1C6,
 * R4C6, R5C6, R6C6, R7C6, R8C6, R9C6 (1-indexed) — twelve cells.
 *
 *   . . . | . . . | . . .
 *   . . 2 | 3 4 . | 6 7 8
 *   5 6 . | 7 8 . | 2 3 4
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '..234.678' +
    '56.78.234' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 1, col: 0 }, role: 'chain-link' },
    { pos: { row: 1, col: 1 }, role: 'chain-link' },
    { pos: { row: 1, col: 5 }, role: 'chain-link' },
    { pos: { row: 2, col: 2 }, role: 'chain-link' },
    { pos: { row: 2, col: 5 }, role: 'chain-link' },
    { pos: { row: 0, col: 0 }, role: 'elimination' },
    { pos: { row: 0, col: 1 }, role: 'elimination' },
    { pos: { row: 0, col: 2 }, role: 'elimination' },
    { pos: { row: 0, col: 3 }, role: 'elimination' },
    { pos: { row: 0, col: 4 }, role: 'elimination' },
    { pos: { row: 0, col: 5 }, role: 'elimination' },
    { pos: { row: 3, col: 5 }, role: 'elimination' },
    { pos: { row: 4, col: 5 }, role: 'elimination' },
    { pos: { row: 5, col: 5 }, role: 'elimination' },
    { pos: { row: 6, col: 5 }, role: 'elimination' },
    { pos: { row: 7, col: 5 }, role: 'elimination' },
    { pos: { row: 8, col: 5 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [1] },
      { pos: { row: 0, col: 1 }, digits: [1] },
      { pos: { row: 0, col: 2 }, digits: [1] },
      { pos: { row: 0, col: 3 }, digits: [1] },
      { pos: { row: 0, col: 4 }, digits: [1] },
      { pos: { row: 0, col: 5 }, digits: [1] },
      { pos: { row: 3, col: 5 }, digits: [1] },
      { pos: { row: 4, col: 5 }, digits: [1] },
      { pos: { row: 5, col: 5 }, digits: [1] },
      { pos: { row: 6, col: 5 }, digits: [1] },
      { pos: { row: 7, col: 5 }, digits: [1] },
      { pos: { row: 8, col: 5 }, digits: [1] },
    ],
  },
  description:
    'Look for a closed loop of cells for one number, just like in X-Cycle, except some of the loop\'s steps can start or end at a small group of two or three cells in the same box that all share a row or column — when the number must land in exactly that group, treat the whole group as a single stop in the loop. Alternate must and maybe steps around the loop, where a must step involving a group means the number can only be in that group or the single cell it pairs with in a shared row, column, or box. Remove the number from any cell outside the loop that can see every cell in both ends of a maybe step.',
};
