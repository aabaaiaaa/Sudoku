import { describe, it, expect } from 'vitest';
import { findNakedSingle } from './naked-single';
import { createEmptyBoard } from '../../types';
import { classicVariant, miniVariant } from '../../variants';

describe('findNakedSingle', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findNakedSingle(board)).toBeNull();
  });

  it('finds a cell whose peers eliminate all digits but one (classic)', () => {
    const board = createEmptyBoard(classicVariant);
    // Target cell (0,0). Fill its row, column, and box with 1..8 leaving only 9.
    board.cells[0][1].value = 1;
    board.cells[0][2].value = 2;
    board.cells[1][0].value = 3;
    board.cells[2][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][1].value = 7;
    board.cells[2][2].value = 8;

    const result = findNakedSingle(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('naked-single');
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.digit).toBe(9);
    expect(result!.explanation).toBe('R1C1 has only 9 as a candidate');
  });

  it('returns the first naked single in row-major order', () => {
    const board = createEmptyBoard(classicVariant);
    // Make (0,0) a naked single for digit 9 (same setup as above).
    board.cells[0][1].value = 1;
    board.cells[0][2].value = 2;
    board.cells[1][0].value = 3;
    board.cells[2][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][1].value = 7;
    board.cells[2][2].value = 8;
    // Also make (8,8) a naked single, but (0,0) should be returned first.
    board.cells[8][0].value = 1;
    board.cells[8][1].value = 2;
    board.cells[8][2].value = 3;
    board.cells[8][3].value = 4;
    board.cells[8][4].value = 5;
    board.cells[8][5].value = 6;
    board.cells[8][6].value = 7;
    board.cells[8][7].value = 8;

    const result = findNakedSingle(board);
    expect(result!.cell).toEqual({ row: 0, col: 0 });
  });

  it('returns null when no empty cell has exactly one candidate', () => {
    const board = createEmptyBoard(classicVariant);
    // A single placed digit leaves too many candidates for every empty cell.
    board.cells[4][4].value = 5;
    expect(findNakedSingle(board)).toBeNull();
  });

  it('finds a naked single on a mini board', () => {
    const board = createEmptyBoard(miniVariant);
    // Target (0,0): row has 1,2; column has 3 → only 4 remains.
    board.cells[0][1].value = 1;
    board.cells[0][2].value = 2;
    board.cells[1][0].value = 3;

    const result = findNakedSingle(board);
    expect(result).not.toBeNull();
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.digit).toBe(4);
    expect(result!.explanation).toBe('R1C1 has only 4 as a candidate');
  });
});
