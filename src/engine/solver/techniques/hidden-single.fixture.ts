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
 * Hidden Single fixture (Classic 9x9).
 *
 * Digit 9 is placed elsewhere on the grid so that within box 0 the only cell
 * that can still hold 9 is (0,0):
 *  - 9 at (1,3) blocks 9 from row 1 inside box 0.
 *  - 9 at (2,4) blocks 9 from row 2 inside box 0.
 *  - 9 at (3,1) blocks 9 from column 1 inside box 0.
 *  - 9 at (4,2) blocks 9 from column 2 inside box 0.
 *
 * Cell (0,0) still has many candidates overall, but it is the only cell of
 * box 0 that can hold 9 — a hidden single.
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '...9.....' +
    '....9....' +
    '.9.......' +
    '..9......' +
    '.........' +
    '.........' +
    '.........' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 0, col: 2 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 1, col: 2 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 0 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 2 }, role: 'pattern-primary' },
  ],
  deduction: {
    placement: { pos: { row: 0, col: 0 }, digit: 9 },
  },
  description:
    'Within a row, column, or box, a digit that has only one remaining candidate cell — even if that cell still has other candidates. Place the digit there.',
};
