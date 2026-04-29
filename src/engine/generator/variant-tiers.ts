import type { Variant } from '../types';
import { DIFFICULTY_ORDER, type Difficulty } from './rate';

/**
 * Difficulty tiers advertised per variant. The list is *not* guaranteed to be
 * a prefix of `DIFFICULTY_ORDER` — tiers the generator/rater cannot reliably
 * hit on a given grid are descoped (requirements §7 lever 3) so they are not
 * advertised to the player.
 *
 * Source: iteration-5 post-fix baseline
 * `scripts/tier-distribution.summary.json` (generated 2026-04-29, sampleSize
 * 20 per cell, full `DIFFICULTY_ORDER × {classic, six, mini}` sweep via
 * `--all-tiers`). Lever 1 (widen `MAX_ATTEMPTS_BY_TIER`) was applied per
 * that baseline; the remaining descopes below have rate=0 in the summary
 * and cannot be rescued by lever 1 (formula gives N > 200) or lever 2
 * (clueFloor already at the lower bound of `CLUE_BOUNDS[tier]`).
 *
 * Remaining descopes (variant, tier, rate, sampleSize):
 *   - (classic, Hard,       0, 20)
 *   - (classic, Master,     0, 20)
 *   - (six,     Medium,     0, 20) — the 6×6 rater chain produces almost
 *   - (six,     Hard,       0, 20)   exclusively Easy at every legal
 *   - (six,     Expert,     0, 20)   clueFloor (12–22); harder tiers are
 *   - (six,     Master,     0, 20)   statistically unreachable on this grid.
 *   - (six,     Diabolical, 0, 20)
 *   - (mini,    Medium,     0, 20) — the 4×4 rater chain produces 100%
 *   - (mini,    Hard,       0, 20)   Easy at clueFloors 8–12.
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
