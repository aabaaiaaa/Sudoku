import { describe, it, expect } from 'vitest';
import { findWWing, type WWingElimination } from './w-wing';
import { fixture } from './w-wing.fixture';
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
  eliminations: WWingElimination[],
  pos: Position,
): WWingElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findWWing', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findWWing(board)).toBeNull();
  });

  it('returns null when only one bivalue {1,2} cell exists', () => {
    // Box 1 plus a single 9 in row 0 leave R1C1 = {1, 2}, but no other
    // bivalue {1, 2} exists on the board, so no W-Wing pair can be formed.
    const board = createEmptyBoard(classicVariant);
    board.cells[1][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][0].value = 7;
    board.cells[2][1].value = 8;
    board.cells[2][2].value = 9;
    board.cells[3][0].value = 3;
    expect(findWWing(board)).toBeNull();
  });

  it('returns null when matching bivalue pair has no strong link on either digit', () => {
    // Two {1, 2} bivalue cells exist (R1C1 and R3C3, sharing box 1) but the
    // sparse givens leave many cells with both 1 and 2 as candidates in every
    // house, so no strong link on 1 or 2 exists anywhere — no W-Wing fires.
    const board = createEmptyBoard(classicVariant);
    board.cells[1][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][0].value = 7;
    board.cells[2][1].value = 8;
    // Eliminate 3 and 9 from R1C1 via col 1 / row 1.
    board.cells[4][0].value = 3;
    board.cells[0][6].value = 9;
    // Eliminate 3 and 9 from R3C3 via row 3.
    board.cells[2][4].value = 3;
    board.cells[2][5].value = 9;
    expect(findWWing(board)).toBeNull();
  });

  it('finds the W-Wing from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findWWing(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('w-wing');
    expect(result!.bivalues).toEqual([
      { row: 0, col: 0 },
      { row: 2, col: 8 },
    ]);
    expect(result!.bivalueDigits).toEqual([1, 2]);
    expect(result!.x).toBe(1);
    expect(result!.y).toBe(2);
    expect(result!.strongLink).toEqual([
      { row: 0, col: 4 },
      { row: 2, col: 4 },
    ]);
    expect(result!.strongLinkHouse).toBe('column 5');

    // X = 1 is eliminated from R3C3, the only empty cell that sees both
    // bivalues (box 1 with R1C1, row 3 with R3C9).
    expect(result!.eliminations.length).toBe(1);
    const elim = findElim(result!.eliminations, { row: 2, col: 2 });
    expect(elim).toBeDefined();
    expect(elim!.digits).toEqual([1]);

    // The bivalue and strong-link cells themselves never appear as
    // eliminations.
    expect(findElim(result!.eliminations, { row: 0, col: 0 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 2, col: 8 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 0, col: 4 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 2, col: 4 })).toBeUndefined();

    expect(result!.explanation).toContain('two places in a shared');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findWWing(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The fixture's pattern-primary cells must be the two bivalue cells.
    const finderCells: Position[] = [...result!.bivalues].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    const fixtureCells = [...fixture.roles.filter(r => r.role === 'pattern-primary').map(r => r.pos)].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    expect(finderCells).toEqual(fixtureCells);
  });
});
