import { describe, it, expect } from 'vitest';
import { findXWing, type XWingElimination } from './x-wing';
import { createEmptyBoard } from '../../types';
import { classicVariant } from '../../variants';
import type { Position } from '../../types';

function findElim(
  eliminations: XWingElimination[],
  pos: Position,
): XWingElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findXWing', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findXWing(board)).toBeNull();
  });

  it('finds a row-based X-wing and yields column eliminations', () => {
    // Classic X-wing fixture for digit 1: rows 0 and 5 are filled so that the
    // only empty cells in each row are at columns 3 and 6, forcing digit 1 to
    // occupy one of those two columns in each row.
    const board = createEmptyBoard(classicVariant);
    //              col:  0  1  2  3  4  5  6  7  8
    const row0 =        [ 2, 3, 4, 0, 5, 6, 0, 7, 8];
    const row5 =        [ 5, 6, 7, 0, 8, 2, 0, 3, 4];
    for (let c = 0; c < 9; c++) {
      if (row0[c] !== 0) board.cells[0][c].value = row0[c];
      if (row5[c] !== 0) board.cells[5][c].value = row5[c];
    }

    const result = findXWing(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('x-wing');
    expect(result!.digit).toBe(1);
    expect(result!.orientation).toBe('rows');
    expect(result!.baseHouses).toEqual([0, 5]);
    expect(result!.coverHouses).toEqual([3, 6]);
    expect(result!.cells).toEqual([
      { row: 0, col: 3 },
      { row: 0, col: 6 },
      { row: 5, col: 3 },
      { row: 5, col: 6 },
    ]);

    // Digit 1 should be eliminated from columns 3 and 6 in every row other
    // than the two base rows.
    for (const r of [1, 2, 3, 4, 6, 7, 8]) {
      for (const c of [3, 6]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }

    // The four corner cells themselves must not appear as eliminations.
    for (const r of [0, 5]) {
      for (const c of [3, 6]) {
        expect(findElim(result!.eliminations, { row: r, col: c })).toBeUndefined();
      }
    }

    expect(result!.explanation).toContain('X-wing');
    expect(result!.explanation).toContain('rows 1 and 6');
    expect(result!.explanation).toContain('columns 4 and 7');
  });

  it('finds a column-based X-wing and yields row eliminations', () => {
    // Mirror of the row-based fixture: columns 0 and 5 are filled such that
    // digit 1 is confined to rows 3 and 6 in each column.
    const board = createEmptyBoard(classicVariant);
    //              row:  0  1  2  3  4  5  6  7  8
    const col0 =        [ 2, 3, 4, 0, 5, 6, 0, 7, 8];
    const col5 =        [ 5, 6, 7, 0, 8, 2, 0, 3, 4];
    for (let r = 0; r < 9; r++) {
      if (col0[r] !== 0) board.cells[r][0].value = col0[r];
      if (col5[r] !== 0) board.cells[r][5].value = col5[r];
    }

    const result = findXWing(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('x-wing');
    expect(result!.digit).toBe(1);
    expect(result!.orientation).toBe('cols');
    expect(result!.baseHouses).toEqual([0, 5]);
    expect(result!.coverHouses).toEqual([3, 6]);
    expect(result!.cells).toEqual([
      { row: 3, col: 0 },
      { row: 3, col: 5 },
      { row: 6, col: 0 },
      { row: 6, col: 5 },
    ]);

    for (const c of [1, 2, 3, 4, 6, 7, 8]) {
      for (const r of [3, 6]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }

    expect(result!.explanation).toContain('columns 1 and 6');
    expect(result!.explanation).toContain('rows 4 and 7');
  });

  it('returns null when only one row has the digit confined to two columns', () => {
    const board = createEmptyBoard(classicVariant);
    const row0 = [2, 3, 4, 0, 5, 6, 0, 7, 8];
    for (let c = 0; c < 9; c++) {
      if (row0[c] !== 0) board.cells[0][c].value = row0[c];
    }
    expect(findXWing(board)).toBeNull();
  });

  it('returns null when two rows confine the digit to non-matching column pairs', () => {
    // Row 0 forces digit 1 to cols 3 or 6. Row 5 forces digit 1 to cols 4 or
    // 7. The two rows each have two candidates but the column pairs differ,
    // so no X-wing is formed.
    const board = createEmptyBoard(classicVariant);
    const row0 = [2, 3, 4, 0, 5, 6, 0, 7, 8];
    const row5 = [5, 6, 7, 8, 0, 2, 3, 0, 4];
    for (let c = 0; c < 9; c++) {
      if (row0[c] !== 0) board.cells[0][c].value = row0[c];
      if (row5[c] !== 0) board.cells[5][c].value = row5[c];
    }
    expect(findXWing(board)).toBeNull();
  });
});
