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
 * XY-Chain fixture (Classic 9x9). Length-4 chain on Z = 3.
 *
 * The givens leave four bivalue cells that form a single chain:
 *   - R1C2 = {1, 3}   (start; carries Z = 3)
 *   - R4C2 = {1, 2}   (shares column 2 with R1C2; link digit 1)
 *   - R4C8 = {2, 4}   (shares row 4 with R4C2;    link digit 2)
 *   - R9C8 = {3, 4}   (shares column 8 with R4C8; link digit 4; ends with Z)
 *
 * Walk the chain starting at R1C2: if R1C2 = 3 we are done. Otherwise R1C2 = 1,
 * which forces R4C2 = 2, which forces R4C8 = 4, which forces R9C8 = 3.
 * Whichever way the chain resolves, one of the endpoints {R1C2, R9C8} is 3, so
 * 3 can be eliminated from any cell that sees both endpoints. The two such
 * cells with 3 still present as a candidate are R1C8 (sees R1C2 by row 1 and
 * R9C8 by column 8) and R9C2 (sees R1C2 by column 2 and R9C8 by row 9).
 *
 *   2 . . | . . . | . . .
 *   . 4 . | . . . | . 5 .
 *   . 5 . | . . . | . . .
 *   ------+-------+------
 *   3 . . | . . . | . . .
 *   . 6 . | . . . | . 7 .
 *   . 7 . | . . . 6 8 .
 *   ------+-------+------
 *   . 8 . | . . . | . 9 2
 *   . 9 . | . . . | . 1 .
 *   . . . | . . . | . . 6
 */
export const fixture: TechniqueFixture = {
  variant: 'classic',
  board:
    '2........' +
    '.4.....5.' +
    '.5.......' +
    '3........' +
    '.6.....7.' +
    '.7....68.' +
    '.8.....92' +
    '.9.....1.' +
    '........6',
  roles: [
    { pos: { row: 0, col: 1 }, role: 'chain-link' },
    { pos: { row: 3, col: 1 }, role: 'chain-link' },
    { pos: { row: 3, col: 7 }, role: 'chain-link' },
    { pos: { row: 8, col: 7 }, role: 'chain-link' },
    { pos: { row: 0, col: 7 }, role: 'elimination' },
    { pos: { row: 8, col: 1 }, role: 'elimination' },
  ],
  deduction: {
    eliminations: [
      { pos: { row: 0, col: 7 }, digits: [3] },
      { pos: { row: 8, col: 1 }, digits: [3] },
    ],
  },
  description:
    'Find a chain of cells where each one has only two possible numbers and shares a row, column, or box with the next step in the chain. If the same number appears at both ends of the chain, one of the two end cells must hold it — no matter how the chain resolves, one endpoint is forced to that number. Remove that number from any empty cell that can see both ends of the chain.',
};
