import { describe, it, expect } from 'vitest';
import { findAlsXz, findAllAls, type AlsXzElimination } from './als-xz';
import { fixture } from './als-xz.fixture';
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
  eliminations: AlsXzElimination[],
  pos: Position,
): AlsXzElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findAllAls', () => {
  it('returns no ALSes on a board with no empty cells', () => {
    const board = parseBoardString(
      'classic',
      '123456789' +
        '456789123' +
        '789123456' +
        '214365897' +
        '365897214' +
        '897214365' +
        '531642978' +
        '642978531' +
        '978531642',
    );
    expect(findAllAls(board)).toEqual([]);
  });

  it('detects bivalue cells in the fixture as single-cell ALSes', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const found = findAllAls(board);
    // Each bivalue empty cell on the fixture board is a 1-cell ALS.
    const r1c1 = found.find(
      (a) =>
        a.cells.length === 1 &&
        a.cells[0].row === 0 &&
        a.cells[0].col === 0,
    );
    expect(r1c1).toBeDefined();
    expect(r1c1!.candidates).toEqual([1, 2]);

    const r5c1 = found.find(
      (a) =>
        a.cells.length === 1 &&
        a.cells[0].row === 4 &&
        a.cells[0].col === 0,
    );
    expect(r5c1).toBeDefined();
    expect(r5c1!.candidates).toEqual([1, 3]);
  });
});

describe('findAlsXz', () => {
  it('returns null on an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findAlsXz(board)).toBeNull();
  });

  it('returns null when only a single empty cell exists', () => {
    // BUG solution with only R1C1 erased: a single empty cell can produce at
    // most one ALS, so ALS-XZ — which requires two disjoint ALSes — cannot
    // fire.
    const board = parseBoardString(
      'classic',
      '.23456789' +
        '456789123' +
        '789123456' +
        '214365897' +
        '365897214' +
        '897214365' +
        '531642978' +
        '642978531' +
        '978531642',
    );
    expect(findAlsXz(board)).toBeNull();
  });

  it('returns null when no two ALSes share a restricted-common digit', () => {
    // Mini grid with one given (R1C1 = 1). Empty cells are mostly trivalent
    // {2, 3, 4} or full {1, 2, 3, 4}; some 2-cell ALSes exist but none of the
    // pairs satisfy the all-see-all restricted-common requirement (an A cell
    // with X must see every B cell with X).
    const board = createEmptyBoard(miniVariant);
    board.cells[0][0] = createGivenCell(1);
    expect(findAlsXz(board)).toBeNull();
  });

  it('finds the ALS-XZ inference from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findAlsXz(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('als-xz');

    // Deterministic ordering picks single-cell ALS R1C1 paired with single-
    // cell ALS R4C1, both bivalue {1, 2} sharing column 1. With the
    // restricted common iterated ascending (X = 1 then X = 2), X = 1 yields
    // no eliminations (no empty cell in column 1 outside the pair has 2 in
    // its candidates), so the algorithm advances to X = 2 / Z = 1 which
    // eliminates 1 from R5C1.
    expect(result!.alsA.cells).toEqual([{ row: 0, col: 0 }]);
    expect(result!.alsA.candidates).toEqual([1, 2]);
    expect(result!.alsB.cells).toEqual([{ row: 3, col: 0 }]);
    expect(result!.alsB.candidates).toEqual([1, 2]);
    expect(result!.x).toBe(2);
    expect(result!.z).toBe(1);

    expect(result!.eliminations).toHaveLength(1);
    const elim = findElim(result!.eliminations, { row: 4, col: 0 });
    expect(elim).toBeDefined();
    expect(elim!.digits).toEqual([1]);

    expect(result!.explanation).toContain('ALS-XZ');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findAlsXz(board);
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

    // The fixture's patternCells must equal the union of A's and B's cells —
    // what the help screen highlights as "the pattern".
    const finderPattern: Position[] = [
      ...result!.alsA.cells,
      ...result!.alsB.cells,
    ].sort((a, b) => a.row - b.row || a.col - b.col);
    const fixturePattern = [...fixture.roles.filter(r => r.role !== 'elimination' && r.role !== 'placement').map(r => r.pos)].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    expect(finderPattern).toEqual(fixturePattern);
  });
});
