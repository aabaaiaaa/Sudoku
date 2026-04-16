import { describe, it, expect } from 'vitest';
import {
  cloneBoard,
  deserialize,
  emptyBoard,
  findConflicts,
  isComplete,
  serialize,
} from './board';
import { classicVariant, miniVariant, sixVariant } from './variants';
import type { Board, Position } from './types';

function keyOf(p: Position): string {
  return `${p.row},${p.col}`;
}

function keySet(ps: Position[]): Set<string> {
  return new Set(ps.map(keyOf));
}

describe('emptyBoard', () => {
  it('creates a board of the correct size with all empty cells', () => {
    const board = emptyBoard(classicVariant);
    expect(board.variant).toBe(classicVariant);
    expect(board.cells).toHaveLength(9);
    for (const row of board.cells) {
      expect(row).toHaveLength(9);
      for (const cell of row) {
        expect(cell.value).toBeNull();
        expect(cell.given).toBe(false);
        expect(cell.notes.size).toBe(0);
      }
    }
  });

  it('works for mini and six variants', () => {
    expect(emptyBoard(miniVariant).cells).toHaveLength(4);
    expect(emptyBoard(sixVariant).cells).toHaveLength(6);
  });
});

describe('cloneBoard', () => {
  it('produces an independent deep copy', () => {
    const board = emptyBoard(classicVariant);
    board.cells[0][0].value = 5;
    board.cells[0][0].given = true;
    board.cells[0][0].notes.add(3);

    const clone = cloneBoard(board);
    expect(clone.cells[0][0].value).toBe(5);
    expect(clone.cells[0][0].given).toBe(true);
    expect(clone.cells[0][0].notes.has(3)).toBe(true);

    clone.cells[0][0].value = 7;
    clone.cells[0][0].notes.add(9);
    expect(board.cells[0][0].value).toBe(5);
    expect(board.cells[0][0].notes.has(9)).toBe(false);
  });
});

describe('serialize/deserialize', () => {
  it('roundtrips an empty classic board', () => {
    const board = emptyBoard(classicVariant);
    const str = serialize(board);
    const back = deserialize(str);
    expect(back.variant.id).toBe('classic');
    expect(serialize(back)).toBe(str);
  });

  it('roundtrips a populated classic board with notes and givens', () => {
    const board = emptyBoard(classicVariant);
    board.cells[0][0].value = 1;
    board.cells[0][0].given = true;
    board.cells[0][1].value = 2;
    board.cells[1][0].notes.add(3);
    board.cells[1][0].notes.add(5);
    board.cells[8][8].value = 9;
    board.cells[8][8].given = true;

    const str = serialize(board);
    const back = deserialize(str);
    expect(back.cells[0][0].value).toBe(1);
    expect(back.cells[0][0].given).toBe(true);
    expect(back.cells[0][1].value).toBe(2);
    expect(back.cells[0][1].given).toBe(false);
    expect(back.cells[1][0].value).toBeNull();
    expect([...back.cells[1][0].notes].sort()).toEqual([3, 5]);
    expect(back.cells[8][8].value).toBe(9);
    expect(back.cells[8][8].given).toBe(true);
  });

  it('roundtrips mini and six boards', () => {
    for (const variant of [miniVariant, sixVariant]) {
      const board = emptyBoard(variant);
      board.cells[0][0].value = 1;
      board.cells[0][0].given = true;
      const last = variant.size - 1;
      board.cells[last][last].notes.add(2);
      const str = serialize(board);
      const back = deserialize(str);
      expect(back.variant.id).toBe(variant.id);
      expect(back.cells[0][0].value).toBe(1);
      expect(back.cells[0][0].given).toBe(true);
      expect(back.cells[last][last].notes.has(2)).toBe(true);
    }
  });

  it('throws on unknown variant id', () => {
    expect(() => deserialize('nope|' + '.'.repeat(81) + '|' + '0'.repeat(81) + '|' + ','.repeat(80))).toThrow();
  });

  it('throws on malformed input', () => {
    expect(() => deserialize('classic|too-short')).toThrow();
  });
});

describe('isComplete', () => {
  it('returns false for an empty board', () => {
    expect(isComplete(emptyBoard(classicVariant))).toBe(false);
  });

  it('returns false when cells remain unfilled', () => {
    const board = emptyBoard(miniVariant);
    board.cells[0][0].value = 1;
    expect(isComplete(board)).toBe(false);
  });

  it('returns true for a fully filled valid mini board', () => {
    const grid = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    const board = fillBoard(miniVariant, grid);
    expect(isComplete(board)).toBe(true);
  });

  it('returns false for a fully filled board with conflicts', () => {
    const grid = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 2],
    ];
    const board = fillBoard(miniVariant, grid);
    expect(isComplete(board)).toBe(false);
  });
});

describe('findConflicts', () => {
  it('returns no conflicts on an empty board', () => {
    expect(findConflicts(emptyBoard(classicVariant))).toEqual([]);
  });

  it('detects a row conflict', () => {
    const board = emptyBoard(classicVariant);
    board.cells[0][0].value = 5;
    board.cells[0][4].value = 5;
    const keys = keySet(findConflicts(board));
    expect(keys.has('0,0')).toBe(true);
    expect(keys.has('0,4')).toBe(true);
    expect(keys.size).toBe(2);
  });

  it('detects a column conflict', () => {
    const board = emptyBoard(classicVariant);
    board.cells[0][3].value = 7;
    board.cells[6][3].value = 7;
    const keys = keySet(findConflicts(board));
    expect(keys).toEqual(new Set(['0,3', '6,3']));
  });

  it('detects a box conflict', () => {
    const board = emptyBoard(classicVariant);
    board.cells[0][0].value = 2;
    board.cells[2][2].value = 2;
    const keys = keySet(findConflicts(board));
    expect(keys).toEqual(new Set(['0,0', '2,2']));
  });

  it('reports each conflicting cell only once when multiple peers clash', () => {
    const board = emptyBoard(classicVariant);
    board.cells[0][0].value = 4;
    board.cells[0][5].value = 4;
    board.cells[5][0].value = 4;
    const result = findConflicts(board);
    expect(result).toHaveLength(3);
    expect(keySet(result)).toEqual(new Set(['0,0', '0,5', '5,0']));
  });

  it('works for the six variant with a box conflict', () => {
    const board = emptyBoard(sixVariant);
    // 2-row × 3-col box at origin
    board.cells[0][0].value = 6;
    board.cells[1][2].value = 6;
    expect(keySet(findConflicts(board))).toEqual(new Set(['0,0', '1,2']));
  });
});

function fillBoard(variant: import('./types').Variant, grid: number[][]): Board {
  const board = emptyBoard(variant);
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      board.cells[r][c].value = grid[r][c];
    }
  }
  return board;
}
