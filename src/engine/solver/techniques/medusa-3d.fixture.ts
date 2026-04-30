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
 * 3D Medusa fixture (Classic 9×9), spanning digits 1 and 5.
 *
 * The givens leave four empty cells in the top-left 2×2 corner, each with
 * candidates exactly {1, 5}: R1C1, R1C2, R2C1, R2C2. Row 1 elsewhere holds
 * {2,3,4,6,7,8,9}; row 2 elsewhere holds the same set; column 1 below row 2
 * holds {3,6,7,8,9,2,4} (any permutation of {2,3,4,6,7,8,9}); column 2 below
 * row 2 holds another permutation; box 1's other cells (R3C1=3, R3C2=4,
 * R3C3=8, plus R1C3=2 and R2C3=6) avoid both 1 and 5.
 *
 * The 3D-Medusa graph contains:
 *   - **Cell links** (each empty cell is bivalue {1,5}): 1@R1C1—5@R1C1,
 *     1@R1C2—5@R1C2, 1@R2C1—5@R2C1, 1@R2C2—5@R2C2.
 *   - **House links** (each strong-link house has exactly two candidate cells):
 *     row 1 on digits 1 and 5 (R1C1↔R1C2 each); row 2 on 1 and 5 (R2C1↔R2C2);
 *     column 1 on 1 and 5 (R1C1↔R2C1); column 2 on 1 and 5 (R1C2↔R2C2).
 *
 * All eight nodes form one bipartite component. Two-coloured starting at
 * 1@R1C1 = A, BFS produces:
 *
 *   A = { 1@R1C1, 5@R1C2, 5@R2C1, 1@R2C2 }
 *   B = { 5@R1C1, 1@R1C2, 1@R2C1, 5@R2C2 }
 *
 * Box 1 contains all four cluster cells. For digit 1 in box 1, colour A holds
 * R1C1 and R2C2 — both colour A, both digit 1, both in box 1. So colour A
 * cannot be true (digit 1 would appear twice in box 1). All colour-A
 * candidates are eliminated:
 *
 *   - digit 1 from R1C1
 *   - digit 5 from R1C2
 *   - digit 5 from R2C1
 *   - digit 1 from R2C2
 *
 * After the eliminations each cell becomes a naked single, fixing the corner.
 *
 *   . . 2 | 3 4 6 | 7 8 9
 *   . . 6 | 7 8 9 | 2 3 4
 *   3 4 8 | . . . | . . .
 *   ------+-------+------
 *   6 2 . | . . . | . . .
 *   7 3 . | . . . | . . .
 *   8 9 . | . . . | . . .
 *   ------+-------+------
 *   9 6 . | . . . | . . .
 *   2 7 . | . . . | . . .
 *   4 8 . | . . . | . . .
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '..2346789' +
    '..6789234' +
    '348......' +
    '62.......' +
    '73.......' +
    '89.......' +
    '96.......' +
    '27.......' +
    '48.......',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 1 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [1] },
      { pos: { row: 0, col: 1 }, digits: [5] },
      { pos: { row: 1, col: 0 }, digits: [5] },
      { pos: { row: 1, col: 1 }, digits: [1] },
    ],
  },
  description:
    'Build a graph whose nodes are every candidate (cell, digit) and whose strong links join two nodes that cannot both be false. Two kinds of strong link feed the graph: a bivalue cell joins its two candidates, and a house with exactly two candidates for some digit joins those two cells for that digit. Two-colour each connected component. If a colour ever places the same digit twice in a single house, or two digits inside a single cell, that colour cannot be true and every candidate of that colour is eliminated. Otherwise, any non-cluster candidate that sees both colours of its own digit is also eliminated.',
};
