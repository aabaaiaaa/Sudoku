import { describe, it, expect } from 'vitest';
import { nextStep, techniques, type TechniqueId } from './index';
import { TECHNIQUE_ORDER } from './catalog';
import { createEmptyBoard } from '../../types';
import { classicVariant } from '../../variants';

describe('techniques list', () => {
  it('matches TECHNIQUE_ORDER from catalog (canonical source)', () => {
    const ids: TechniqueId[] = techniques.map((t) => t.id);
    expect(ids).toEqual([...TECHNIQUE_ORDER]);
  });
});

describe('nextStep', () => {
  it('returns null on an empty board', () => {
    const board = createEmptyBoard(classicVariant);
    expect(nextStep(board)).toBeNull();
  });

  it('prefers a naked single over a hidden single when both apply', () => {
    const board = createEmptyBoard(classicVariant);
    // Fill box 0 except (0,0) with 1..8. This makes (0,0) simultaneously a
    // naked single (only 9 is a candidate) AND a hidden single for 9 in box 0.
    board.cells[0][1].value = 1;
    board.cells[0][2].value = 2;
    board.cells[1][0].value = 3;
    board.cells[1][1].value = 4;
    board.cells[1][2].value = 5;
    board.cells[2][0].value = 6;
    board.cells[2][1].value = 7;
    board.cells[2][2].value = 8;

    const result = nextStep(board);
    expect(result).not.toBeNull();
    expect(result!.technique).toBe('naked-single');
  });

  it('returns a hidden single when no naked single exists', () => {
    const board = createEmptyBoard(classicVariant);
    // Place digit 9 in each row and column surrounding box 0 so that box 0's
    // only legal position for digit 9 is (0,0). No cell on the board has its
    // peers covering 8 distinct digits, so there are no naked singles.
    board.cells[1][3].value = 9;
    board.cells[2][4].value = 9;
    board.cells[3][1].value = 9;
    board.cells[4][2].value = 9;

    const result = nextStep(board);
    expect(result).not.toBeNull();
    if (result?.technique !== 'hidden-single') {
      throw new Error(`expected hidden-single, got ${result?.technique}`);
    }
    expect(result.cell).toEqual({ row: 0, col: 0 });
    expect(result.digit).toBe(9);
  });

});
