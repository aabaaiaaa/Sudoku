import { describe, it, expect } from 'vitest';
import {
  findPointing,
  findBoxLineReduction,
  findIntersection,
  type IntersectionElimination,
} from './intersection';
import { fixture as pointingFixture } from './pointing.fixture';
import { fixture as boxLineReductionFixture } from './box-line-reduction.fixture';
import { createEmptyBoard, createGivenCell } from '../../types';
import { classicVariant } from '../../variants';
import type { Board, Digit, Position } from '../../types';

function parseBoardString(boardStr: string): Board {
  const cleaned = boardStr.replace(/\s+/g, '');
  const board = createEmptyBoard(classicVariant);
  for (let i = 0; i < 81; i++) {
    const ch = cleaned[i];
    if (ch === '.' || ch === '0') continue;
    board.cells[Math.floor(i / 9)][i % 9] = createGivenCell(
      Number.parseInt(ch, 10) as Digit,
    );
  }
  return board;
}

function findElim(
  eliminations: IntersectionElimination[],
  pos: Position,
): IntersectionElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findPointing', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findPointing(board)).toBeNull();
  });

  it('finds a pointing pair/triple in a row and yields eliminations', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill box 0 rows 1..2 with non-1 values so box 0 empty cells are all
    // in row 0: (0,0), (0,1), (0,2). Digit 1 must live on row 0 within box 0.
    board.cells[1][0].value = 2;
    board.cells[1][1].value = 3;
    board.cells[1][2].value = 4;
    board.cells[2][0].value = 5;
    board.cells[2][1].value = 6;
    board.cells[2][2].value = 7;

    const result = findPointing(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('pointing');
    expect(result!.digit).toBe(1);
    expect(result!.sourceHouse).toBe('box');
    expect(result!.sourceHouseIndex).toBe(0);
    expect(result!.targetHouse).toBe('row');
    expect(result!.targetHouseIndex).toBe(0);
    expect(result!.intersectionCells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);

    // Eliminations are in row 0, cols 3..8, each for digit 1.
    for (let c = 3; c < 9; c++) {
      const elim = findElim(result!.eliminations, { row: 0, col: c });
      expect(elim, `expected elimination at col ${c}`).toBeDefined();
      expect(elim!.digits).toEqual([1]);
    }

    // Cells inside the box should not appear as eliminations.
    expect(findElim(result!.eliminations, { row: 0, col: 0 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 0, col: 1 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 0, col: 2 })).toBeUndefined();

    expect(result!.explanation).toContain('box 1');
    expect(result!.explanation).toContain('row 1');
  });

  it('finds a pointing pair/triple in a column and yields eliminations', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill box 0 cols 1..2 with non-1 values so box 0 empty cells are all
    // in col 0: (0,0), (1,0), (2,0). Digit 1 must live on col 0 within box 0.
    board.cells[0][1].value = 2;
    board.cells[0][2].value = 3;
    board.cells[1][1].value = 4;
    board.cells[1][2].value = 5;
    board.cells[2][1].value = 6;
    board.cells[2][2].value = 7;

    const result = findPointing(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('pointing');
    expect(result!.digit).toBe(1);
    expect(result!.sourceHouse).toBe('box');
    expect(result!.sourceHouseIndex).toBe(0);
    expect(result!.targetHouse).toBe('col');
    expect(result!.targetHouseIndex).toBe(0);
    expect(result!.intersectionCells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ]);

    for (let r = 3; r < 9; r++) {
      const elim = findElim(result!.eliminations, { row: r, col: 0 });
      expect(elim, `expected elimination at row ${r}`).toBeDefined();
      expect(elim!.digits).toEqual([1]);
    }

    expect(result!.explanation).toContain('box 1');
    expect(result!.explanation).toContain('column 1');
  });

  it('returns null when no pointing elimination is available', () => {
    const board = createEmptyBoard(classicVariant);
    // A single placed digit does not confine any box's digit candidates
    // to a single line in a useful way.
    board.cells[4][4].value = 5;
    expect(findPointing(board)).toBeNull();
  });
});

describe('findBoxLineReduction', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findBoxLineReduction(board)).toBeNull();
  });

  it('finds a box-line reduction on a row and yields eliminations', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill row 4 at cols 0,1,2 and 6,7,8 with non-1 distinct values.
    // Row 4 is now only empty at cols 3,4,5 (all inside box 4),
    // so digit 1 in row 4 is confined to box 4.
    board.cells[4][0].value = 2;
    board.cells[4][1].value = 3;
    board.cells[4][2].value = 4;
    board.cells[4][6].value = 5;
    board.cells[4][7].value = 6;
    board.cells[4][8].value = 7;

    const result = findBoxLineReduction(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('box-line-reduction');
    expect(result!.digit).toBe(1);
    expect(result!.sourceHouse).toBe('row');
    expect(result!.sourceHouseIndex).toBe(4);
    expect(result!.targetHouse).toBe('box');
    expect(result!.targetHouseIndex).toBe(4);
    expect(result!.intersectionCells).toEqual([
      { row: 4, col: 3 },
      { row: 4, col: 4 },
      { row: 4, col: 5 },
    ]);

    // Eliminations: box 4 cells not in row 4 (rows 3 and 5, cols 3..5).
    for (const r of [3, 5]) {
      for (let c = 3; c < 6; c++) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }

    // The intersection cells themselves are not listed as eliminations.
    expect(findElim(result!.eliminations, { row: 4, col: 3 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 4, col: 4 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 4, col: 5 })).toBeUndefined();

    expect(result!.explanation).toContain('row 5');
    expect(result!.explanation).toContain('box 5');
  });

  it('finds a box-line reduction on a column and yields eliminations', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill column 4 at rows 0,1,2 and 6,7,8 with non-1 distinct values.
    // Col 4 is now only empty at rows 3,4,5 (all inside box 4),
    // so digit 1 in col 4 is confined to box 4.
    board.cells[0][4].value = 2;
    board.cells[1][4].value = 3;
    board.cells[2][4].value = 4;
    board.cells[6][4].value = 5;
    board.cells[7][4].value = 6;
    board.cells[8][4].value = 7;

    const result = findBoxLineReduction(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('box-line-reduction');
    expect(result!.digit).toBe(1);
    expect(result!.sourceHouse).toBe('col');
    expect(result!.sourceHouseIndex).toBe(4);
    expect(result!.targetHouse).toBe('box');
    expect(result!.targetHouseIndex).toBe(4);
    expect(result!.intersectionCells).toEqual([
      { row: 3, col: 4 },
      { row: 4, col: 4 },
      { row: 5, col: 4 },
    ]);

    // Eliminations: box 4 cells not in col 4 (cols 3 and 5, rows 3..5).
    for (let r = 3; r < 6; r++) {
      for (const c of [3, 5]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }

    expect(result!.explanation).toContain('column 5');
    expect(result!.explanation).toContain('box 5');
  });

  it('returns null when no box-line reduction is available', () => {
    const board = createEmptyBoard(classicVariant);
    board.cells[4][4].value = 5;
    expect(findBoxLineReduction(board)).toBeNull();
  });
});

describe('findPointing fixture round-trip', () => {
  it('round-trips its fixture', () => {
    const board = parseBoardString(pointingFixture.board);
    const result = findPointing(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('pointing');
    for (const expected of pointingFixture.deduction.eliminations!) {
      const got = result!.eliminations.find(
        (e) => e.cell.row === expected.pos.row && e.cell.col === expected.pos.col,
      );
      expect(got, `expected elimination at (${expected.pos.row},${expected.pos.col})`).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
  });
});

describe('findBoxLineReduction fixture round-trip', () => {
  it('round-trips its fixture', () => {
    const board = parseBoardString(boxLineReductionFixture.board);
    const result = findBoxLineReduction(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('box-line-reduction');
    for (const expected of boxLineReductionFixture.deduction.eliminations!) {
      const got = result!.eliminations.find(
        (e) => e.cell.row === expected.pos.row && e.cell.col === expected.pos.col,
      );
      expect(got, `expected elimination at (${expected.pos.row},${expected.pos.col})`).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
  });
});

describe('findIntersection', () => {
  it('prefers a pointing finding when available', () => {
    const board = createEmptyBoard(classicVariant);
    // Setup a pointing row finding on box 0 digit 1.
    board.cells[1][0].value = 2;
    board.cells[1][1].value = 3;
    board.cells[1][2].value = 4;
    board.cells[2][0].value = 5;
    board.cells[2][1].value = 6;
    board.cells[2][2].value = 7;

    const result = findIntersection(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('pointing');
  });

  it('falls back to box-line reduction when no pointing finding exists', () => {
    const board = createEmptyBoard(classicVariant);
    // Box-line reduction fixture: row 4 digit 1 confined to box 4.
    board.cells[4][0].value = 2;
    board.cells[4][1].value = 3;
    board.cells[4][2].value = 4;
    board.cells[4][6].value = 5;
    board.cells[4][7].value = 6;
    board.cells[4][8].value = 7;

    const pointing = findPointing(board);
    expect(pointing).toBeNull();

    const result = findIntersection(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('box-line-reduction');
  });

  it('returns null for an empty board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findIntersection(board)).toBeNull();
  });
});
