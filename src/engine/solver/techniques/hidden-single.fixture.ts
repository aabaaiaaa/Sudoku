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
 * Hidden Single fixture (Classic 9x9).
 *
 * Digit 9 is placed at four positions in distinct rows, columns, and boxes,
 * eliminating it from all box-0 cells except (0,0):
 *  - 9 at (1,4): blocks row 1 inside box 0; fills box 1, so (0,3)-(0,5)
 *    in row 0 also lose digit 9.
 *  - 9 at (2,7): blocks row 2 inside box 0; fills box 2, so (0,6)-(0,8)
 *    in row 0 also lose digit 9.
 *  - 9 at (4,1): blocks column 1, so (0,1) loses digit 9.
 *  - 9 at (7,2): blocks column 2, so (0,2) loses digit 9.
 *
 * In row 0, digit 9 has exactly one candidate: (0,0). The finder returns a
 * row hidden single — (0,0) is the only cell in row 1 that can be 9.
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '.........' +
    '....9....' +
    '.......9.' +
    '.........' +
    '.9.......' +
    '.........' +
    '.........' +
    '..9......' +
    '.........',
  roles: [
    { pos: { row: 0, col: 0 }, role: 'placement' },
    { pos: { row: 1, col: 4 }, role: 'pattern-primary' },
    { pos: { row: 2, col: 7 }, role: 'pattern-primary' },
    { pos: { row: 4, col: 1 }, role: 'pattern-primary' },
    { pos: { row: 7, col: 2 }, role: 'pattern-primary' },
  ],
  deduction: {
    placement: { pos: { row: 0, col: 0 }, digit: 9 },
  },
  description:
    'In a row, column, or box, look for a digit that can go in only one empty cell. Even if that cell still has other options, the digit belongs there.',
};
