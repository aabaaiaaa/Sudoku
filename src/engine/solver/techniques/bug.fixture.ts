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
 * BUG+1 fixture (Classic 9x9).
 *
 * Eight cells are unsolved: R1C1, R1C2, R1C3, R4C1, R4C2, R4C3, R7C2, R7C3.
 * Seven of them are bivalue and one — R1C2 — is the "+1" cell with three
 * candidates {1, 2, 3}.
 *
 * Candidate map:
 *   R1C1 = {1, 2}     (row 1 missing {1,2,3}; col 1 missing {1,2})
 *   R1C2 = {1, 2, 3}  (the +1 cell — row, column and box 1 all miss {1,2,3})
 *   R1C3 = {1, 3}     (col 3 missing {1,3,4} cuts it down)
 *   R4C1 = {1, 2}
 *   R4C2 = {1, 2}
 *   R4C3 = {1, 4}     (row 4 missing {1,2,4}; col 3 cut to {1,4})
 *   R7C2 = {1, 3}     (row 7 missing {1,3}; box 7 missing {1,3})
 *   R7C3 = {1, 3}
 *
 * In R1C2's three houses (row 1, column 2, box 1) digit 1 appears in three
 * candidate cells while 2 and 3 each appear only twice — placing 2 or 3 at
 * R1C2 would leave a bivalue grid where every digit appears exactly twice in
 * every relevant house, a deadly pattern with two solutions. R1C2 must be 1.
 *
 * Solution grid the fixture is built from:
 *
 *   1 2 3 | 4 5 6 | 7 8 9
 *   4 5 6 | 7 8 9 | 1 2 3
 *   7 8 9 | 1 2 3 | 4 5 6
 *   ------+-------+------
 *   2 1 4 | 3 6 5 | 8 9 7
 *   3 6 5 | 8 9 7 | 2 1 4
 *   8 9 7 | 2 1 4 | 3 6 5
 *   ------+-------+------
 *   5 3 1 | 6 4 2 | 9 7 8
 *   6 4 2 | 9 7 8 | 5 3 1
 *   9 7 8 | 5 3 1 | 6 4 2
 *
 * with R1C1, R1C2, R1C3, R4C1, R4C2, R4C3, R7C2, R7C3 erased.
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '...456789' +
    '456789123' +
    '789123456' +
    '...365897' +
    '365897214' +
    '897214365' +
    '5..642978' +
    '642978531' +
    '978531642',
  patternCells: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 3, col: 0 },
    { row: 3, col: 1 },
    { row: 3, col: 2 },
    { row: 6, col: 1 },
    { row: 6, col: 2 },
  ],
  deduction: {
    placement: { pos: { row: 0, col: 1 }, digit: 1 },
  },
  description:
    'Bivalue Universal Grave +1: when every unsolved cell except one has exactly two candidates, the lone three-candidate cell must take whichever of its candidates would otherwise appear three times in one of its houses (row, column, or box). Placing any other candidate leaves a bivalue pattern that admits multiple solutions, contradicting unique solvability.',
};

/**
 * Pure BUG fixture — same solution grid with only the four corners of the
 * R1/R4 × C1/C2 swap rectangle erased. Every unsolved cell is bivalue {1, 2};
 * there is no "+1" cell, so BUG+1 detection must reject this state. The
 * configuration is genuinely deadly (two solutions exist) and so is never
 * reachable from a uniquely-solvable puzzle, but the candidate grid alone is
 * a valid stress test for the detector.
 */
export const fixturePureBug: Pick<TechniqueFixture, 'variant' | 'board'> = {
  variant: 'classic',
  board:
    '..3456789' +
    '456789123' +
    '789123456' +
    '..4365897' +
    '365897214' +
    '897214365' +
    '531642978' +
    '642978531' +
    '978531642',
};
