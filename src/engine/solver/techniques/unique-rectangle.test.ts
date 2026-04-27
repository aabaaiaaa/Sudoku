import { describe, it, expect } from 'vitest';
import {
  findUniqueRectangle,
  type UniqueRectangleElimination,
  type UniqueRectangleResult,
} from './unique-rectangle';
import {
  fixtureType1,
  fixtureType2,
  fixtureType4,
} from './unique-rectangle.fixture';
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
  eliminations: UniqueRectangleElimination[],
  pos: Position,
): UniqueRectangleElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

function sortPositions(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => a.row - b.row || a.col - b.col);
}

function assertExpectedEliminations(
  result: UniqueRectangleResult,
  expected: Array<{ pos: Position; digits: Digit[] }>,
): void {
  expect(result.eliminations.length).toBe(expected.length);
  for (const e of expected) {
    const got = findElim(result.eliminations, e.pos);
    expect(got).toBeDefined();
    expect(got!.digits).toEqual(e.digits);
  }
}

describe('findUniqueRectangle', () => {
  it('returns null for an empty classic board', () => {
    // Every cell has 9 candidates, so no four corners share a {X, Y} pair.
    const board = createEmptyBoard(classicVariant);
    expect(findUniqueRectangle(board)).toBeNull();
  });

  it('returns null when only one row is constrained to a bivalue {1, 2} pair', () => {
    // Row 4 is missing only digits 1 and 2, so R4C1 and R4C4 have candidates
    // {1, 2}. But every other row is empty: cells in rows 1-3 and 5-9 have
    // many candidates, no other bivalue {1, 2} cells exist, and no rectangle
    // with all four corners restricted to {1, 2} can form. With only one
    // bivalue per "side", no UR pattern fires.
    const board = parseBoardString(
      'classic',
      '.........' +
        '.........' +
        '.........' +
        '.45.67893' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '.........',
    );
    expect(findUniqueRectangle(board)).toBeNull();
  });

  describe('Type 1', () => {
    it('finds the Type 1 pattern from the fixture', () => {
      const board = parseBoardString(fixtureType1.variant, fixtureType1.board);
      const result = findUniqueRectangle(board);

      expect(result).not.toBeNull();
      expect(result!.technique).toBe('unique-rectangle');
      expect(result!.type).toBe(1);
      expect(result!.digits).toEqual([1, 2]);

      const corners = sortPositions([...result!.corners]);
      expect(corners).toEqual([
        { row: 3, col: 0 },
        { row: 3, col: 3 },
        { row: 4, col: 0 },
        { row: 4, col: 3 },
      ]);

      expect(sortPositions(result!.floorCells)).toEqual([
        { row: 3, col: 0 },
        { row: 3, col: 3 },
        { row: 4, col: 0 },
      ]);
      expect(result!.roofCells).toEqual([{ row: 4, col: 3 }]);

      assertExpectedEliminations(result!, fixtureType1.deduction.eliminations!);

      expect(result!.explanation).toContain('Type 1');
      expect(result!.explanation).toContain('R5C4');
    });

    it('fixture pattern cells match the rectangle the finder identifies', () => {
      const board = parseBoardString(fixtureType1.variant, fixtureType1.board);
      const result = findUniqueRectangle(board);
      expect(result).not.toBeNull();
      const finderCorners = sortPositions([...result!.corners]);
      const fixtureCells = sortPositions(fixtureType1.patternCells);
      expect(finderCorners).toEqual(fixtureCells);
    });
  });

  describe('Type 2', () => {
    it('finds the Type 2 pattern from the fixture', () => {
      const board = parseBoardString(fixtureType2.variant, fixtureType2.board);
      const result = findUniqueRectangle(board);

      expect(result).not.toBeNull();
      expect(result!.technique).toBe('unique-rectangle');
      expect(result!.type).toBe(2);
      expect(result!.digits).toEqual([1, 2]);
      expect(result!.extraDigit).toBe(3);

      const corners = sortPositions([...result!.corners]);
      expect(corners).toEqual([
        { row: 3, col: 0 },
        { row: 3, col: 3 },
        { row: 4, col: 0 },
        { row: 4, col: 3 },
      ]);

      expect(sortPositions(result!.floorCells)).toEqual([
        { row: 3, col: 3 },
        { row: 4, col: 3 },
      ]);
      expect(sortPositions(result!.roofCells)).toEqual([
        { row: 3, col: 0 },
        { row: 4, col: 0 },
      ]);

      assertExpectedEliminations(result!, fixtureType2.deduction.eliminations!);

      expect(result!.explanation).toContain('Type 2');
    });
  });

  describe('Type 4', () => {
    it('finds the Type 4 pattern from the fixture', () => {
      const board = parseBoardString(fixtureType4.variant, fixtureType4.board);
      const result = findUniqueRectangle(board);

      expect(result).not.toBeNull();
      expect(result!.technique).toBe('unique-rectangle');
      expect(result!.type).toBe(4);
      expect(result!.digits).toEqual([1, 2]);
      expect(result!.confinedDigit).toBe(1);
      expect(result!.sharedHouse).toBe('row');

      const corners = sortPositions([...result!.corners]);
      expect(corners).toEqual([
        { row: 3, col: 0 },
        { row: 3, col: 3 },
        { row: 4, col: 0 },
        { row: 4, col: 3 },
      ]);

      expect(sortPositions(result!.floorCells)).toEqual([
        { row: 3, col: 0 },
        { row: 3, col: 3 },
      ]);
      expect(sortPositions(result!.roofCells)).toEqual([
        { row: 4, col: 0 },
        { row: 4, col: 3 },
      ]);

      assertExpectedEliminations(result!, fixtureType4.deduction.eliminations!);

      expect(result!.explanation).toContain('Type 4');
    });
  });
});
