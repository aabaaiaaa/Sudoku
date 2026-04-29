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
 * can each have an independently-traceable fixture. For each cell we reuse
 * the firstHitSeed recorded in scripts/tier-distribution.summary.json after
 * iteration-6 tuning (the corrected baseline produced under solved-aware
 * tracking), or the lever-2 summary for cells restored at a lowered floor,
 * so the fixture is reproducible by re-running:
 *
 *   const clueFloor = CLUE_BOUNDS[variantId][tier]?.[0];
 *   const { puzzle } = generate(variant, { seed, clueFloor });
 *
 * Hard and Master are omitted because no variant has a firstHitSeed for them
 * in the iteration-6 corrected baseline — the generator's natural distribution
 * does not produce these tiers within the retry budget.
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
  // classic:Hard, classic:Master — unobtainable in iteration-6 corrected baseline
  'classic:Expert': {
    variant: 'classic',
    board:
      '......5....4....122....3.674....16...18..9...7...38.......5.98...7.........6..1.3',
    seed: 301,
  },
  'classic:Diabolical': {
    variant: 'classic',
    board:
      '.....29.5....7.32.7...9.....3..86....8.9..1.7....4.8..25...8.....8...4...4..6..3.',
    seed: 504,
  },
  'classic:Demonic': {
    variant: 'classic',
    board:
      '62..8.....5..4.2...4..5..131..9.4..773......1.......5.8....56.9...7..........3...',
    seed: 612,
  },
  'classic:Nightmare': {
    variant: 'classic',
    board:
      '...4.....3...16.5..2..8..7...73.59..6.4.2...8.....8.1............9...6....26.1.43',
    seed: 703,
  },
  // six:Medium restored in iteration 6 via lever-2 (clueFloor lowered from 18
  // to 14); seed/board from scripts/tier-distribution.lever2.summary.json
  // `six:Medium@14`.
  'six:Medium': {
    variant: 'six',
    board: '16...2...6...2..43.341......61.1.2..',
    seed: 1102,
  },
};

/**
 * Parse a `${variant}:${tier}` key and return the tier component.
 */
export function tierFromKey(key: string): Difficulty {
  const [, tier] = key.split(':');
  return tier as Difficulty;
}
