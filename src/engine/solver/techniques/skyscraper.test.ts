import { describe, it, expect } from 'vitest';
import {
  findSkyscraper,
  type SkyscraperElimination,
} from './skyscraper';
import { fixture } from './skyscraper.fixture';
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
  eliminations: SkyscraperElimination[],
  pos: Position,
): SkyscraperElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findSkyscraper', () => {
  it('returns null for an empty classic board', () => {
    // Every cell is a candidate for every digit, so no row or column has the
    // digit confined to exactly two candidate cells — no strong links exist.
    const board = createEmptyBoard(classicVariant);
    expect(findSkyscraper(board)).toBeNull();
  });

  it('returns null for an X-Wing pattern (two shared columns, not one)', () => {
    // Row 1 and row 9 each have digit 1 confined to columns 1 and 2 (same two
    // columns). That is an X-Wing, not a Skyscraper — Skyscraper requires
    // exactly one shared column between the two strong links.
    const board = parseBoardString(
      'classic',
      '..2345678' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '..3254769',
    );
    expect(findSkyscraper(board)).toBeNull();
  });

  it('returns null when a single strong link exists but no second row matches', () => {
    // Only row 1 has digit 1 confined to two cells — no other row has a
    // matching strong link, so no Skyscraper is possible.
    const board = parseBoardString(
      'classic',
      '..2345678' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........',
    );
    expect(findSkyscraper(board)).toBeNull();
  });

  it('finds the skyscraper from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findSkyscraper(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('skyscraper');
    expect(result!.digit).toBe(1);
    expect(result!.orientation).toBe('rows');
    expect(result!.baseHouses).toEqual([0, 8]);
    expect(result!.base).toBe(0);
    expect(result!.roof).toEqual([
      { row: 0, col: 1 },
      { row: 8, col: 2 },
    ]);
    expect(result!.baseCells).toEqual([
      { row: 0, col: 0 },
      { row: 8, col: 0 },
    ]);

    expect(result!.eliminations).toHaveLength(4);
    for (const pos of [
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 6, col: 1 },
      { row: 7, col: 1 },
    ]) {
      const elim = findElim(result!.eliminations, pos);
      expect(elim).toBeDefined();
      expect(elim!.digits).toEqual([1]);
    }

    expect(result!.explanation).toContain('tops of a tower');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findSkyscraper(board);

    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }
    expect(result!.eliminations.length).toBe(
      fixture.deduction.eliminations!.length,
    );

    // The fixture's pattern-primary (roof) and pattern-secondary (base) roles
    // must equal the four cells of the two strong links.
    const finderCells: Position[] = [
      ...result!.baseCells,
      ...result!.roof,
    ].sort((a, b) => a.row - b.row || a.col - b.col);
    const fixtureCells = fixture.roles
      .filter((r) => r.role === 'pattern-primary' || r.role === 'pattern-secondary')
      .map((r) => r.pos)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    expect(finderCells).toEqual(fixtureCells);
  });

  it('detects the symmetric column-orientation skyscraper', () => {
    // Mirror of the fixture: digit 1 is confined to two cells in column 1
    // (R1C1, R3C1) and two cells in column 9 (R1C9, R2C9), sharing row 1 as
    // the base. The roofs are R3C1 and R2C9.
    //
    // Column 1: givens at R2C1=2, R4C1=3, R5C1=4, R6C1=5, R7C1=6, R8C1=7,
    //   R9C1=8 leave only R1C1 and R3C1 as 1-candidates.
    // Column 9: givens at R3C9=3, R4C9=2, R5C9=5, R6C9=4, R7C9=7, R8C9=6,
    //   R9C9=9 leave only R1C9 and R2C9 as 1-candidates.
    const board = parseBoardString(
      'classic',
      '........' + '.' +
        '2.......' + '.' +
        '........' + '3' +
        '3.......' + '2' +
        '4.......' + '5' +
        '5.......' + '4' +
        '6.......' + '7' +
        '7.......' + '6' +
        '8.......' + '9',
    );

    const result = findSkyscraper(board);
    expect(result).not.toBeNull();
    expect(result!.digit).toBe(1);
    expect(result!.orientation).toBe('cols');
    expect(result!.baseHouses).toEqual([0, 8]);
    expect(result!.base).toBe(0);
    expect(result!.roof).toEqual([
      { row: 2, col: 0 },
      { row: 1, col: 8 },
    ]);
    expect(result!.baseCells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 8 },
    ]);

    // Cells seeing both roofs (R3C1, R2C9), excluding the roofs themselves
    // and any givens, are exactly: R2C2 and R2C3 (box-peers of R3C1 via box 1
    // and row-peers of R2C9), and R3C7 and R3C8 (row-peers of R3C1 and
    // box-peers of R2C9 via box 3). All four are 1-candidates here.
    expect(result!.eliminations).toHaveLength(4);
    const elimAt = (p: Position): boolean =>
      result!.eliminations.some(
        (e) => e.cell.row === p.row && e.cell.col === p.col,
      );
    expect(elimAt({ row: 1, col: 1 })).toBe(true);
    expect(elimAt({ row: 1, col: 2 })).toBe(true);
    expect(elimAt({ row: 2, col: 6 })).toBe(true);
    expect(elimAt({ row: 2, col: 7 })).toBe(true);
  });
});
