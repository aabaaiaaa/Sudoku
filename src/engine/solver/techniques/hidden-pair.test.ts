import { describe, it, expect } from 'vitest';
import { findHiddenPair, type HiddenPairElimination } from './hidden-pair';
import { fixture } from './hidden-pair.fixture';
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
  eliminations: HiddenPairElimination[],
  pos: Position,
): HiddenPairElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findHiddenPair', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findHiddenPair(board)).toBeNull();
  });

  it('returns null when no hidden pair exists (single placement only)', () => {
    const board = createEmptyBoard(classicVariant);
    board.cells[4][4].value = 5;
    expect(findHiddenPair(board)).toBeNull();
  });

  it('does not flag a naked pair as a hidden pair', () => {
    // R1C1, R1C2 each have candidates {1, 2} (a naked pair on {1,2}).
    // The hidden-pair finder should not return this — there's nothing to
    // eliminate from those two cells beyond {1, 2}.
    const board = createEmptyBoard(classicVariant);
    board.cells[1][0].value = 3;
    board.cells[1][1].value = 4;
    board.cells[1][2].value = 5;
    board.cells[2][0].value = 6;
    board.cells[2][1].value = 7;
    board.cells[2][2].value = 8;
    board.cells[3][0].value = 9;
    board.cells[6][1].value = 9;
    expect(findHiddenPair(board)).toBeNull();
  });

  it('finds the hidden pair from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findHiddenPair(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('hidden-pair');
    expect(result!.house).toBe('row');
    expect(result!.houseIndex).toBe(0);
    expect(result!.digits).toEqual([1, 2]);
    expect(result!.cells).toEqual(fixture.roles.map(r => r.pos));

    // Each pair cell loses every candidate other than 1 and 2.
    const expectedRemoved: Digit[] = [3, 4, 5, 6, 7, 8, 9];
    const patternPos = fixture.roles.map(r => r.pos);
    for (const pos of patternPos) {
      const elim = findElim(result!.eliminations, pos);
      expect(elim, `expected eliminations at ${pos.row},${pos.col}`).toBeDefined();
      expect(elim!.digits).toEqual(expectedRemoved);
    }

    expect(result!.explanation).toContain('row 1');
    expect(result!.explanation).toContain('1 and 2');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findHiddenPair(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
  });
});
