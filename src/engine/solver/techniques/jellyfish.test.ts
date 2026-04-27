import { describe, it, expect } from 'vitest';
import { findJellyfish, type JellyfishElimination } from './jellyfish';
import { fixture } from './jellyfish.fixture';
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
  eliminations: JellyfishElimination[],
  pos: Position,
): JellyfishElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findJellyfish', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findJellyfish(board)).toBeNull();
  });

  it('returns null when only three rows confine the digit (swordfish-shaped)', () => {
    // Three rows where digit 1 is restricted to the same three columns; this
    // is a swordfish, not a jellyfish. Jellyfish requires four base rows whose
    // candidate columns union to exactly four.
    const board = parseBoardString(
      'classic',
      '.234.567.' +
        '.........' +
        '.........' +
        '.........' +
        '.456.789.' +
        '.........' +
        '.........' +
        '.........' +
        '.327.894.',
    );
    expect(findJellyfish(board)).toBeNull();
  });

  it('finds the row-orientation jellyfish from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findJellyfish(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('jellyfish');
    expect(result!.digit).toBe(1);
    expect(result!.orientation).toBe('rows');
    expect(result!.baseHouses).toEqual([0, 2, 6, 8]);
    expect(result!.coverHouses).toEqual([0, 2, 6, 8]);
    expect(result!.cells).toEqual(fixture.patternCells);

    // Digit 1 should be eliminated from columns 0, 2, 6, 8 in every row outside
    // the four base rows.
    for (const r of [1, 3, 4, 5, 7]) {
      for (const c of [0, 2, 6, 8]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }
    expect(result!.eliminations.length).toBe(20);

    // The sixteen jellyfish cells themselves must not appear as eliminations.
    for (const r of [0, 2, 6, 8]) {
      for (const c of [0, 2, 6, 8]) {
        expect(findElim(result!.eliminations, { row: r, col: c })).toBeUndefined();
      }
    }

    expect(result!.explanation).toContain('jellyfish');
    expect(result!.explanation).toContain('rows 1, 3, 7, 9');
    expect(result!.explanation).toContain('columns 1, 3, 7, 9');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findJellyfish(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
  });

  it('finds a column-orientation jellyfish (transposed fixture)', () => {
    // Transpose of the row-orientation fixture: place the same givens with
    // (row, col) swapped, so digit 1 is confined to rows {0, 2, 6, 8} in
    // columns 0, 2, 6, and 8 — a column-oriented jellyfish with eliminations
    // in rows 0, 2, 6, 8 outside those columns.
    const board = createEmptyBoard(classicVariant);
    const placements: Array<[number, number, Digit]> = [
      [1, 0, 2], [3, 0, 3], [4, 0, 4], [5, 0, 5], [7, 0, 6],
      [1, 2, 3], [3, 2, 6], [4, 2, 7], [5, 2, 8], [7, 2, 2],
      [1, 6, 4], [3, 6, 5], [4, 6, 6], [5, 6, 7], [7, 6, 8],
      [1, 8, 5], [3, 8, 8], [4, 8, 9], [5, 8, 2], [7, 8, 4],
    ];
    for (const [r, c, d] of placements) {
      board.cells[r][c].value = d;
    }

    const result = findJellyfish(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('jellyfish');
    expect(result!.digit).toBe(1);
    expect(result!.orientation).toBe('cols');
    expect(result!.baseHouses).toEqual([0, 2, 6, 8]);
    expect(result!.coverHouses).toEqual([0, 2, 6, 8]);

    for (const c of [1, 3, 4, 5, 7]) {
      for (const r of [0, 2, 6, 8]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }
    expect(result!.eliminations.length).toBe(20);

    expect(result!.explanation).toContain('columns 1, 3, 7, 9');
    expect(result!.explanation).toContain('rows 1, 3, 7, 9');
  });

  it('returns null when four base rows union to five or more columns', () => {
    // Four rows whose digit-1 candidate columns are {0, 4}, {4, 8}, {0, 7},
    // {3, 8}. Each row qualifies as a base row (n in [2, 4]), but their union
    // {0, 3, 4, 7, 8} has size five, so no jellyfish exists.
    const board = createEmptyBoard(classicVariant);
    const row0 = [0, 2, 3, 4, 0, 5, 6, 7, 8];
    const row2 = [5, 6, 7, 8, 0, 2, 3, 4, 0];
    const row6 = [0, 8, 9, 2, 3, 4, 5, 0, 6];
    const row8 = [4, 5, 6, 0, 7, 8, 9, 2, 0];
    for (let c = 0; c < 9; c++) {
      if (row0[c] !== 0) board.cells[0][c].value = row0[c];
      if (row2[c] !== 0) board.cells[2][c].value = row2[c];
      if (row6[c] !== 0) board.cells[6][c].value = row6[c];
      if (row8[c] !== 0) board.cells[8][c].value = row8[c];
    }
    expect(findJellyfish(board)).toBeNull();
  });
});
