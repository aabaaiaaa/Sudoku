import { describe, it, expect } from 'vitest';
import { solve, countSolutions } from './backtracking';
import { emptyBoard, isComplete } from '../board';
import { classicVariant, miniVariant, sixVariant } from '../variants';
import type { Board, Digit, Variant } from '../types';

/**
 * Build a board from a 2D array of clues.
 * Cells with a digit become givens; 0 or null become empty.
 */
function buildBoard(variant: Variant, grid: (number | null)[][]): Board {
  const board = emptyBoard(variant);
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      const v = grid[r][c];
      if (v != null && v !== 0) {
        board.cells[r][c].value = v as Digit;
        board.cells[r][c].given = true;
      }
    }
  }
  return board;
}

describe('solve — classic 9x9', () => {
  it('solves a known classic puzzle', () => {
    const grid = [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ];
    const board = buildBoard(classicVariant, grid);
    const solved = solve(board);
    expect(solved).not.toBeNull();
    expect(isComplete(solved!)).toBe(true);
    // Original board was not mutated.
    expect(board.cells[0][2].value).toBeNull();
    // Given cells preserved in result.
    expect(solved!.cells[0][0].value).toBe(5);
    expect(solved!.cells[0][0].given).toBe(true);
    // Filled cells have given=false.
    expect(solved!.cells[0][2].given).toBe(false);
    expect(solved!.cells[0][2].value).not.toBeNull();
  });
});

describe('solve — mini 4x4', () => {
  it('solves a simple mini puzzle', () => {
    const grid = [
      [1, 0, 0, 4],
      [0, 0, 1, 0],
      [0, 1, 0, 0],
      [4, 0, 0, 1],
    ];
    const board = buildBoard(miniVariant, grid);
    const solved = solve(board);
    expect(solved).not.toBeNull();
    expect(isComplete(solved!)).toBe(true);
  });
});

describe('solve — six 6x6', () => {
  it('solves a simple six puzzle', () => {
    const grid = [
      [1, 0, 0, 0, 0, 6],
      [0, 0, 3, 4, 0, 0],
      [0, 2, 0, 0, 5, 0],
      [0, 5, 0, 0, 2, 0],
      [0, 0, 2, 1, 0, 0],
      [6, 0, 0, 0, 0, 3],
    ];
    const board = buildBoard(sixVariant, grid);
    const solved = solve(board);
    expect(solved).not.toBeNull();
    expect(isComplete(solved!)).toBe(true);
  });
});

describe('solve — unsolvable', () => {
  it('returns null when clues directly conflict (row)', () => {
    const board = emptyBoard(classicVariant);
    board.cells[0][0].value = 5;
    board.cells[0][0].given = true;
    board.cells[0][1].value = 5;
    board.cells[0][1].given = true;
    expect(solve(board)).toBeNull();
  });

  it('returns null when clues force an impossible puzzle', () => {
    // Put 1..8 in the first row and a 1 in the top-left of column 9's box,
    // leaving no legal digit for cell (0,8).
    const board = emptyBoard(classicVariant);
    for (let c = 0; c < 8; c++) {
      board.cells[0][c].value = (c + 1) as Digit;
      board.cells[0][c].given = true;
    }
    // Place a 9 elsewhere in row 0's third box so that no digit fits (0,8).
    board.cells[1][8].value = 9;
    board.cells[1][8].given = true;
    // Actually row has 1..8 used, and col 8 has 9 used, so (0,8) needs 9
    // but that's blocked by column. Unsolvable.
    expect(solve(board)).toBeNull();
  });
});

describe('countSolutions', () => {
  it('returns 1 for a uniquely-solvable puzzle', () => {
    const grid = [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ];
    const board = buildBoard(classicVariant, grid);
    expect(countSolutions(board, 2)).toBe(1);
  });

  it('returns 1 for a completed board with a few clues removed', () => {
    // Start from a valid full mini solution and clear a handful of cells;
    // the remaining grid should still have a unique completion for this puzzle.
    const full = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    const board = buildBoard(miniVariant, full);
    // Clear a few cells
    const toClear: [number, number][] = [
      [0, 0],
      [1, 2],
      [2, 3],
      [3, 1],
    ];
    for (const [r, c] of toClear) {
      board.cells[r][c].value = null;
      board.cells[r][c].given = false;
    }
    expect(countSolutions(board, 2)).toBe(1);
  });

  it('caps at 2 for an empty 4x4 board (many solutions)', () => {
    const board = emptyBoard(miniVariant);
    expect(countSolutions(board, 2)).toBe(2);
  });

  it('returns 0 for a contradictory board', () => {
    const board = emptyBoard(miniVariant);
    board.cells[0][0].value = 1;
    board.cells[0][0].given = true;
    board.cells[0][1].value = 1;
    board.cells[0][1].given = true;
    expect(countSolutions(board, 2)).toBe(0);
  });

  it('respects the cap parameter', () => {
    const board = emptyBoard(miniVariant);
    expect(countSolutions(board, 1)).toBe(1);
    expect(countSolutions(board, 5)).toBe(5);
  });
});
