import { describe, it, expect } from 'vitest';
import { findSwordfish, type SwordfishElimination } from './swordfish';
import { fixture } from './swordfish.fixture';
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
  eliminations: SwordfishElimination[],
  pos: Position,
): SwordfishElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findSwordfish', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findSwordfish(board)).toBeNull();
  });

  it('returns null when only two rows confine the digit (X-wing-shaped)', () => {
    // Two rows where digit 1 is restricted to the same two columns; this is an
    // X-wing, not a swordfish. Swordfish requires three base rows whose
    // candidate columns union to exactly three.
    const board = createEmptyBoard(classicVariant);
    const row0 = [2, 3, 4, 0, 5, 6, 0, 7, 8];
    const row5 = [5, 6, 7, 0, 8, 2, 0, 3, 4];
    for (let c = 0; c < 9; c++) {
      if (row0[c] !== 0) board.cells[0][c].value = row0[c];
      if (row5[c] !== 0) board.cells[5][c].value = row5[c];
    }
    expect(findSwordfish(board)).toBeNull();
  });

  it('finds the row-orientation swordfish from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findSwordfish(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('swordfish');
    expect(result!.digit).toBe(1);
    expect(result!.orientation).toBe('rows');
    expect(result!.baseHouses).toEqual([0, 4, 8]);
    expect(result!.coverHouses).toEqual([0, 4, 8]);
    expect(result!.cells).toEqual(fixture.roles.filter(r => r.role !== 'elimination' && r.role !== 'placement').map(r => r.pos));

    // Digit 1 should be eliminated from columns 0, 4, 8 in every row outside
    // the three base rows.
    for (const r of [1, 2, 3, 5, 6, 7]) {
      for (const c of [0, 4, 8]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }
    expect(result!.eliminations.length).toBe(18);

    // The nine swordfish cells themselves must not appear as eliminations.
    for (const r of [0, 4, 8]) {
      for (const c of [0, 4, 8]) {
        expect(findElim(result!.eliminations, { row: r, col: c })).toBeUndefined();
      }
    }

    expect(result!.explanation).toContain('rows 1, 5, and 9');
    expect(result!.explanation).toContain('columns 1, 5, and 9');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findSwordfish(board);
    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
  });

  it('finds a column-orientation swordfish (transposed fixture)', () => {
    // Transpose of the row-orientation fixture: place the same givens with
    // (row, col) swapped, so digit 1 is confined to rows {0, 4, 8} in columns
    // 0, 4, and 8 — a column-oriented swordfish with eliminations in
    // rows 0, 4, 8 outside those columns.
    const board = createEmptyBoard(classicVariant);
    const placements: Array<[number, number, Digit]> = [
      [1, 0, 2], [2, 0, 3], [3, 0, 4], [5, 0, 5], [6, 0, 6], [7, 0, 7],
      [1, 4, 4], [2, 4, 5], [3, 4, 6], [5, 4, 7], [6, 4, 8], [7, 4, 9],
      [1, 8, 3], [2, 8, 2], [3, 8, 7], [5, 8, 8], [6, 8, 9], [7, 8, 4],
    ];
    for (const [r, c, d] of placements) {
      board.cells[r][c].value = d;
    }

    const result = findSwordfish(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('swordfish');
    expect(result!.digit).toBe(1);
    expect(result!.orientation).toBe('cols');
    expect(result!.baseHouses).toEqual([0, 4, 8]);
    expect(result!.coverHouses).toEqual([0, 4, 8]);

    for (const c of [1, 2, 3, 5, 6, 7]) {
      for (const r of [0, 4, 8]) {
        const elim = findElim(result!.eliminations, { row: r, col: c });
        expect(elim, `expected elimination at (${r}, ${c})`).toBeDefined();
        expect(elim!.digits).toEqual([1]);
      }
    }
    expect(result!.eliminations.length).toBe(18);

    expect(result!.explanation).toContain('columns 1, 5, and 9');
    expect(result!.explanation).toContain('rows 1, 5, and 9');
  });

  it('returns null when three base rows union to four or more columns', () => {
    // Three rows whose digit-1 candidate columns are {0, 4}, {4, 8}, {0, 7}.
    // The union {0, 4, 7, 8} has size four, so no swordfish exists despite
    // each row having only two candidate cells.
    const board = createEmptyBoard(classicVariant);
    // Row 0: 1 candidate at cols 0 and 4 only.
    const row0 = [0, 2, 3, 4, 0, 5, 6, 7, 8];
    // Row 4: 1 candidate at cols 4 and 8 only.
    const row4 = [5, 6, 7, 8, 0, 2, 3, 4, 0];
    // Row 8: 1 candidate at cols 0 and 7 only (col 7 is outside {0, 4, 8}).
    const row8 = [0, 8, 9, 2, 3, 4, 5, 0, 6];
    for (let c = 0; c < 9; c++) {
      if (row0[c] !== 0) board.cells[0][c].value = row0[c];
      if (row4[c] !== 0) board.cells[4][c].value = row4[c];
      if (row8[c] !== 0) board.cells[8][c].value = row8[c];
    }
    expect(findSwordfish(board)).toBeNull();
  });
});
