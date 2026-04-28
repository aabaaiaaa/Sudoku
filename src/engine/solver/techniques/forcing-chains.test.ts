import { describe, it, expect } from 'vitest';
import { findForcingChains } from './forcing-chains';
import { fixture } from './forcing-chains.fixture';
import { createEmptyBoard, createGivenCell } from '../../types';
import { classicVariant, miniVariant, sixVariant } from '../../variants';
import type { Board, Digit, Variant } from '../../types';

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

describe('findForcingChains', () => {
  it('returns null on an empty classic board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findForcingChains(board)).toBeNull();
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
    expect(findForcingChains(board)).toBeNull();
  });

  it('returns null on a board with a single given (no propagation converges)', () => {
    // One given leaves every empty cell with eight or nine candidates. Each
    // branch propagation places only the source-cell hypothesis and stops:
    // no naked or hidden singles can fire when the board is this sparse, so
    // no two branches share a placement or an elimination outside the source.
    const board = createEmptyBoard(classicVariant);
    board.cells[0][0].value = 5 as Digit;
    expect(findForcingChains(board)).toBeNull();
  });

  it('finds the forcing-chain placement from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findForcingChains(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('forcing-chains');

    // Source is the first 2-candidate cell in row-major order — R1C1 = {1, 2}.
    expect(result!.source).toEqual({ row: 0, col: 0 });
    expect(result!.sourceDigits).toEqual([1, 2]);

    // The forced placement: R1C4 = 4 in both branches.
    expect(result!.placement).toEqual({
      pos: { row: 0, col: 3 },
      digit: 4,
    });
    expect(result!.eliminations).toEqual([]);

    expect(result!.branches).toHaveLength(2);

    const branchOne = result!.branches[0];
    expect(branchOne.candidate).toBe(1);
    expect(branchOne.contradicted).toBe(false);
    // The first implication is always the source hypothesis.
    expect(branchOne.implications[0]).toEqual({
      pos: { row: 0, col: 0 },
      digit: 1,
    });
    // Branch must place 4 at R1C4 somewhere along the chain.
    expect(
      branchOne.implications.some(
        (i) => i.pos.row === 0 && i.pos.col === 3 && i.digit === 4,
      ),
    ).toBe(true);

    const branchTwo = result!.branches[1];
    expect(branchTwo.candidate).toBe(2);
    expect(branchTwo.contradicted).toBe(false);
    expect(branchTwo.implications[0]).toEqual({
      pos: { row: 0, col: 0 },
      digit: 2,
    });
    expect(
      branchTwo.implications.some(
        (i) => i.pos.row === 0 && i.pos.col === 3 && i.digit === 4,
      ),
    ).toBe(true);

    expect(result!.explanation).toContain('Forcing Chains');
    expect(result!.explanation).toContain('R1C1');
    expect(result!.explanation).toContain('R1C4');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findForcingChains(board);

    expect(result).not.toBeNull();
    expect(fixture.deduction.placement).toBeDefined();
    expect(result!.placement).toEqual(fixture.deduction.placement);
    expect(result!.eliminations).toEqual([]);

    // patternCells equals the source cell — the bivalue cell the help screen
    // highlights as the chain's anchor.
    expect(fixture.patternCells).toEqual([result!.source]);
  });

  it('caps each branch at fifty placements', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findForcingChains(board);
    expect(result).not.toBeNull();
    for (const branch of result!.branches) {
      expect(branch.implications.length).toBeLessThanOrEqual(50);
    }
  });
});
