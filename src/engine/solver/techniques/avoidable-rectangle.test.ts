import { describe, it, expect } from 'vitest';
import { findAvoidableRectangle } from './avoidable-rectangle';
import { fixture } from './avoidable-rectangle.fixture';
import { createEmptyBoard, createGivenCell } from '../../types';
import { classicVariant, miniVariant, sixVariant } from '../../variants';
import type { Board, Cell, Digit, Position, Variant } from '../../types';

function variantFor(name: 'classic' | 'six' | 'mini'): Variant {
  if (name === 'classic') return classicVariant;
  if (name === 'six') return sixVariant;
  return miniVariant;
}

function placedCell(value: Digit): Cell {
  return { value, notes: new Set<Digit>(), given: false };
}

/**
 * Parse an Avoidable-Rectangle-style board string. In addition to the
 * usual conventions ('1'-'9' = given, '.'/'0' = empty), lowercase
 * 'a'-'i' encode placed (non-given) values 1-9 — which is the
 * distinction the AR pattern hinges on.
 */
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
    if (ch >= '1' && ch <= '9') {
      const d = Number.parseInt(ch, 10);
      if (d < 1 || d > variant.size) {
        throw new Error(`Bad given '${ch}' at index ${i}`);
      }
      board.cells[r][c] = createGivenCell(d as Digit);
      continue;
    }
    if (ch >= 'a' && ch <= 'i') {
      const d = ch.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
      if (d < 1 || d > variant.size) {
        throw new Error(`Bad placement '${ch}' at index ${i}`);
      }
      board.cells[r][c] = placedCell(d as Digit);
      continue;
    }
    throw new Error(`Bad cell '${ch}' at index ${i}`);
  }
  return board;
}

function sortPositions(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => a.row - b.row || a.col - b.col);
}

describe('findAvoidableRectangle', () => {
  it('returns null for an empty classic board', () => {
    // No values are placed, so no rectangle can have three non-given
    // corners. The pattern cannot form.
    const board = createEmptyBoard(classicVariant);
    expect(findAvoidableRectangle(board)).toBeNull();
  });

  it('finds the Avoidable Rectangle pattern from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findAvoidableRectangle(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('avoidable-rectangle');
    expect(result!.digits).toEqual([1, 2]);
    expect(result!.targetCell).toEqual({ row: 1, col: 3 });
    expect(result!.eliminatedDigit).toBe(1);
    expect(result!.forcedDigit).toBe(3);

    expect(sortPositions([...result!.corners])).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 3 },
      { row: 1, col: 0 },
      { row: 1, col: 3 },
    ]);

    expect(sortPositions([...result!.filledCorners])).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 3 },
      { row: 1, col: 0 },
    ]);

    expect(result!.eliminations).toHaveLength(1);
    expect(result!.eliminations[0].cell).toEqual({ row: 1, col: 3 });
    expect(result!.eliminations[0].digits).toEqual([1]);

    expect(result!.explanation).toContain('Avoidable Rectangle');
    expect(result!.explanation).toContain('R1C1');
    expect(result!.explanation).toContain('R2C4');
  });

  it('fixture pattern cells match the rectangle the finder identifies', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findAvoidableRectangle(board);
    expect(result).not.toBeNull();
    expect(sortPositions([...result!.corners])).toEqual(
      sortPositions(fixture.patternCells),
    );
  });

  it('returns null when one of the placed corners is a given clue instead', () => {
    // Same board as the fixture, but R1C1 is now a given (uppercase '1')
    // rather than a placed value ('a'). The Avoidable Rectangle reasoning
    // requires every filled corner to be non-given — a given anchors the
    // diagonal value and blocks the U↔V swap argument — so the pattern no
    // longer fires.
    const board = parseBoardString(
      'classic',
      '145b67.89' +
        'b...45...' +
        '...8.....' +
        '...9.....' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........',
    );
    expect(findAvoidableRectangle(board)).toBeNull();
  });

  it('returns null when the bivalue cell does not contain the deadly digit', () => {
    // Same rectangle, but the four givens that constrained R2C4's
    // candidates are rearranged so R2C4 no longer has 1 as a candidate:
    // R2C5 is changed to 1, which excludes 1 from R2C4 by row. Without
    // the deadly digit in the bivalue cell, there is nothing to
    // eliminate.
    const board = parseBoardString(
      'classic',
      'a45b67.89' +
        'b...15...' +
        '...8.....' +
        '...9.....' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........',
    );
    expect(findAvoidableRectangle(board)).toBeNull();
  });
});
