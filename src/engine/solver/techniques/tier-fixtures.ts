import type { Difficulty } from '../../generator/rate';

export interface TierFixture {
  variant: 'classic' | 'six' | 'mini';
  /** Row-major dotted-digit string. '.' = empty, '1'-'9' = given. */
  board: string;
  seed: number;
}

/**
 * One fixture per advertised (variant, tier) cell. Keys are
 * `${variant}:${tier}` so multi-variant tiers (e.g. Medium in classic and six)
 * can each have an independently-traceable fixture. Seeds and boards are
 * sourced from `firstHitSeed` / `firstHitBoard` in
 * `scripts/tier-distribution.summary.json` (iteration-7 corrected baseline,
 * 2026-04-30, n=50, solved-aware tracking). Fixtures are reproducible via:
 *
 *   const clueFloor = CLUE_BOUNDS[variantId][tier]?.[0];
 *   const { puzzle } = generate(variant, { seed, clueFloor });
 */
export const TIER_FIXTURES: Record<string, TierFixture> = {
  'classic:Easy': {
    variant: 'classic',
    board:
      '6457..8.....58.4...8.9.67.5754.3..2912.4.7.8........7449...8...3.8624.5..1..79...',
    seed: 0,
  },
  'classic:Medium': {
    variant: 'classic',
    board:
      '1........9...3.8644.7.6.29.....7...5..9.58..3..1..698..935.7..6....8..5..549...7.',
    seed: 102,
  },
  'classic:Hard': {
    variant: 'classic',
    board:
      '..6.1......97.5..1...9....8..72......5....6.9..1..3..4.751.2.8..........3..89.5..',
    seed: 201,
  },
  'classic:Expert': {
    variant: 'classic',
    board:
      '.9148.......5....9.8...7.......9.7.2...8.5...54.17..8..6......1....3..2...9....4.',
    seed: 333,
  },
  'classic:Master': {
    variant: 'classic',
    board:
      '3....4.82.7..6....4...12.....8...19.26...8.....3....5.6...7...3..........5....61.',
    seed: 431,
  },
  'classic:Nightmare': {
    variant: 'classic',
    board:
      '5..6.27...1...93....3....5...4....6.8.51.........8......1.6..7.73......8.....79.3',
    seed: 514,
  },
  // six:Easy and mini:Easy added in iteration 7 (closes review G1).
  'six:Easy': {
    variant: 'six',
    board: '2.5631...25.41.3.53.6142.31.26..4.1.',
    seed: 1000,
  },
  // six:Medium restored in iteration 6 via lever-2 (clueFloor lowered from 18 to 14).
  'six:Medium': {
    variant: 'six',
    board: '16...2...6...2..43.341......61.1.2..',
    seed: 1102,
  },
  'mini:Easy': {
    variant: 'mini',
    board: '..41.1321.242413',
    seed: 2000,
  },
};

/**
 * Parse a `${variant}:${tier}` key and return the tier component.
 */
export function tierFromKey(key: string): Difficulty {
  const [, tier] = key.split(':');
  return tier as Difficulty;
}
