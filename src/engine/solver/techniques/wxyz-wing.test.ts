import { describe, it, expect } from 'vitest';
import { findWxyzWing, type WxyzWingElimination } from './wxyz-wing';
import { fixture } from './wxyz-wing.fixture';
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
  eliminations: WxyzWingElimination[],
  pos: Position,
): WxyzWingElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findWxyzWing', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findWxyzWing(board)).toBeNull();
  });

  it('returns null when no bivalue pincers exist for a quadvalue hinge', () => {
    // Filling box 0 with 5,6,7,8,9 leaves R0C0 as a quadvalue cell {1,2,3,4}
    // (and several other cells around it also quadvalue). No empty cell on
    // the board is bivalue, so no pincers can pair with the hinge.
    const board = createEmptyBoard(classicVariant);
    board.cells[0][2].value = 5;
    board.cells[1][0].value = 6;
    board.cells[1][1].value = 7;
    board.cells[2][0].value = 8;
    board.cells[2][2].value = 9;
    expect(findWxyzWing(board)).toBeNull();
  });

  it('returns null when only some pincer families are present', () => {
    // Same shape as the fixture but with the col-1 given of 3 removed, so
    // R2C1 ({2,3,4}) is no longer bivalue. No {2,4} pincer exists, so the
    // Z = 4 wing cannot be formed and no other Z works either.
    const board = createEmptyBoard(classicVariant);
    board.cells[0][2].value = 5;
    board.cells[0][4].value = 7;
    board.cells[0][5].value = 6;
    board.cells[0][7].value = 8;
    board.cells[1][0].value = 6;
    board.cells[1][1].value = 7;
    board.cells[1][4].value = 9;
    board.cells[1][5].value = 2;
    board.cells[1][6].value = 3;
    board.cells[2][0].value = 8;
    board.cells[2][2].value = 9;
    board.cells[2][5].value = 1;
    expect(findWxyzWing(board)).toBeNull();
  });

  it('finds the WXYZ-Wing from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findWxyzWing(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('wxyz-wing');
    expect(result!.hinge).toEqual({ row: 0, col: 0 });
    expect(result!.hingeDigits).toEqual([1, 2, 3, 4]);
    expect(result!.z).toBe(4);
    expect(result!.pincers).toEqual([
      { row: 0, col: 3 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
    ]);

    // Z = 4 should be eliminated from every empty cell that sees the hinge
    // AND all three pincers — only R1C2 (zero-indexed R0C1) qualifies.
    const expected: Position[] = [{ row: 0, col: 1 }];
    for (const pos of expected) {
      const elim = findElim(result!.eliminations, pos);
      expect(elim, `expected elimination at ${pos.row},${pos.col}`).toBeDefined();
      expect(elim!.digits).toEqual([4]);
    }
    expect(result!.eliminations.length).toBe(expected.length);

    // The hinge and pincers themselves never appear as eliminations.
    expect(findElim(result!.eliminations, { row: 0, col: 0 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 0, col: 3 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 1, col: 2 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 2, col: 1 })).toBeUndefined();

    expect(result!.explanation).toContain('WXYZ-wing');
    expect(result!.explanation).toContain('R1C1');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findWxyzWing(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The fixture's patternCells must be the hinge plus the three pincers.
    const finderCells: Position[] = [
      result!.hinge,
      ...result!.pincers,
    ].sort((a, b) => (a.row - b.row) || (a.col - b.col));
    const fixtureCells = [...fixture.patternCells].sort(
      (a, b) => (a.row - b.row) || (a.col - b.col),
    );
    expect(finderCells).toEqual(fixtureCells);
  });
});
