import { describe, it, expect } from 'vitest';
import {
  find3DMedusa,
  type Medusa3DElimination,
  type Medusa3DNode,
} from './medusa-3d';
import { fixture } from './medusa-3d.fixture';
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
  eliminations: Medusa3DElimination[],
  pos: Position,
): Medusa3DElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

function findNode(
  nodes: Medusa3DNode[],
  pos: Position,
  digit: Digit,
): Medusa3DNode | undefined {
  return nodes.find(
    (n) => n.cell.row === pos.row && n.cell.col === pos.col && n.digit === digit,
  );
}

describe('find3DMedusa', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(find3DMedusa(board)).toBeNull();
  });

  it('returns null when no bivalue cells or two-candidate houses exist', () => {
    // One given (R1C1=1) eliminates digit 1 from row 1, column 1 and box 1
    // but introduces no bivalue cells (every other cell has ≥7 candidates)
    // and no house has exactly two cells with any digit as candidate.
    const board = createEmptyBoard(classicVariant);
    board.cells[0][0] = createGivenCell(1);
    expect(find3DMedusa(board)).toBeNull();
  });

  it('returns null when sparse givens leave only many-candidate cells', () => {
    // Three givens in row 1 (R1C2..R1C4 = 7, 8, 9) eliminate {7,8,9} from
    // row 1's other cells (six cells with six candidates each), eliminate
    // 7 from column 2 and box 1, eliminate 8 from column 3 and box 1, and
    // eliminate 9 from column 4 and box 2. Every empty cell still has ≥6
    // candidates; for every (house, digit) the candidate count is 0 or ≥4.
    // The medusa graph is empty.
    const board = createEmptyBoard(classicVariant);
    board.cells[0][1] = createGivenCell(7);
    board.cells[0][2] = createGivenCell(8);
    board.cells[0][3] = createGivenCell(9);
    expect(find3DMedusa(board)).toBeNull();
  });

  it('finds the colour-twice-in-house contradiction from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = find3DMedusa(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('3d-medusa');
    expect(result!.rule).toBe('color-twice-in-house');
    expect(result!.invalidColor).toBe('A');
    expect(result!.conflictHouse).toBe('box 1');
    expect(result!.conflictHouseDigit).toBe(1);
    expect(result!.conflictHouseCells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
    ]);

    // BFS coloring starts at the lowest node (1@R1C1) and assigns it A.
    // The bipartite cluster covers all eight (cell, digit) pairs at the
    // four corner cells with candidates {1, 5}.
    expect(result!.colorA).toEqual([
      { cell: { row: 0, col: 0 }, digit: 1 },
      { cell: { row: 0, col: 1 }, digit: 5 },
      { cell: { row: 1, col: 0 }, digit: 5 },
      { cell: { row: 1, col: 1 }, digit: 1 },
    ]);
    expect(result!.colorB).toEqual([
      { cell: { row: 0, col: 0 }, digit: 5 },
      { cell: { row: 0, col: 1 }, digit: 1 },
      { cell: { row: 1, col: 0 }, digit: 1 },
      { cell: { row: 1, col: 1 }, digit: 5 },
    ]);

    // Eliminate every colour-A candidate.
    const expectedElims: Array<{ pos: Position; digits: Digit[] }> = [
      { pos: { row: 0, col: 0 }, digits: [1] },
      { pos: { row: 0, col: 1 }, digits: [5] },
      { pos: { row: 1, col: 0 }, digits: [5] },
      { pos: { row: 1, col: 1 }, digits: [1] },
    ];
    expect(result!.eliminations).toHaveLength(expectedElims.length);
    for (const e of expectedElims) {
      const got = findElim(result!.eliminations, e.pos);
      expect(got, `expected elimination at ${e.pos.row},${e.pos.col}`).toBeDefined();
      expect(got!.digits).toEqual(e.digits);
    }

    // Every colour-A node was found; every colour-B node was preserved.
    expect(findNode(result!.colorA, { row: 0, col: 0 }, 1)).toBeDefined();
    expect(findNode(result!.colorA, { row: 1, col: 1 }, 1)).toBeDefined();
    expect(findNode(result!.colorB, { row: 0, col: 0 }, 5)).toBeDefined();
    expect(findNode(result!.colorB, { row: 1, col: 1 }, 5)).toBeDefined();

    expect(result!.explanation).toContain('3D Medusa');
    expect(result!.explanation).toContain('box 1');
    expect(result!.explanation).toContain('R1C1');
    expect(result!.explanation).toContain('R2C2');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = find3DMedusa(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    expect(result!.eliminations).toHaveLength(
      fixture.deduction.eliminations!.length,
    );
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The fixture's patternCells must equal the unique cells covered by the
    // cluster — what the help screen highlights as "the pattern".
    const cellSet = new Set<string>();
    for (const n of [...result!.colorA, ...result!.colorB]) {
      cellSet.add(`${n.cell.row},${n.cell.col}`);
    }
    const finderPattern: Position[] = [...cellSet]
      .map((k) => {
        const [r, c] = k.split(',').map(Number);
        return { row: r, col: c };
      })
      .sort((a, b) => a.row - b.row || a.col - b.col);
    const fixturePattern = [...fixture.patternCells].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    expect(finderPattern).toEqual(fixturePattern);
  });
});
