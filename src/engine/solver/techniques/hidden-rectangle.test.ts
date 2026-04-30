import { describe, it, expect } from 'vitest';
import { findHiddenRectangle } from './hidden-rectangle';
import { fixture } from './hidden-rectangle.fixture';
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

function sortPositions(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => a.row - b.row || a.col - b.col);
}

describe('findHiddenRectangle', () => {
  it('returns null for an empty classic board', () => {
    // Every cell has nine candidates; no bivalue corner can exist, so the
    // anchor condition fails everywhere.
    const board = createEmptyBoard(classicVariant);
    expect(findHiddenRectangle(board)).toBeNull();
  });

  it('finds the Hidden Rectangle pattern from the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findHiddenRectangle(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('hidden-rectangle');
    expect(result!.digits).toEqual([1, 2]);
    expect(result!.anchor).toEqual({ row: 0, col: 0 });
    expect(result!.diagonal).toEqual({ row: 1, col: 3 });
    expect(result!.diagonalRowMate).toEqual({ row: 1, col: 0 });
    expect(result!.diagonalColMate).toEqual({ row: 0, col: 3 });
    expect(result!.eliminatedDigit).toBe(1);

    const corners = sortPositions([...result!.corners]);
    expect(corners).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 3 },
      { row: 1, col: 0 },
      { row: 1, col: 3 },
    ]);

    expect(result!.eliminations).toHaveLength(1);
    expect(result!.eliminations[0].cell).toEqual({ row: 1, col: 3 });
    expect(result!.eliminations[0].digits).toEqual([1]);

    expect(result!.explanation).toContain('Hidden Rectangle');
  });

  it('fixture pattern cells match the rectangle the finder identifies', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findHiddenRectangle(board);
    expect(result).not.toBeNull();
    const finderCorners = sortPositions([...result!.corners]);
    const fixtureCells = sortPositions(fixture.roles.filter(r => r.role !== 'elimination' && r.role !== 'placement').map(r => r.pos));
    expect(finderCorners).toEqual(fixtureCells);
  });

  it('returns null when the column strong link is missing', () => {
    // Drop the R4C5 = 1 given that pins 1 within box (middle-middle) away
    // from column 4. Without it, R4C4..R6C4 all keep 1 as a candidate, so
    // the conjugate-pair condition on column 4 between R1C4 and R2C4 no
    // longer holds. The Hidden Rectangle pattern fails — no other
    // bivalue rectangle in this sparsely-given puzzle satisfies both
    // strong links.
    const board = parseBoardString(
      'classic',
      '.45.67.89' +
        '.36.94.57' +
        '........1' +
        '.........' +
        '.........' +
        '.........' +
        '.....1...' +
        '.........' +
        '.........',
    );
    expect(findHiddenRectangle(board)).toBeNull();
  });
});
