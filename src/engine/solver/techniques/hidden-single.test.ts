import { describe, it, expect } from 'vitest';
import { findHiddenSingle } from './hidden-single';
import { createEmptyBoard } from '../../types';
import { classicVariant, miniVariant } from '../../variants';

describe('findHiddenSingle', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findHiddenSingle(board)).toBeNull();
  });

  it('finds a row hidden single', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill row 0 cols 1..8 with 1..8; only (0,0) can hold 9.
    board.cells[0][1].value = 1;
    board.cells[0][2].value = 2;
    board.cells[0][3].value = 3;
    board.cells[0][4].value = 4;
    board.cells[0][5].value = 5;
    board.cells[0][6].value = 6;
    board.cells[0][7].value = 7;
    board.cells[0][8].value = 8;

    const result = findHiddenSingle(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('hidden-single');
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.digit).toBe(9);
    expect(result!.house).toBe('row');
    expect(result!.houseIndex).toBe(0);
    expect(result!.explanation).toBe('R1C1 is the only cell in row 1 that can be 9');
  });

  it('finds a column hidden single', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill col 0 rows 1..8 with 1..8; only (0,0) can hold 9 in column 0.
    // Rows won't produce a hidden single first because every row has at most
    // one filled cell, so no row narrows a digit to a single empty cell.
    board.cells[1][0].value = 1;
    board.cells[2][0].value = 2;
    board.cells[3][0].value = 3;
    board.cells[4][0].value = 4;
    board.cells[5][0].value = 5;
    board.cells[6][0].value = 6;
    board.cells[7][0].value = 7;
    board.cells[8][0].value = 8;

    const result = findHiddenSingle(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('hidden-single');
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.digit).toBe(9);
    expect(result!.house).toBe('col');
    expect(result!.houseIndex).toBe(0);
    expect(result!.explanation).toBe('R1C1 is the only cell in column 1 that can be 9');
  });

  it('finds a box hidden single', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill box (0,0) cells except (0,0) with 1..8.
    // Values chosen so no row or column becomes fully constrained:
    // (0,1)=1, (0,2)=2
    // (1,0)=3, (1,1)=4, (1,2)=5
    // (2,0)=6, (2,1)=7, (2,2)=8
    board.cells[0][1].value = 1;
    board.cells[0][2].value = 2;
    board.cells[1][0].value = 3;
    board.cells[1][1].value = 4;
    board.cells[1][2].value = 5;
    board.cells[2][0].value = 6;
    board.cells[2][1].value = 7;
    board.cells[2][2].value = 8;

    const result = findHiddenSingle(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('hidden-single');
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.digit).toBe(9);
    expect(result!.house).toBe('box');
    expect(result!.houseIndex).toBe(0);
    expect(result!.explanation).toBe('R1C1 is the only cell in box 1 that can be 9');
  });

  it('returns null when no house has a hidden single', () => {
    const board = createEmptyBoard(classicVariant);
    // A single placed digit leaves every house with many candidates for every digit.
    board.cells[4][4].value = 5;
    expect(findHiddenSingle(board)).toBeNull();
  });

  it('finds a hidden single on a mini board', () => {
    const board = createEmptyBoard(miniVariant);
    // Fill row 0 cols 1..3 with 1,2,3; only (0,0) can hold 4 in row 0.
    board.cells[0][1].value = 1;
    board.cells[0][2].value = 2;
    board.cells[0][3].value = 3;

    const result = findHiddenSingle(board);
    expect(result).not.toBeNull();
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.digit).toBe(4);
    expect(result!.house).toBe('row');
    expect(result!.houseIndex).toBe(0);
    expect(result!.explanation).toBe('R1C1 is the only cell in row 1 that can be 4');
  });
});
