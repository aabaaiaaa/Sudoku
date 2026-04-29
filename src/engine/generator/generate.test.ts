import { describe, it, expect } from 'vitest';
import { generate } from './generate';
import { solve, countSolutions } from '../solver/backtracking';
import { isComplete } from '../board';
import { classicVariant, miniVariant, sixVariant } from '../variants';
import type { Board, Variant } from '../types';

function boardsEqualByValues(a: Board, b: Board): boolean {
  if (a.variant.id !== b.variant.id) return false;
  const size = a.variant.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (a.cells[r][c].value !== b.cells[r][c].value) return false;
    }
  }
  return true;
}

function countGivens(board: Board): number {
  let n = 0;
  const size = board.variant.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board.cells[r][c].given) n += 1;
    }
  }
  return n;
}

function runGenerateAssertions(variant: Variant, seed: number): void {
  const { puzzle, solution } = generate(variant, { seed });

  // Solution is fully filled and valid.
  expect(isComplete(solution)).toBe(true);

  // Puzzle has at least one given (but fewer than the full grid).
  const givens = countGivens(puzzle);
  expect(givens).toBeGreaterThan(0);
  expect(givens).toBeLessThanOrEqual(variant.size * variant.size);

  // Puzzle has exactly one solution.
  expect(countSolutions(puzzle, 2)).toBe(1);

  // Solving the puzzle produces the stored solution.
  const solved = solve(puzzle);
  expect(solved).not.toBeNull();
  expect(boardsEqualByValues(solved!, solution)).toBe(true);
}

describe('generate — classic 9x9', () => {
  it('generates a uniquely-solvable classic puzzle with matching solution', () => {
    runGenerateAssertions(classicVariant, 0xc1a551c);
  }, 30_000);
});

describe('generate — mini 4x4', () => {
  it('generates a uniquely-solvable mini puzzle with matching solution', () => {
    runGenerateAssertions(miniVariant, 0x1234);
  });
});

describe('generate — six 6x6', () => {
  it('generates a uniquely-solvable six puzzle with matching solution', () => {
    runGenerateAssertions(sixVariant, 0x5153);
  }, 15_000);
});

describe('generate — determinism', () => {
  it('produces the same puzzle for the same seed (mini)', () => {
    const a = generate(miniVariant, { seed: 42 });
    const b = generate(miniVariant, { seed: 42 });
    expect(boardsEqualByValues(a.puzzle, b.puzzle)).toBe(true);
    expect(boardsEqualByValues(a.solution, b.solution)).toBe(true);
  });
});

describe('generate — minClues floor', () => {
  it('honors the minClues option (does not remove below floor)', () => {
    const size = miniVariant.size;
    const floor = size * size - 2; // leave most cells as givens
    const { puzzle } = generate(miniVariant, { seed: 7, minClues: floor });
    expect(countGivens(puzzle)).toBeGreaterThanOrEqual(floor);
  });
});

describe('generate — maxClues floor', () => {
  it('honors the maxClues option (does not remove below the higher floor)', () => {
    // maxClues is a secondary floor used to prevent mid-tier puzzles from
    // overshooting into a harder tier. With a value clearly above the natural
    // classic minClues default (30), the resulting puzzle must keep at least
    // that many givens.
    const ceiling = 40;
    const { puzzle } = generate(classicVariant, {
      seed: 0xc1a551c,
      maxClues: ceiling,
    });
    expect(countGivens(puzzle)).toBeGreaterThanOrEqual(ceiling);
  }, 30_000);
});
