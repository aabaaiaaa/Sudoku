import { describe, it, expect } from 'vitest';
import { findBugPlus1 } from './bug';
import { fixture, fixturePureBug } from './bug.fixture';
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

describe('findBugPlus1', () => {
  it('returns null for an empty classic board', () => {
    // Every cell has 9 candidates, so no +1 cell can exist.
    const board = createEmptyBoard(classicVariant);
    expect(findBugPlus1(board)).toBeNull();
  });

  it('returns null for a fully solved board (no unsolved cells)', () => {
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
    expect(findBugPlus1(board)).toBeNull();
  });

  it('returns null when only a naked single is present', () => {
    // R5C5 erased on an otherwise-solved grid — exactly one candidate.
    const board = parseBoardString(
      'classic',
      '123456789' +
        '456789123' +
        '789123456' +
        '214365897' +
        '3658.7214' +
        '897214365' +
        '531642978' +
        '642978531' +
        '978531642',
    );
    expect(findBugPlus1(board)).toBeNull();
  });

  it('returns null for a pure BUG state (every unsolved cell bivalue, no +1 cell)', () => {
    const board = parseBoardString(fixturePureBug.variant, fixturePureBug.board);
    expect(findBugPlus1(board)).toBeNull();
  });

  it('finds the BUG+1 placement on the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findBugPlus1(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('bug-plus-one');
    expect(result!.cell).toEqual({ row: 0, col: 1 });
    expect(result!.candidates).toEqual([1, 2, 3]);
    expect(result!.digit).toBe(1);

    // Row 1 is the first house checked and contains three candidate cells
    // for digit 1 (R1C1, R1C2, R1C3 all carry 1).
    expect(result!.forcedHouse).toBe('row');

    expect(result!.explanation).toContain('BUG+1');
    expect(result!.explanation).toContain('R1C2');
    expect(result!.explanation).toContain('1');
  });

  it('fixture deduction matches the placement returned by the finder', () => {
    expect(fixture.deduction.placement).toEqual({
      pos: { row: 0, col: 1 },
      digit: 1,
    });

    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findBugPlus1(board);
    expect(result).not.toBeNull();
    expect({ pos: result!.cell, digit: result!.digit }).toEqual(
      fixture.deduction.placement,
    );
  });
});
