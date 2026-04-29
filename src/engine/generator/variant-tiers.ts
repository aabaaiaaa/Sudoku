import type { Variant } from '../types';
import { DIFFICULTY_ORDER, type Difficulty } from './rate';

/**
 * Difficulty tiers advertised per variant. The list is *not* guaranteed to be
 * a prefix of `DIFFICULTY_ORDER` — tiers the generator/rater cannot reliably
 * hit on a given grid are descoped (requirements §7 lever 3) so they are not
 * advertised to the player.
 *
 * Sources:
 *   1. Iteration-6 corrected baseline,
 *      `scripts/tier-distribution.summary.json` (generated 2026-04-29 with
 *      the §4.1 `solvedRate` fix; sampleSize 20 per cell, full
 *      `DIFFICULTY_ORDER × {classic, six, mini}` sweep via `--all-tiers`).
 *      `solvedRate` is the load-bearing rate (rated as target tier AND
 *      `result.solved === true`); the production code path rejects unsolved
 *      ratings, so this is what advertised tiers must clear.
 *   2. Iteration-6 lever-2 sweep,
 *      `scripts/tier-distribution.lever2.summary.json` (generated 2026-04-29,
 *      sampleSize 20 per cell, 14 synthetic cells via
 *      `--clue-floor-override` exploring lower clueFloors for the
 *      previously-descoped Six and Mini tiers).
 *
 * Restoration rule: any (variant, tier, floor) cell with
 * `solvedRate ≥ 0.05` in the lever-2 summary restores the tier in the
 * advertised list (and lowers `CLUE_BOUNDS[variant][tier][0]` to that
 * floor in `rate.ts`).
 *
 * Lever-2 ranges explored (so a future iteration knows what was already
 * tried — current `CLUE_BOUNDS` lower bounds in parentheses):
 *   - six.Medium     (was 18) — floors 14, 16
 *   - six.Hard       (was 15) — floors 11, 13
 *   - six.Expert     (was 12) — floors 8, 10
 *   - six.Master     (was 13) — floors 9, 11
 *   - six.Diabolical (was 11) — floors 7, 9
 *   - mini.Medium    (was 10) — floors 6, 8
 *   - mini.Hard      (was  8) — floors 5, 7
 *
 * Lever-2 restorations (variant, tier, floor, solvedRate, sampleSize):
 *   - (six, Medium, 14, 0.05, 20) — restored. clueFloor lowered from 18 to
 *     14 in `rate.ts`. `MAX_ATTEMPTS_BY_TIER.Medium` widened to 122 per the
 *     reliability formula on this cell.
 *
 * Remaining descopes (variant, tier, solvedRate, sampleSize). Cited from
 * the iteration-6 corrected baseline; the lever-2 sweep at lower floors
 * (per the ranges above) did not rescue any of these — every tested floor
 * returned solvedRate=0:
 *   - (classic, Hard,       0, 20)
 *   - (classic, Master,     0, 20)
 *   - (six,     Hard,       0, 20) — the 6×6 rater chain produces almost
 *   - (six,     Expert,     0, 20)   exclusively Easy/Medium at every
 *   - (six,     Master,     0, 20)   tested clueFloor; Hard+ patterns are
 *   - (six,     Diabolical, 0, 20)   statistically unreachable on this grid.
 *   - (mini,    Medium,     0, 20) — the 4×4 rater chain produces 100%
 *   - (mini,    Hard,       0, 20)   Easy at every tested clueFloor (5–12).
 */
const VARIANT_TIERS: Record<string, readonly Difficulty[]> = {
  classic: ['Easy', 'Medium', 'Expert', 'Diabolical', 'Demonic', 'Nightmare'],
  six: ['Easy', 'Medium'],
  mini: ['Easy'],
};

/**
 * Difficulty tiers that should be shown for the given variant, in ascending
 * order. Returns the per-variant list above. Unknown variant ids fall back to
 * the full `DIFFICULTY_ORDER`.
 */
export function availableTiers(variant: Variant): readonly Difficulty[] {
  return VARIANT_TIERS[variant.id] ?? DIFFICULTY_ORDER;
}
