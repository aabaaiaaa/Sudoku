import { describe, it, expect } from 'vitest';
import { boxPeers, colPeers, peers, rowPeers } from './peers';
import { classicVariant, miniVariant, sixVariant } from './variants';
import type { Position } from './types';

function toKeys(positions: Position[]): Set<string> {
  return new Set(positions.map((p) => `${p.row},${p.col}`));
}

describe('rowPeers', () => {
  it('returns all cells in the same row except self for classic', () => {
    const result = rowPeers(classicVariant, { row: 4, col: 4 });
    expect(result).toHaveLength(8);
    const keys = toKeys(result);
    expect(keys.has('4,4')).toBe(false);
    for (let c = 0; c < 9; c++) {
      if (c === 4) continue;
      expect(keys.has(`4,${c}`)).toBe(true);
    }
  });

  it('returns 3 peers for mini', () => {
    const result = rowPeers(miniVariant, { row: 0, col: 0 });
    expect(result).toHaveLength(3);
    expect(toKeys(result)).toEqual(new Set(['0,1', '0,2', '0,3']));
  });

  it('returns 5 peers for six', () => {
    const result = rowPeers(sixVariant, { row: 2, col: 3 });
    expect(result).toHaveLength(5);
  });
});

describe('colPeers', () => {
  it('returns all cells in the same column except self for classic', () => {
    const result = colPeers(classicVariant, { row: 4, col: 4 });
    expect(result).toHaveLength(8);
    const keys = toKeys(result);
    for (let r = 0; r < 9; r++) {
      if (r === 4) continue;
      expect(keys.has(`${r},4`)).toBe(true);
    }
  });

  it('returns 3 peers for mini', () => {
    const result = colPeers(miniVariant, { row: 1, col: 2 });
    expect(result).toHaveLength(3);
    expect(toKeys(result)).toEqual(new Set(['0,2', '2,2', '3,2']));
  });

  it('returns 5 peers for six', () => {
    const result = colPeers(sixVariant, { row: 0, col: 0 });
    expect(result).toHaveLength(5);
  });
});

describe('boxPeers', () => {
  it('returns 8 cells in the 3x3 box for classic center', () => {
    const result = boxPeers(classicVariant, { row: 4, col: 4 });
    expect(result).toHaveLength(8);
    const keys = toKeys(result);
    for (let r = 3; r <= 5; r++) {
      for (let c = 3; c <= 5; c++) {
        if (r === 4 && c === 4) continue;
        expect(keys.has(`${r},${c}`)).toBe(true);
      }
    }
  });

  it('returns 3 cells in the 2x2 box for mini corner', () => {
    const result = boxPeers(miniVariant, { row: 0, col: 0 });
    expect(result).toHaveLength(3);
    expect(toKeys(result)).toEqual(new Set(['0,1', '1,0', '1,1']));
  });

  it('returns 5 cells in the 2x3 box for six', () => {
    const result = boxPeers(sixVariant, { row: 0, col: 0 });
    expect(result).toHaveLength(5);
    // box is boxHeight=2 rows × boxWidth=3 cols anchored at (0,0)
    expect(toKeys(result)).toEqual(new Set(['0,1', '0,2', '1,0', '1,1', '1,2']));
  });

  it('computes the correct box origin for non-origin cells in six', () => {
    const result = boxPeers(sixVariant, { row: 3, col: 4 });
    // boxHeight=2 → row box starts at 2; boxWidth=3 → col box starts at 3
    const keys = toKeys(result);
    expect(result).toHaveLength(5);
    expect(keys).toEqual(new Set(['2,3', '2,4', '2,5', '3,3', '3,5']));
  });
});

describe('peers (combined)', () => {
  it('returns 20 unique peers for classic center', () => {
    const result = peers(classicVariant, { row: 4, col: 4 });
    expect(result).toHaveLength(20);
    expect(toKeys(result).has('4,4')).toBe(false);
  });

  it('returns 20 unique peers for a classic corner', () => {
    const result = peers(classicVariant, { row: 0, col: 0 });
    expect(result).toHaveLength(20);
  });

  it('returns 7 unique peers for mini', () => {
    const result = peers(miniVariant, { row: 0, col: 0 });
    expect(result).toHaveLength(7);
  });

  it('returns 12 unique peers for six', () => {
    const result = peers(sixVariant, { row: 2, col: 3 });
    expect(result).toHaveLength(12);
  });

  it('excludes the origin cell', () => {
    const result = peers(classicVariant, { row: 2, col: 7 });
    expect(toKeys(result).has('2,7')).toBe(false);
  });

  it('deduplicates positions that appear in row/col/box', () => {
    // every key in the peer set should be unique
    const result = peers(classicVariant, { row: 4, col: 4 });
    const keys = result.map((p) => `${p.row},${p.col}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
