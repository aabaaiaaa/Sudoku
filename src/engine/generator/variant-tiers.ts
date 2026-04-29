import type { Variant } from '../types';
import { DIFFICULTY_ORDER, type Difficulty } from './rate';

/**
 * Difficulty tiers advertised per variant, after iteration 4 §6 data-driven
 * tuning. The list is *not* guaranteed to be a prefix of `DIFFICULTY_ORDER` —
 * tiers the generator/rater cannot reliably hit on a given grid are descoped
 * (lever 3) so they are not advertised to the player.
 *
 * Source: `scripts/tier-distribution.summary.json` baseline (committed in
 * TASK-003, generated 2026-04-29). Each descoped tier had a `rate` of 0
 * (advertised, sampleSize=20) and could not be rescued by lever 1 (attempt
 * budget — formula gave N > 200) or lever 2 (lower the clueFloor — already
 * at the lower bound of `CLUE_BOUNDS[tier]`).
 *
 * Descopes:
 *   - classic.Hard       — summary `classic:Hard` rate=0; not produced at any
 *                          clueFloor 20–38 in the baseline histogram.
 *   - classic.Master     — summary `classic:Master` rate=0; baseline at
 *                          clueFloor=26 produced 55% Medium / 15% Expert /
 *                          20% Nightmare and zero Master across all profiled
 *                          floors.
 *   - six.Medium / Hard / Expert / Master / Diabolical
 *                        — summary entries rate=0 across the board. The 6×6
 *                          rater chain produces almost exclusively Easy at
 *                          every legal clueFloor (12–22); the harder tiers
 *                          are statistically unreachable on this grid.
 *   - mini.Medium / Hard — summary entries rate=0; the 4×4 rater chain
 *                          produces 100% Easy at clueFloors 8–12.
 */
const VARIANT_TIERS: Record<string, readonly Difficulty[]> = {
  classic: ['Easy', 'Medium', 'Expert', 'Diabolical', 'Demonic', 'Nightmare'],
  six: ['Easy'],
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
