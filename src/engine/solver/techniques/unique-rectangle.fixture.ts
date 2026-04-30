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
 * Unique Rectangle Type 1 fixture (Classic 9x9).
 *
 * The four corners (R4C1, R4C4, R5C1, R5C4) sit on a rectangle that spans two
 * boxes (boxes 4 and 5). Three of the corners — R4C1, R4C4, R5C1 — have
 * candidates exactly {1, 2}; the fourth corner R5C4 has candidates {1, 2, 3}.
 * If R5C4 also took 1 or 2, the four corners would all be bivalue {1, 2} and
 * the puzzle could swap 1↔2 across them, contradicting unique solvability.
 * R5C4 must therefore be the extra candidate 3, and 1 and 2 are eliminated
 * from R5C4.
 *
 * Row 4: digits 3-9 are placed (givens 4, 5, 6, 7, 8, 9, 3 at columns 2-8 and
 * 9), leaving 1 and 2 as the only row-candidates at the empty cells R4C1 and
 * R4C4. Row 5 places 4-9 (givens 6, 7, 8, 9, 5, 4) at columns 2, 3, 5, 6, 8,
 * 9, so the row-candidates at the empty cells R5C1, R5C4, R5C7 are {1, 2, 3}.
 * R6C3 = 3 sits inside box 4, which excludes 3 from R5C1 (cutting its
 * candidates to {1, 2}) but does not affect R5C4 — so R5C4 keeps the extra 3.
 *
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . 4 5 | . 6 7 | 8 9 3
 *   . 6 7 | . 8 9 | . 5 4
 *   . . 3 | . . . | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixtureType1: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '.........' +
    '.........' +
    '.45.67893' +
    '.67.89.54' +
    '..3......' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 3, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 3, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 3 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [{ pos: { row: 4, col: 3 }, digits: [1, 2] }],
  },
  description:
    'Spot four cells at the corners of a rectangle that span exactly two boxes, and where three of the corners are bivalue with the same two candidates {X, Y}. The fourth corner has additional candidates beyond {X, Y}. If the fourth corner held X or Y the four cells would form a deadly pattern, giving the puzzle two solutions. The fourth corner must hold one of its other candidates, so X and Y can be eliminated from it.',
};

/**
 * Unique Rectangle Type 2 fixture (Classic 9x9).
 *
 * Rectangle corners (R4C1, R4C4, R5C1, R5C4) span two boxes. Two corners —
 * R4C4 and R5C4 — are bivalue {1, 2} (the floor); the other two — R4C1 and
 * R5C1 — have candidates {1, 2, 3}, sharing the same single extra Z = 3 (the
 * roof). If neither roof held the 3 the four corners would collapse to a
 * deadly {1, 2} pattern, so at least one of R4C1 / R5C1 must be 3.
 *
 * R4C1 and R5C1 share both column 1 and box 4. Any cell that sees both roofs
 * — i.e., other empty cells in column 1 — therefore cannot be 3. Row 4 is
 * missing {1, 2, 3} (R4C1 and R4C4 empty plus R4C8 not used here — actually
 * R4 uses only digits 4-9, six placements), and row 5 mirrors that pattern;
 * R6C6 = 3 sits in box 5, excluding 3 from R4C4 / R5C4 (the floor), but
 * leaving the roofs intact at {1, 2, 3}.
 *
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . 4 5 | . 6 7 | 8 9 .
 *   . 6 7 | . 8 9 | . 5 4
 *   . . . | . . 3 | . . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixtureType2: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '.........' +
    '.........' +
    '.45.6789.' +
    '.67.89.54' +
    '.....3...' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 3, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 3, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 3 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 0 }, digits: [3] },
      { pos: { row: 1, col: 0 }, digits: [3] },
      { pos: { row: 2, col: 0 }, digits: [3] },
      { pos: { row: 6, col: 0 }, digits: [3] },
      { pos: { row: 7, col: 0 }, digits: [3] },
      { pos: { row: 8, col: 0 }, digits: [3] },
    ],
  },
  description:
    'Spot four cells at the corners of a rectangle that span exactly two boxes, where two of the corners are bivalue {X, Y} and the other two each carry the same single extra candidate Z. To avoid the deadly {X, Y} pattern, at least one of the two extras-cells must hold Z, so any cell that sees both of those cells cannot be Z and may be eliminated.',
};

/**
 * Unique Rectangle Type 4 fixture (Classic 9x9).
 *
 * Rectangle corners (R4C1, R4C4, R5C1, R5C4) span two boxes. Two corners —
 * R4C1 and R4C4 — are bivalue {1, 2} (the floor in row 4); the other two —
 * R5C1 and R5C4 — have candidates {1, 2, 3} (the roof in row 5). Row 5 is
 * missing only {1, 2, 3}, with R5C7 the only other empty cell in row 5.
 * R6C7 = 1 sits in box 6, removing 1 from R5C7's candidates and leaving R5C7
 * with just {2} — so within row 5, digit 1 is confined to the two roof cells
 * R5C1 and R5C4.
 *
 * Whichever roof holds the 1, the other roof cannot also hold 2 (that would
 * complete the deadly {1, 2} pattern across all four corners). So 2 can be
 * eliminated from both R5C1 and R5C4.
 *
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   ------+-------+------
 *   . 4 5 | . 6 7 | 8 9 3
 *   . 6 7 | . 8 9 | . 4 5
 *   . . . | . . . | 1 . .
 *   ------+-------+------
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 *   . . . | . . . | . . .
 */
export const fixtureType4: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '.........' +
    '.........' +
    '.45.67893' +
    '.67.89.45' +
    '......1..' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 3, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 3, col: 3 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 3 }, role: 'pattern-primary' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 4, col: 0 }, digits: [2] },
      { pos: { row: 4, col: 3 }, digits: [2] },
    ],
  },
  description:
    'Spot four cells at the corners of a rectangle that span exactly two boxes, where two of the corners are bivalue {X, Y} and the other two share a row, column, or box. If, in that shared house, one of the digits {X, Y} is confined to only those two cells, then the other digit can be eliminated from both — otherwise the four corners would collapse into the deadly {X, Y} pattern.',
};

/** Default fixture used by the help-screen detail page. */
export const fixture: TechniqueFixture = fixtureType1;
