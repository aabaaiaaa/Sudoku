import { describe, it, expect } from 'vitest';
import {
  findNakedPair,
  findNakedTriple,
  findNakedSubset,
  type NakedSubsetElimination,
} from './naked-subset';
import { createEmptyBoard } from '../../types';
import { classicVariant } from '../../variants';
import type { Position } from '../../types';

function findElim(
  eliminations: NakedSubsetElimination[],
  pos: Position,
): NakedSubsetElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findNakedPair', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findNakedPair(board)).toBeNull();
  });

  it('finds a naked pair in a row and yields eliminations', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill box 0 (except row 0) with 3..8 so R1C1,R1C2,R1C3 can only be {1,2,9}.
    board.cells[1][0].value = 3;
    board.cells[1][1].value = 4;
    board.cells[1][2].value = 5;
    board.cells[2][0].value = 6;
    board.cells[2][1].value = 7;
    board.cells[2][2].value = 8;
    // Eliminate 9 from R1C1 via column 0 (place 9 in box 3 rows 3-5 col 0).
    board.cells[3][0].value = 9;
    // Eliminate 9 from R1C2 via column 1 (place 9 in box 6 rows 6-8 col 1
    // to avoid conflict with 9 at R4C1 in box 3).
    board.cells[6][1].value = 9;

    // Now R1C1 and R1C2 each have candidates = {1, 2} (a naked pair),
    // while R1C3 still has {1, 2, 9}.
    const result = findNakedPair(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('naked-pair');
    expect(result!.size).toBe(2);
    expect(result!.house).toBe('row');
    expect(result!.houseIndex).toBe(0);
    expect(result!.digits).toEqual([1, 2]);
    expect(result!.cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);

    // Elimination in R1C3: remove {1,2}, leaving 9.
    const elimC3 = findElim(result!.eliminations, { row: 0, col: 2 });
    expect(elimC3).toBeDefined();
    expect(elimC3!.digits).toEqual([1, 2]);

    // Other cells in row 0 (cols 3..8) should also have {1,2} eliminated.
    for (let c = 3; c < 9; c++) {
      const elim = findElim(result!.eliminations, { row: 0, col: c });
      expect(elim, `expected eliminations at col ${c}`).toBeDefined();
      expect(elim!.digits).toEqual([1, 2]);
    }

    // The pair cells themselves are not listed as eliminations.
    expect(findElim(result!.eliminations, { row: 0, col: 0 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 0, col: 1 })).toBeUndefined();

    expect(result!.explanation).toContain('naked pair');
    expect(result!.explanation).toContain('row 1');
  });

  it('returns null when no naked pair yields eliminations', () => {
    const board = createEmptyBoard(classicVariant);
    // A single placed digit leaves very wide candidate sets everywhere —
    // no cell will have only two candidates.
    board.cells[4][4].value = 5;
    expect(findNakedPair(board)).toBeNull();
  });
});

describe('findNakedTriple', () => {
  it('finds a naked triple in a row and yields eliminations', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill box 0 rows 1-2 with 4..9 so R1C1,R1C2,R1C3 must all be in {1,2,3}.
    board.cells[1][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][0].value = 7;
    board.cells[2][1].value = 8;
    board.cells[2][2].value = 9;

    // Each of R1C1,R1C2,R1C3 has candidates {1,2,3}; union is {1,2,3}.
    const result = findNakedTriple(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('naked-triple');
    expect(result!.size).toBe(3);
    expect(result!.house).toBe('row');
    expect(result!.houseIndex).toBe(0);
    expect(result!.digits).toEqual([1, 2, 3]);
    expect(result!.cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);

    // Every other empty cell in row 0 should have {1,2,3} eliminated.
    for (let c = 3; c < 9; c++) {
      const elim = findElim(result!.eliminations, { row: 0, col: c });
      expect(elim, `expected eliminations at col ${c}`).toBeDefined();
      expect(elim!.digits).toEqual([1, 2, 3]);
    }

    expect(result!.explanation).toContain('naked triple');
    expect(result!.explanation).toContain('row 1');
  });
});

describe('findNakedSubset', () => {
  it('prefers a naked pair over a naked triple when both exist', () => {
    const board = createEmptyBoard(classicVariant);
    // Same setup as the naked-pair test: R1C1, R1C2 → {1,2}; R1C3 → {1,2,9}.
    // This is also technically a naked triple on {1,2,9} but the pair is
    // the stronger/smaller finding and should be returned first.
    board.cells[1][0].value = 3;
    board.cells[1][1].value = 4;
    board.cells[1][2].value = 5;
    board.cells[2][0].value = 6;
    board.cells[2][1].value = 7;
    board.cells[2][2].value = 8;
    board.cells[3][0].value = 9;
    board.cells[6][1].value = 9;

    const result = findNakedSubset(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('naked-pair');
    expect(result!.size).toBe(2);
  });

  it('returns a naked triple when no naked pair exists', () => {
    const board = createEmptyBoard(classicVariant);
    board.cells[1][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][0].value = 7;
    board.cells[2][1].value = 8;
    board.cells[2][2].value = 9;

    const result = findNakedSubset(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('naked-triple');
  });

  it('returns null for an empty board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findNakedSubset(board)).toBeNull();
  });
});
