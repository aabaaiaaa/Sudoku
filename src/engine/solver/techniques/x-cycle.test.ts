import { describe, it, expect } from 'vitest';
import { findXCycle, type XCycleElimination } from './x-cycle';
import { fixture } from './x-cycle.fixture';
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
  eliminations: XCycleElimination[],
  pos: Position,
): XCycleElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findXCycle', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findXCycle(board)).toBeNull();
  });

  it('returns null when only one strong link exists for any digit', () => {
    // Row 0 is filled so digit 1 has only one strong link (row 0 between
    // R1C4 and R1C7). With no other strong links, no alternating cycle of
    // any kind can form.
    const board = createEmptyBoard(classicVariant);
    const row0 = [2, 3, 4, 0, 5, 6, 0, 7, 8];
    for (let c = 0; c < 9; c++) {
      if (row0[c] !== 0) board.cells[0][c] = createGivenCell(row0[c] as Digit);
    }
    expect(findXCycle(board)).toBeNull();
  });

  it('returns null on a Mini board with a single 1 placed (no cycles available)', () => {
    // Placing 1 at R1C1 of a 4x4 leaves digit 1 candidates that fail to form
    // any alternating cycle: each component is a small 2-cell strong link
    // with no surrounding weak links to close a loop.
    const board = createEmptyBoard(miniVariant);
    board.cells[0][0] = createGivenCell(1);
    expect(findXCycle(board)).toBeNull();
  });

  it('finds the continuous nice loop from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findXCycle(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('x-cycle');
    expect(result!.digit).toBe(1);
    expect(result!.cycleType).toBe('continuous');

    // The cycle visits the four corner cells in the order produced by the
    // row-major DFS: starting at R1C4, around via R1C7 -> R6C7 -> R6C4.
    expect(result!.cells).toEqual([
      { row: 0, col: 3 },
      { row: 0, col: 6 },
      { row: 5, col: 6 },
      { row: 5, col: 3 },
    ]);

    // Edges alternate strong-weak-strong-weak around the cycle.
    expect(result!.edges).toHaveLength(4);
    expect(result!.edges.map((e) => e.type)).toEqual([
      'strong',
      'weak',
      'strong',
      'weak',
    ]);
    expect(result!.edges[0].house).toBe('row 1');
    expect(result!.edges[1].house).toBe('column 7');
    expect(result!.edges[2].house).toBe('row 6');
    expect(result!.edges[3].house).toBe('column 4');

    // The continuous cycle has no placement.
    expect(result!.placement).toBeUndefined();

    // Digit 1 should be eliminated from columns 4 and 7 in every row outside
    // the cycle (rows 2-5 and 7-9, 1-indexed; 1, 2, 3, 4, 6, 7, 8 zero-indexed).
    expect(result!.eliminations).toHaveLength(14);
    for (const r of [1, 2, 3, 4, 6, 7, 8]) {
      for (const c of [3, 6]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }

    // The four cycle corners themselves are not eliminations.
    for (const r of [0, 5]) {
      for (const c of [3, 6]) {
        expect(findElim(result!.eliminations, { row: r, col: c })).toBeUndefined();
      }
    }

    expect(result!.explanation).toContain('complete loop');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findXCycle(board);

    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The fixture's chain-link roles should be the four cells of the cycle.
    const finderCycle = [...result!.cells].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    const fixtureCells = fixture.roles
      .filter((r) => r.role === 'chain-link')
      .map((r) => r.pos)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    expect(finderCycle).toEqual(fixtureCells);
  });
});
