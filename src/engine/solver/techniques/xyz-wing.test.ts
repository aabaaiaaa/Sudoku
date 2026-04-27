import { describe, it, expect } from 'vitest';
import { findXyzWing, type XYZWingElimination } from './xyz-wing';
import { fixture } from './xyz-wing.fixture';
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
  eliminations: XYZWingElimination[],
  pos: Position,
): XYZWingElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findXyzWing', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findXyzWing(board)).toBeNull();
  });

  it('returns null when the trivalue pivot has no bivalue pincers', () => {
    // Box 0 plus a single 9 in row 0 leave R1C1 trivalue {1, 2, 3} as the
    // hardest cell on the board. Every other empty cell still has many
    // candidates, so no bivalue pincer exists to pair with the pivot.
    const board = createEmptyBoard(classicVariant);
    board.cells[1][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][0].value = 7;
    board.cells[2][1].value = 8;
    board.cells[0][6].value = 9;
    expect(findXyzWing(board)).toBeNull();
  });

  it('returns null when only one of the two pincer families is present', () => {
    // R1C1 is trivalue {1, 2, 3} and R3C3 is bivalue {1, 3}, but no {2, 3}
    // bivalue exists on the board — so the Z = 3 wing cannot be formed and
    // neither Z = 1 nor Z = 2 has a matching pair either.
    const board = createEmptyBoard(classicVariant);
    board.cells[1][0].value = 4;
    board.cells[1][1].value = 5;
    board.cells[1][2].value = 6;
    board.cells[2][0].value = 7;
    board.cells[2][1].value = 8;
    board.cells[0][6].value = 9;
    board.cells[3][2].value = 9;
    board.cells[5][2].value = 2;
    expect(findXyzWing(board)).toBeNull();
  });

  it('finds the XYZ-Wing from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findXyzWing(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('xyz-wing');
    expect(result!.pivot).toEqual({ row: 0, col: 0 });
    expect(result!.pivotDigits).toEqual([1, 2, 3]);
    expect(result!.z).toBe(3);
    expect(result!.pincers).toEqual([
      { row: 0, col: 4 },
      { row: 2, col: 2 },
    ]);

    // Z = 3 should be eliminated from every empty cell that sees the pivot
    // AND both pincers.
    const expected: Position[] = [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
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

    expect(result!.explanation).toContain('XYZ-wing');
    expect(result!.explanation).toContain('R1C1');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findXyzWing(board);
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
    const fixtureCells = [...fixture.patternCells].sort(
      (a, b) => (a.row - b.row) || (a.col - b.col),
    );
    expect(finderCells).toEqual(fixtureCells);
  });
});
