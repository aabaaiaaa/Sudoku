import { describe, it, expect } from 'vitest';
import { findNakedQuad, type NakedQuadElimination } from './naked-quad';
import { fixture } from './naked-quad.fixture';
import { fixture as hiddenPairFixture } from './hidden-pair.fixture';
import { fixture as hiddenTripleFixture } from './hidden-triple.fixture';
import { findNakedPair, findNakedTriple } from './naked-subset';
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
  eliminations: NakedQuadElimination[],
  pos: Position,
): NakedQuadElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findNakedQuad', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findNakedQuad(board)).toBeNull();
  });

  it('returns null when no naked quad exists (single placement only)', () => {
    const board = createEmptyBoard(classicVariant);
    board.cells[4][4].value = 5;
    expect(findNakedQuad(board)).toBeNull();
  });

  it('does not flag a hidden pair fixture as a naked quad', () => {
    const board = parseBoardString(hiddenPairFixture.variant, hiddenPairFixture.board);
    expect(findNakedQuad(board)).toBeNull();
  });

  it('does not flag a hidden triple fixture as a naked quad', () => {
    const board = parseBoardString(hiddenTripleFixture.variant, hiddenTripleFixture.board);
    expect(findNakedQuad(board)).toBeNull();
  });

  it('finds the naked quad from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findNakedQuad(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('naked-quad');
    expect(result!.size).toBe(4);
    expect(result!.house).toBe('row');
    expect(result!.houseIndex).toBe(0);
    expect(result!.digits).toEqual([1, 2, 3, 4]);
    expect(result!.cells).toEqual(fixture.roles.filter(r => r.role !== 'elimination' && r.role !== 'placement').map(r => r.pos));

    // Every other empty cell in row 0 should have {1,2,3,4} eliminated.
    for (let c = 4; c < 9; c++) {
      const elim = findElim(result!.eliminations, { row: 0, col: c });
      expect(elim, `expected eliminations at col ${c}`).toBeDefined();
      expect(elim!.digits).toEqual([1, 2, 3, 4]);
    }

    // The quad cells themselves are not listed as eliminations.
    for (const pos of fixture.roles.filter(r => r.role !== 'elimination' && r.role !== 'placement').map(r => r.pos)) {
      expect(findElim(result!.eliminations, pos)).toBeUndefined();
    }

    expect(result!.explanation).toContain('naked quad');
    expect(result!.explanation).toContain('row 1');
    expect(result!.explanation).toContain('1,2,3,4');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findNakedQuad(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
  });

  it('does not fire as a naked pair or triple on the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    expect(findNakedPair(board)).toBeNull();
    expect(findNakedTriple(board)).toBeNull();
  });
});
