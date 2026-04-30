import { describe, it, expect } from 'vitest';
import { findXyWing, type XYWingElimination } from './xy-wing';
import { fixture } from './xy-wing.fixture';
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
  eliminations: XYWingElimination[],
  pos: Position,
): XYWingElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findXyWing', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findXyWing(board)).toBeNull();
  });

  it('returns null when the only bivalue cell has no pincers', () => {
    // Box (0-2, 0-2) and col 0 contain digits 3-9, leaving R1C1 as the lone
    // bivalue cell {1, 2}. With no other bivalue cells reachable, there are
    // no XY-Wing pincers to pair with it.
    const board = createEmptyBoard(classicVariant);
    board.cells[1][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][0].value = 7;
    board.cells[2][1].value = 8;
    board.cells[2][2].value = 9;
    board.cells[3][0].value = 3;
    expect(findXyWing(board)).toBeNull();
  });

  it('returns null when both pincer candidates share a house', () => {
    // R1C1 = {1, 2}, R1C2 = {1, 3}, R1C3 = {2, 3} — a "wing" pattern, but the
    // two would-be pincers (R1C2 and R1C3) share row 1 (and box 1). The task
    // requires the pincers not to share a house, so this is rejected.
    const board = createEmptyBoard(classicVariant);
    // 4-9 in box (0-2, 0-2) excluding the three target cells in row 0.
    board.cells[1][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][0].value = 7;
    board.cells[2][1].value = 8;
    board.cells[2][2].value = 9;
    // Anchor candidates: 3 visible to (0,0), 2 visible to (0,1), 1 visible to
    // (0,2) — each via box (3-5, 0-2).
    board.cells[3][0].value = 3;
    board.cells[3][1].value = 2;
    board.cells[3][2].value = 1;
    expect(findXyWing(board)).toBeNull();
  });

  it('finds the XY-Wing from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findXyWing(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('xy-wing');
    expect(result!.pivot).toEqual({ row: 0, col: 0 });
    expect(result!.pivotDigits).toEqual([1, 2]);
    expect(result!.z).toBe(3);
    expect(result!.pincers).toEqual([
      { row: 0, col: 4 },
      { row: 2, col: 2 },
    ]);

    // Z = 3 should be eliminated from every empty cell that sees both pincers.
    const expected: Position[] = [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
    ];
    for (const pos of expected) {
      const elim = findElim(result!.eliminations, pos);
      expect(elim, `expected elimination at ${pos.row},${pos.col}`).toBeDefined();
      expect(elim!.digits).toEqual([3]);
    }
    expect(result!.eliminations.length).toBe(expected.length);

    // The pivot and the two pincers themselves never appear as eliminations.
    expect(findElim(result!.eliminations, { row: 0, col: 0 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 0, col: 4 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 2, col: 2 })).toBeUndefined();

    expect(result!.explanation).toContain('both pincers');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findXyWing(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The fixture's patternCells must be the pivot plus the two pincers.
    const finderCells: Position[] = [
      result!.pivot,
      ...result!.pincers,
    ].sort((a, b) => (a.row - b.row) || (a.col - b.col));
    const fixtureCells = [...fixture.roles.filter(r => r.role !== 'elimination' && r.role !== 'placement').map(r => r.pos)].sort(
      (a, b) => (a.row - b.row) || (a.col - b.col),
    );
    expect(finderCells).toEqual(fixtureCells);
  });
});
