import { describe, it, expect } from 'vitest';
import {
  findSimpleColoring,
  type SimpleColoringElimination,
} from './simple-coloring';
import { fixture } from './simple-coloring.fixture';
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
  eliminations: SimpleColoringElimination[],
  pos: Position,
): SimpleColoringElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findSimpleColoring', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findSimpleColoring(board)).toBeNull();
  });

  it('returns null when the only strong-link component is a 2-cell edge', () => {
    // Filling row 0 except (0,0) and (0,4) with distinct non-1 digits leaves
    // exactly one strong link for any digit: row 0 between R1C1 and R1C5
    // (digit 1 candidate at exactly those two cells; digit 9 likewise). The
    // resulting two-cell components colour one cell A and one B each, so no
    // wrap is possible.
    const board = createEmptyBoard(classicVariant);
    board.cells[0][1] = createGivenCell(2);
    board.cells[0][2] = createGivenCell(3);
    board.cells[0][3] = createGivenCell(4);
    board.cells[0][5] = createGivenCell(5);
    board.cells[0][6] = createGivenCell(6);
    board.cells[0][7] = createGivenCell(7);
    board.cells[0][8] = createGivenCell(8);
    expect(findSimpleColoring(board)).toBeNull();
  });

  it('returns null on a Mini board whose two components both have one cell per colour', () => {
    // Place a single 1 at R1C1 of a 4x4 board. Digit 1 is then a candidate
    // only outside row 0, column 0, and the top-left 2x2 box. The remaining
    // candidates form two disjoint 2-cell strong-link components — row 1 with
    // cells (1,2)-(1,3) and column 1 with cells (2,1)-(3,1) — each of which
    // bipartite-colours one cell A and one B. No wrap possible.
    const board = createEmptyBoard(miniVariant);
    board.cells[0][0] = createGivenCell(1);
    expect(findSimpleColoring(board)).toBeNull();
  });

  it('finds the color wrap from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findSimpleColoring(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('simple-coloring');
    expect(result!.digit).toBe(1);
    expect(result!.invalidColor).toBe('A');
    expect(result!.conflictHouse).toBe('box 1');

    expect(result!.colorA).toEqual([
      { row: 0, col: 0 },
      { row: 2, col: 1 },
      { row: 4, col: 3 },
    ]);
    expect(result!.colorB).toEqual([
      { row: 0, col: 1 },
      { row: 2, col: 3 },
    ]);

    // The first same-color pair sharing a house, in row-major order, is
    // R1C1-R3C2 in box 1.
    expect(result!.conflict).toEqual([
      { row: 0, col: 0 },
      { row: 2, col: 1 },
    ]);

    // Eliminate digit 1 from every color-A cell.
    expect(result!.eliminations).toHaveLength(3);
    for (const cell of [
      { row: 0, col: 0 },
      { row: 2, col: 1 },
      { row: 4, col: 3 },
    ]) {
      const e = findElim(result!.eliminations, cell);
      expect(e).toBeDefined();
      expect(e!.digits).toEqual([1]);
    }
    // Color-B cells are not eliminated.
    expect(findElim(result!.eliminations, { row: 0, col: 1 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 2, col: 3 })).toBeUndefined();

    expect(result!.explanation).toContain('Simple coloring');
    expect(result!.explanation).toContain('box 1');
    expect(result!.explanation).toContain('R1C1');
    expect(result!.explanation).toContain('R3C2');
    expect(result!.explanation).toContain('R5C4');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findSimpleColoring(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The fixture's cluster-a and cluster-b roles must equal the full chain (colorA ∪ colorB).
    const finderChain: Position[] = [...result!.colorA, ...result!.colorB].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    const fixtureChain = fixture.roles
      .filter((r) => r.role === 'cluster-a' || r.role === 'cluster-b')
      .map((r) => r.pos)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    expect(finderChain).toEqual(fixtureChain);
  });
});
