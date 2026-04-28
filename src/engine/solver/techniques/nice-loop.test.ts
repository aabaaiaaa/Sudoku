import { describe, it, expect } from 'vitest';
import { findNiceLoop, type NiceLoopElimination } from './nice-loop';
import { fixture } from './nice-loop.fixture';
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
  eliminations: NiceLoopElimination[],
  pos: Position,
): NiceLoopElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findNiceLoop', () => {
  it('returns null on an empty classic board (no strong links exist)', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findNiceLoop(board)).toBeNull();
  });

  it('returns null on a Mini board with a single 1 placed (strong-link components are disconnected)', () => {
    const board = createEmptyBoard(miniVariant);
    board.cells[0][0] = createGivenCell(1);
    expect(findNiceLoop(board)).toBeNull();
  });

  it('finds the continuous nice loop from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findNiceLoop(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('nice-loop');
    expect(result!.cycleType).toBe('continuous');

    // The DFS, starting at (R1C4, 1) with a strong-edge seed, walks a 6-node
    // cycle that threads through both bivalue corners of the top row and
    // closes via the row-6 conjugate strong link on digit 1.
    expect(result!.nodes).toEqual([
      { pos: { row: 0, col: 3 }, digit: 1 },
      { pos: { row: 0, col: 3 }, digit: 9 },
      { pos: { row: 0, col: 6 }, digit: 9 },
      { pos: { row: 0, col: 6 }, digit: 1 },
      { pos: { row: 5, col: 6 }, digit: 1 },
      { pos: { row: 5, col: 3 }, digit: 1 },
    ]);

    expect(result!.edges).toHaveLength(6);
    expect(result!.edges.map((e) => e.type)).toEqual([
      'strong',
      'weak',
      'strong',
      'weak',
      'strong',
      'weak',
    ]);
    expect(result!.edges.map((e) => e.kind)).toEqual([
      'intra-cell',
      'inter-cell',
      'intra-cell',
      'inter-cell',
      'inter-cell',
      'inter-cell',
    ]);
    expect(result!.edges.map((e) => e.witness)).toEqual([
      'cell R1C4',
      'row 1',
      'cell R1C7',
      'column 7',
      'row 6',
      'column 4',
    ]);

    // Every cell of columns 4 and 7 outside rows 1 and 6 has digit 1
    // eliminated — 7 cells per column.
    expect(result!.eliminations).toHaveLength(14);
    for (const r of [1, 2, 3, 4, 6, 7, 8]) {
      for (const c of [3, 6]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }
    // Loop cells themselves are never eliminations.
    for (const r of [0, 5]) {
      for (const c of [3, 6]) {
        expect(
          findElim(result!.eliminations, { row: r, col: c }),
        ).toBeUndefined();
      }
    }

    expect(result!.explanation).toContain('Nice Loop');
    expect(result!.explanation).toContain('continuous');
  });

  it('continuous nice loop fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findNiceLoop(board);

    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got, `expected elimination at (${expected.pos.row}, ${expected.pos.col})`)
        .toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The pattern cells are the four bivalue corners that anchor the loop.
    const loopCells = new Set(
      result!.nodes.map((n) => `${n.pos.row},${n.pos.col}`),
    );
    for (const cell of fixture.patternCells) {
      expect(loopCells.has(`${cell.row},${cell.col}`)).toBe(true);
    }
  });
});
