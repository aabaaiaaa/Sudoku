import { describe, it, expect } from 'vitest';
import { findXyChain, type XyChainElimination } from './xy-chain';
import { fixture } from './xy-chain.fixture';
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
  eliminations: XyChainElimination[],
  pos: Position,
): XyChainElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

describe('findXyChain', () => {
  it('returns null for an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findXyChain(board)).toBeNull();
  });

  it('returns null when fewer than four bivalue cells exist', () => {
    // A single given leaves all empty cells with eight or nine candidates.
    const board = createEmptyBoard(classicVariant);
    board.cells[0][0].value = 1 as Digit;
    expect(findXyChain(board)).toBeNull();
  });

  it('returns null for an XY-Wing pattern (length-3 chain rejected)', () => {
    // Reuse the XY-Wing fixture: three bivalue cells {1,2}, {2,3}, {1,3} that
    // form an XY-Wing on Z = 3. XY-Chain requires at least four cells, so this
    // shorter pattern must be ignored — XY-Wing fires earlier in the rater.
    const board = parseBoardString(
      'classic',
      '...4.59..' +
        '456.1....' +
        '78.......' +
        '..9.6....' +
        '....7....' +
        '3.2.8....' +
        '.........' +
        '.........' +
        '.........',
    );
    expect(findXyChain(board)).toBeNull();
  });

  it('finds the XY-Chain from the fixture and yields the expected eliminations', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findXyChain(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('xy-chain');
    expect(result!.z).toBe(3);

    // The finder iterates starting cells in row-major order and digits
    // ascending, so the chain emerges from R1C2 forward through R9C8.
    const expectedChain: Array<{ pos: Position; digits: [Digit, Digit] }> = [
      { pos: { row: 0, col: 1 }, digits: [1, 3] },
      { pos: { row: 3, col: 1 }, digits: [1, 2] },
      { pos: { row: 3, col: 7 }, digits: [2, 4] },
      { pos: { row: 8, col: 7 }, digits: [3, 4] },
    ];
    expect(result!.chain).toEqual(expectedChain);

    // Z = 3 is eliminated from the two cells seeing both endpoints.
    const expected: Position[] = [
      { row: 0, col: 7 },
      { row: 8, col: 1 },
    ];
    for (const pos of expected) {
      const elim = findElim(result!.eliminations, pos);
      expect(elim, `expected elimination at ${pos.row},${pos.col}`).toBeDefined();
      expect(elim!.digits).toEqual([3]);
    }
    expect(result!.eliminations.length).toBe(expected.length);

    // Chain cells themselves never appear as eliminations.
    expect(findElim(result!.eliminations, { row: 0, col: 1 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 3, col: 1 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 3, col: 7 })).toBeUndefined();
    expect(findElim(result!.eliminations, { row: 8, col: 7 })).toBeUndefined();

    expect(result!.explanation).toContain('XY-Chain');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findXyChain(board);
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

    // The fixture's patternCells must equal the chain cells found by the finder.
    const finderCells = result!.chain
      .map((c) => c.pos)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    const fixtureCells = [...fixture.patternCells].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    expect(finderCells).toEqual(fixtureCells);
  });
});
