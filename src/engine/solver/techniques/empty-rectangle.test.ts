import { describe, it, expect } from 'vitest';
import {
  findEmptyRectangle,
  type EmptyRectangleElimination,
} from './empty-rectangle';
import { fixture } from './empty-rectangle.fixture';
import { createEmptyBoard, createGivenCell } from '../../types';
import { classicVariant, miniVariant, sixVariant } from '../../variants';
import type { Board, Digit, Position, Variant } from '../../types';

function variantFor(name: 'classic' | 'six' | 'mini'): Variant {
  if (name === 'classic') return classicVariant;
  if (name === 'six') return sixVariant;
  return miniVariant;
}

function parseBoardString(name: 'classic' | 'six' | 'mini', s: string): Board {
  const variant = variantFor(name);
  const cleaned = s.replace(/\s+/g, '');
  const expected = variant.size * variant.size;
  if (cleaned.length !== expected) {
    throw new Error(`Expected ${expected} cells, got ${cleaned.length}`);
  }
  const board = createEmptyBoard(variant);
  for (let i = 0; i < expected; i++) {
    const ch = cleaned[i];
    const r = Math.floor(i / variant.size);
    const c = i % variant.size;
    if (ch === '.' || ch === '0') continue;
    const d = Number.parseInt(ch, 10);
    if (!Number.isInteger(d) || d < 1 || d > variant.size) {
      throw new Error(`Bad cell '${ch}' at index ${i}`);
    }
    board.cells[r][c] = createGivenCell(d as Digit);
  }
  return board;
}

function findElim(
  eliminations: EmptyRectangleElimination[],
  pos: Position,
): EmptyRectangleElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findEmptyRectangle', () => {
  it('returns null for an empty classic board', () => {
    // Every cell is a candidate for every digit, so no box has its candidates
    // confined to row R ∪ column C — all 9 cells of any box can never fit in
    // a 5-cell cross.
    const board = createEmptyBoard(classicVariant);
    expect(findEmptyRectangle(board)).toBeNull();
  });

  it('returns null when an ER pattern exists but no strong link supports it', () => {
    // Box 1's empty cells form the ER pattern (cross at R1C1) but no other
    // house contains a conjugate pair on digit 1 — column 5 still has 1 as a
    // candidate in every row, so the strong link required by ER is missing.
    const board = createEmptyBoard(classicVariant);
    board.cells[1][1] = createGivenCell(5);
    board.cells[1][2] = createGivenCell(6);
    board.cells[2][1] = createGivenCell(7);
    board.cells[2][2] = createGivenCell(8);
    expect(findEmptyRectangle(board)).toBeNull();
  });

  it('returns null when a strong link exists but no box has an ER pattern', () => {
    // Column 5 is forced into a conjugate pair on digit 1 (R1C5, R6C5) by
    // filling the other rows of column 5 with 2-8. No givens otherwise, so
    // every box other than the ones touching column 5 has 1 as a candidate
    // in all 9 cells — never confinable to a single row+column cross.
    const board = createEmptyBoard(classicVariant);
    board.cells[1][4] = createGivenCell(2);
    board.cells[2][4] = createGivenCell(3);
    board.cells[3][4] = createGivenCell(4);
    board.cells[4][4] = createGivenCell(5);
    board.cells[6][4] = createGivenCell(6);
    board.cells[7][4] = createGivenCell(7);
    board.cells[8][4] = createGivenCell(8);
    expect(findEmptyRectangle(board)).toBeNull();
  });

  it('finds the empty rectangle from the fixture and yields the expected elimination', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findEmptyRectangle(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('empty-rectangle');
    expect(result!.digit).toBe(1);
    expect(result!.box).toBe(0);
    expect(result!.erRow).toBe(0);
    expect(result!.erCol).toBe(0);

    // Box 1's five empty cells are all candidates for digit 1 and they make
    // up the ER pattern.
    const expectedBoxCells: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ];
    const sortedBoxCells = [...result!.boxCells].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    expect(sortedBoxCells).toEqual(expectedBoxCells);

    // The strong link is the conjugate pair on 1 in column 5.
    expect(result!.strongLink.orientation).toBe('column');
    expect(result!.strongLink.house).toBe('column 5');
    expect(result!.strongLink.from).toEqual({ row: 0, col: 4 });
    expect(result!.strongLink.to).toEqual({ row: 5, col: 4 });

    // Single elimination at R6C1.
    expect(result!.eliminations).toHaveLength(1);
    const elim = findElim(result!.eliminations, { row: 5, col: 0 });
    expect(elim).toBeDefined();
    expect(elim!.digits).toEqual([1]);

    expect(result!.explanation).toContain('stepping stone');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findEmptyRectangle(board);

    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
    expect(result!.eliminations.length).toBe(
      fixture.deduction.eliminations!.length,
    );

    // The fixture's pattern-primary (box) and pattern-secondary (strong-link) roles
    // must equal the box cells plus the two strong-link endpoints.
    const finderCells: Position[] = [
      ...result!.boxCells,
      result!.strongLink.from,
      result!.strongLink.to,
    ].sort((a, b) => a.row - b.row || a.col - b.col);
    const fixtureCells = fixture.roles
      .filter((r) => r.role === 'pattern-primary' || r.role === 'pattern-secondary')
      .map((r) => r.pos)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    expect(finderCells).toEqual(fixtureCells);
  });

  it('detects the symmetric row-variant elimination', () => {
    // Mirror of the fixture: box 1 ER pattern with cross at R1C1, but the
    // strong link is now in row 6 (R6C1, R6C5) instead of column 5. The
    // elimination flips to R1C5.
    //
    // Row 6 is forced into a conjugate pair on digit 1 by filling its other
    // cells with 2-8 (cols 2-3 and 5-9, leaving cols 1 and 5 empty). Box 1
    // gets the same four givens that confine 1 to its row-1 and col-1 cells.
    const board = createEmptyBoard(classicVariant);
    // Box 1 confinement givens.
    board.cells[1][1] = createGivenCell(5);
    board.cells[1][2] = createGivenCell(6);
    board.cells[2][1] = createGivenCell(7);
    board.cells[2][2] = createGivenCell(8);
    // Row 6 strong-link givens: leave R6C1 and R6C5 empty, fill the rest with
    // 2-8 (one each, no repeats in row).
    board.cells[5][1] = createGivenCell(2);
    board.cells[5][2] = createGivenCell(3);
    board.cells[5][3] = createGivenCell(4);
    board.cells[5][5] = createGivenCell(5);
    board.cells[5][6] = createGivenCell(6);
    board.cells[5][7] = createGivenCell(7);
    board.cells[5][8] = createGivenCell(8);

    const result = findEmptyRectangle(board);
    expect(result).not.toBeNull();
    expect(result!.digit).toBe(1);
    expect(result!.box).toBe(0);
    expect(result!.erRow).toBe(0);
    expect(result!.erCol).toBe(0);
    expect(result!.strongLink.orientation).toBe('row');
    expect(result!.strongLink.house).toBe('row 6');
    expect(result!.strongLink.from).toEqual({ row: 5, col: 0 });
    expect(result!.strongLink.to).toEqual({ row: 5, col: 4 });
    expect(result!.eliminations).toHaveLength(1);
    expect(result!.eliminations[0].cell).toEqual({ row: 0, col: 4 });
    expect(result!.eliminations[0].digits).toEqual([1]);
  });
});
