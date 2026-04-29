import { describe, expect, it } from 'vitest';
import { TIER_FIXTURES } from './tier-fixtures';
import { rate, type Difficulty } from '../../generator/rate';
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

describe('TIER_FIXTURES round-trip', () => {
  const cases = Object.entries(TIER_FIXTURES) as Array<
    [Difficulty, NonNullable<(typeof TIER_FIXTURES)[Difficulty]>]
  >;

  it.each(cases)(
    '%s fixture rates as %s',
    (tier, fixture) => {
      const board = parseBoardString(fixture.variant, fixture.board);
      const result = rate(board);
      expect(
        result.difficulty,
        `${tier} fixture (variant=${fixture.variant}, seed=${fixture.seed}) rated as ${result.difficulty}`,
      ).toBe(tier);
    },
  );
});
