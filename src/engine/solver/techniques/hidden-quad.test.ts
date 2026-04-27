import { describe, it, expect } from 'vitest';
import { findHiddenQuad, type HiddenQuadElimination } from './hidden-quad';
import { fixture } from './hidden-quad.fixture';
import { fixture as hiddenPairFixture } from './hidden-pair.fixture';
import { fixture as hiddenTripleFixture } from './hidden-triple.fixture';
import { fixture as nakedQuadFixture } from './naked-quad.fixture';
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
  eliminations: HiddenQuadElimination[],
  pos: Position,
): HiddenQuadElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findHiddenQuad', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findHiddenQuad(board)).toBeNull();
  });

  it('returns null when no hidden quad exists (single placement only)', () => {
    const board = createEmptyBoard(classicVariant);
    board.cells[4][4].value = 5;
    expect(findHiddenQuad(board)).toBeNull();
  });

  it('does not flag a hidden pair as a hidden quad', () => {
    const board = parseBoardString(hiddenPairFixture.variant, hiddenPairFixture.board);
    expect(findHiddenQuad(board)).toBeNull();
  });

  it('does not flag a hidden triple as a hidden quad', () => {
    const board = parseBoardString(hiddenTripleFixture.variant, hiddenTripleFixture.board);
    expect(findHiddenQuad(board)).toBeNull();
  });

  it('does not flag a naked quad fixture as a hidden quad', () => {
    // The naked quad fixture has cells already constrained to {1,2,3,4}, so a
    // hidden quad covering those cells would have no eliminations and is
    // skipped by the finder.
    const board = parseBoardString(nakedQuadFixture.variant, nakedQuadFixture.board);
    expect(findHiddenQuad(board)).toBeNull();
  });

  it('finds the hidden quad from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findHiddenQuad(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('hidden-quad');
    expect(result!.house).toBe('row');
    expect(result!.houseIndex).toBe(0);
    expect(result!.digits).toEqual([1, 2, 3, 4]);
    expect(result!.cells).toEqual(fixture.patternCells);

    // Each quad cell loses every candidate other than 1, 2, 3 and 4.
    const expectedRemoved: Digit[] = [5, 6, 7, 8, 9];
    for (const pos of fixture.patternCells) {
      const elim = findElim(result!.eliminations, pos);
      expect(elim, `expected eliminations at ${pos.row},${pos.col}`).toBeDefined();
      expect(elim!.digits).toEqual(expectedRemoved);
    }

    expect(result!.explanation).toContain('row 1');
    expect(result!.explanation).toContain('1,2,3,4');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findHiddenQuad(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
  });
});
