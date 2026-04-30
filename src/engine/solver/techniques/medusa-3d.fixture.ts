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
 * 3D Medusa fixture (Classic 9×9), colour-twice-in-house contradiction.
 *
 * Cluster cells:
 *   R1C1 = {1,2},  R1C2 = {1,2},  R2C1 = {1,3},  R2C8 = {1,2},  R4C1 = {2,5}
 *
 * Strong links that seed the graph:
 *   row 1, digit 1 : R1C1 ↔ R1C2  (only two cand-1 cells in row 1)
 *   row 1, digit 2 : R1C1 ↔ R1C2  (only two cand-2 cells in row 1)
 *   col 1, digit 1 : R1C1 ↔ R2C1  (only two cand-1 cells in col 1)
 *   col 1, digit 2 : R1C1 ↔ R4C1  (only two cand-2 cells in col 1)
 *   Cell links (each bivalue cell):
 *     R1C1 : 1—2,  R1C2 : 1—2,  R2C1 : 1—3,  R2C8 : 1—2,  R4C1 : 2—5
 *
 * BFS starts at the lowest node (1@R1C1 = A) and propagates:
 *   row-1/d1 → 1@R1C2 = B
 *   col-1/d1 → 1@R2C1 = B
 *   cell R1C1 → 2@R1C1 = B
 *   cell R1C2 (from B) → 2@R1C2 = A
 *   cell R2C1 (from B) → 3@R2C1 = A
 *   col-1/d2 from 2@R1C1=B → 2@R4C1 = A
 *   cell R4C1 (from A) → 5@R4C1 = B
 *   row-2/d1 (R2C1=B has 1; is there another cand-1 in row 2?) → 1@R2C8 = A
 *   cell R2C8 (from A) → 2@R2C8 = B
 *
 *   ColorA = { 1@R1C1, 2@R1C2, 1@R2C8, 2@R4C1 }
 *   ColorB = { 2@R1C1, 1@R1C2, 1@R2C1, 5@R4C1, 2@R2C8 }
 *
 * Rule 2 fires for digit 1, box 1 (rows 1–3, cols 1–3):
 *   ColorB has 1@R1C2 and 1@R2C1 — two colour-B nodes with digit 1 in box 1.
 *   → invalidColor = B
 *
 * All colour-B candidates are eliminated:
 *   digit 2 from R1C1  (was cand {1,2} → forced to 1)
 *   digit 1 from R1C2  (was cand {1,2} → forced to 2)
 *   digit 1 from R2C1  (was cand {1,3} → forced to 3)
 *
 *   . . 4 | 5 6 7 | 8 9 3
 *   . 5 6 | 2 8 9 | 4 . 7
 *   7 8 9 | 1 3 4 | 2 5 6
 *   ------+-------+------
 *   . 6 1 | 3 4 8 | 9 7 .
 *   3 . . | . . . | . . 1
 *   4 . . | . . . | . . 2
 *   ------+-------+------
 *   5 . . | . . . | . . .
 *   6 . . | . . . | . . .
 *   8 . . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '..4567893' +
    '.562894.7' +
    '789134256' +
    '.6134897.' +
    '3.......1' +
    '4.......2' +
    '5........' +
    '6........' +
    '8........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 7 }, role: 'pattern-primary' },
    { pos: { row: 3, col: 0 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [2] },
      { pos: { row: 0, col: 1 }, digits: [1] },
      { pos: { row: 1, col: 0 }, digits: [1] },
    ],
  },
  description:
    'Build a graph whose nodes are every candidate (cell, digit) and whose strong links join two nodes that cannot both be false. Two kinds of strong link feed the graph: a bivalue cell joins its two candidates, and a house with exactly two candidates for some digit joins those two cells for that digit. Two-colour each connected component. If a colour ever places the same digit twice in a single house, or two digits inside a single cell, that colour cannot be true and every candidate of that colour is eliminated. Otherwise, any non-cluster candidate that sees both colours of its own digit is also eliminated.',
};
