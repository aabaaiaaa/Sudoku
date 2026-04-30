import { describe, it, expect } from 'vitest';
import {
  findDeathBlossom,
  type DeathBlossomElimination,
} from './death-blossom';
import { fixture } from './death-blossom.fixture';
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
  eliminations: DeathBlossomElimination[],
  pos: Position,
): DeathBlossomElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findDeathBlossom', () => {
  it('returns null on an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findDeathBlossom(board)).toBeNull();
  });

  it('returns null on a fully solved board', () => {
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
    expect(findDeathBlossom(board)).toBeNull();
  });

  it('returns null on a BUG-style board where no Z is shared across petals', () => {
    // Solution grid with seven cells erased — same shape as the ALS-XZ
    // fixture. Every empty cell shares its candidates with the stem ({1, 2}
    // or {1, 3} or {1, 6}), so no candidate Z exists outside the stem that
    // is also present in two disjoint petals.
    const board = parseBoardString(
      'classic',
      '..3456789' +
        '456789123' +
        '789123456' +
        '..4365897' +
        '..58972.4' +
        '897214365' +
        '531642978' +
        '642978531' +
        '978531642',
    );
    expect(findDeathBlossom(board)).toBeNull();
  });

  it('finds the death-blossom inference from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findDeathBlossom(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('death-blossom');

    // First valid stem in row-major order is R1C1 (R0C0) with cands {1, 2}.
    expect(result!.stem).toEqual({ row: 0, col: 0 });
    expect(result!.stemDigits).toEqual([1, 2]);

    // Petals listed in stem-digit ascending order. The first single-cell
    // ALS containing each stem digit and seeing the stem is picked: R1C3
    // ({1, 3}) for digit 1 (row 1) and R1C5 ({2, 3}) for digit 2 (row 1).
    expect(result!.petals).toHaveLength(2);
    expect(result!.petals[0].stemDigit).toBe(1);
    expect(result!.petals[0].als.cells).toEqual([{ row: 0, col: 2 }]);
    expect(result!.petals[0].als.candidates).toEqual([1, 3]);
    expect(result!.petals[1].stemDigit).toBe(2);
    expect(result!.petals[1].als.cells).toEqual([{ row: 0, col: 4 }]);
    expect(result!.petals[1].als.candidates).toEqual([2, 3]);

    expect(result!.z).toBe(3);

    // Eliminations are the row-1 cells outside {stem, petals} carrying 3.
    expect(result!.eliminations).toHaveLength(3);
    for (const target of [
      { row: 0, col: 1 },
      { row: 0, col: 7 },
      { row: 0, col: 8 },
    ]) {
      const elim = findElim(result!.eliminations, target);
      expect(elim).toBeDefined();
      expect(elim!.digits).toEqual([3]);
    }

    expect(result!.explanation).toContain('Death Blossom');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findDeathBlossom(board);
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

    // patternCells must equal stem ∪ all petal cells — the cells the help
    // screen highlights as "the pattern".
    const finderPattern: Position[] = [
      result!.stem,
      ...result!.petals.flatMap((p) => p.als.cells),
    ].sort((a, b) => a.row - b.row || a.col - b.col);
    const fixturePattern = [...fixture.patternCells].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    expect(finderPattern).toEqual(fixturePattern);
  });
});
