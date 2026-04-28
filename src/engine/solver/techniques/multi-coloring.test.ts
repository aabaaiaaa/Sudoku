import { describe, it, expect } from 'vitest';
import {
  findMultiColoring,
  type MultiColoringElimination,
} from './multi-coloring';
import { fixture } from './multi-coloring.fixture';
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
  eliminations: MultiColoringElimination[],
  pos: Position,
): MultiColoringElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findMultiColoring', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findMultiColoring(board)).toBeNull();
  });

  it('returns null when only a single cluster exists', () => {
    // Reuse the simple-coloring layout: digit 1 has exactly one connected
    // strong-link component on this board (a 5-cell chain), so there is no
    // second cluster to interact with and multi-coloring cannot fire.
    const board = parseBoardString(
      'classic',
      '...234...' +
        '.......1.' +
        '4...56...' +
        '........1' +
        '.2.......' +
        '.3.5.....' +
        '.....1...' +
        '.........' +
        '..1......',
    );
    expect(findMultiColoring(board)).toBeNull();
  });

  it('returns null when two clusters exist but never share a house', () => {
    // Mini (4x4) with digit 1 placed at R1C1 leaves digit 1's candidates in
    // an "L" shape. The strong-link graph has exactly two disjoint edges:
    //   - row 2 between R2C3 and R2C4 (also box 2);
    //   - column 2 between R3C2 and R4C2 (also box 3).
    // Cluster 1 = {R2C3, R2C4}, cluster 2 = {R3C2, R4C2}. The two clusters
    // share no row, column or box, so no cross-cluster colour bridge exists
    // and multi-coloring cannot fire.
    const board = createEmptyBoard(miniVariant);
    board.cells[0][0] = createGivenCell(1);
    expect(findMultiColoring(board)).toBeNull();
  });

  it('finds the multi-coloring inference from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findMultiColoring(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('multi-coloring');
    expect(result!.digit).toBe(1);

    // The finder iterates clusters in row-major order of their lowest cell
    // and colour pairs in (A,A), (A,B), (B,A), (B,B) order. Cluster 1 starts
    // at R1C4 (the row-1 strong link), cluster 2 starts at R6C4 (the row-6
    // strong link); each component is bipartite-coloured starting at its
    // lowest cell as A, so:
    //   cluster 1: A = R1C4, B = R1C7
    //   cluster 2: A = R6C4, B = R6C7
    // The (A,A) bridge — R1C4 and R6C4 sharing column 4 — fires first.
    expect(result!.cluster1A).toEqual([{ row: 0, col: 3 }]);
    expect(result!.cluster1B).toEqual([{ row: 0, col: 6 }]);
    expect(result!.cluster2A).toEqual([{ row: 5, col: 3 }]);
    expect(result!.cluster2B).toEqual([{ row: 5, col: 6 }]);

    expect(result!.bridgeColor).toEqual({ c1: 'A', c2: 'A' });
    expect(result!.bridge).toEqual([
      { row: 0, col: 3 },
      { row: 5, col: 3 },
    ]);
    expect(result!.bridgeHouse).toBe('column 4');

    // The opposite colours are cluster 1 B = R1C7 and cluster 2 B = R6C7.
    // Every other cell of column 7 sees both, so digit 1 is eliminated from
    // R2C7, R3C7, R4C7, R5C7, R7C7, R8C7, R9C7.
    const expected: Position[] = [
      { row: 1, col: 6 },
      { row: 2, col: 6 },
      { row: 3, col: 6 },
      { row: 4, col: 6 },
      { row: 6, col: 6 },
      { row: 7, col: 6 },
      { row: 8, col: 6 },
    ];
    expect(result!.eliminations).toHaveLength(expected.length);
    for (const pos of expected) {
      const e = findElim(result!.eliminations, pos);
      expect(e, `expected elimination at ${pos.row},${pos.col}`).toBeDefined();
      expect(e!.digits).toEqual([1]);
    }

    // Cluster cells themselves are never eliminated.
    expect(findElim(result!.eliminations, { row: 0, col: 6 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 5, col: 6 })).toBeUndefined();

    expect(result!.explanation).toContain('Multi-coloring');
    expect(result!.explanation).toContain('column 4');
    expect(result!.explanation).toContain('R1C4');
    expect(result!.explanation).toContain('R6C4');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findMultiColoring(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    expect(result!.eliminations.length).toBe(
      fixture.deduction.eliminations!.length,
    );
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The fixture's patternCells must equal the union of all cluster cells —
    // what the help screen highlights as "the pattern".
    const finderPattern: Position[] = [
      ...result!.cluster1A,
      ...result!.cluster1B,
      ...result!.cluster2A,
      ...result!.cluster2B,
    ].sort((a, b) => a.row - b.row || a.col - b.col);
    const fixturePattern = [...fixture.patternCells].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    expect(finderPattern).toEqual(fixturePattern);
  });
});
