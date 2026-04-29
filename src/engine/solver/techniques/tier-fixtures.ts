import type { Difficulty } from '../../generator/rate';

export interface TierFixture {
  variant: 'classic' | 'six' | 'mini';
  /** Row-major dotted-digit string. '.' = empty, '1'-'9' = given. */
  board: string;
  seed: number;
}

/**
 * One fixture per advertised tier (requirements §9). For each tier we reuse
 * the firstHitSeed recorded in scripts/tier-distribution.summary.json after
 * iteration-4 tuning, so the fixture is reproducible by re-running:
 *
 *   const clueFloor = CLUE_BOUNDS[variantId][tier]?.[0];
 *   const { puzzle } = generate(variant, { seed, clueFloor });
 *
 * Hard and Master are omitted because no variant has a firstHitSeed for them
 * in the iteration-4 baseline — the generator's natural distribution does not
 * produce these tiers within the retry budget.
 */
export const TIER_FIXTURES: Partial<Record<Difficulty, TierFixture>> = {
  Easy: {
    variant: 'classic',
    board:
      '6457..8.....58.4...8.9.67.5754.3..2912.4.7.8........7449...8...3.8624.5..1..79...',
    seed: 0,
  },
  Medium: {
    variant: 'classic',
    board:
      '1........9...3.8644.7.6.29.....7...5..9.58..3..1..698..935.7..6....8..5..549...7.',
    seed: 102,
  },
  // Hard: omitted — unobtainable in any variant after iteration-4 tuning
  Expert: {
    variant: 'classic',
    board:
      '......5....4....122....3.674....16...18..9...7...38.......5.98...7.........6..1.3',
    seed: 301,
  },
  // Master: omitted — unobtainable in any variant after iteration-4 tuning
  Diabolical: {
    variant: 'classic',
    board:
      '....4..8..6....1..8..3.2......2..3645.68....9.....9...12.......3.5..7......1.8.9.',
    seed: 502,
  },
  Demonic: {
    variant: 'classic',
    board:
      '9....67.3...51.8....68....1.9..2....7.8.6..2.4.......7.54.........1.7..9....8....',
    seed: 600,
  },
  Nightmare: {
    variant: 'classic',
    board:
      '...4.....3...16.5..2..8..7...73.59..6.4.2...8.....8.1............9...6....26.1.43',
    seed: 703,
  },
};
