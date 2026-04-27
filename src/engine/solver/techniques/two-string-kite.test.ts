import { describe, it, expect } from 'vitest';
import {
  findTwoStringKite,
  type TwoStringKiteElimination,
} from './two-string-kite';
import { fixture } from './two-string-kite.fixture';
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
  eliminations: TwoStringKiteElimination[],
  pos: Position,
): TwoStringKiteElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findTwoStringKite', () => {
  it('returns null for an empty classic board', () => {
    // Every cell is a candidate for every digit, so no row or column has a
    // digit confined to exactly two candidate cells — no strong links exist.
    const board = createEmptyBoard(classicVariant);
    expect(findTwoStringKite(board)).toBeNull();
  });

  it('returns null when a row strong link and a column strong link exist but no row-cell shares a box with a column-cell', () => {
    // Row 1 has digit 1 confined to R1C1 and R1C9 (boxes 1 and 3); column 5
    // has digit 1 confined to R2C5 and R8C5 (boxes 2 and 8). None of the four
    // row-cell × column-cell pairs share a box, so the kite cannot form.
    const board = parseBoardString(
      'classic',
      '.2345678.' +
        '.........' +
        '....2....' +
        '....3....' +
        '....4....' +
        '....7....' +
        '....6....' +
        '.........' +
        '....8....',
    );
    expect(findTwoStringKite(board)).toBeNull();
  });

  it('finds the kite from the fixture and yields the expected elimination', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findTwoStringKite(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('two-string-kite');
    expect(result!.digit).toBe(1);
    expect(result!.rowLinkRow).toBe(0);
    expect(result!.colLinkCol).toBe(5);
    expect(result!.rowBoxCell).toEqual({ row: 0, col: 4 });
    expect(result!.colBoxCell).toEqual({ row: 1, col: 5 });
    expect(result!.rowTail).toEqual({ row: 0, col: 7 });
    expect(result!.colTail).toEqual({ row: 7, col: 5 });

    expect(result!.eliminations).toHaveLength(1);
    const elim = findElim(result!.eliminations, { row: 7, col: 7 });
    expect(elim).toBeDefined();
    expect(elim!.digits).toEqual([1]);

    expect(result!.explanation).toContain('Two-String Kite');
    expect(result!.explanation).toContain('R1C5');
    expect(result!.explanation).toContain('R2C6');
    expect(result!.explanation).toContain('R1C8');
    expect(result!.explanation).toContain('R8C6');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findTwoStringKite(board);

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

    // The fixture's patternCells are the four cells of the two strong links —
    // the row-link box cell, the row tail, the col-link box cell, and the col
    // tail.
    const finderCells: Position[] = [
      result!.rowBoxCell,
      result!.rowTail,
      result!.colBoxCell,
      result!.colTail,
    ].sort((a, b) => a.row - b.row || a.col - b.col);
    const fixtureCells = [...fixture.patternCells].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    expect(finderCells).toEqual(fixtureCells);
  });
});
