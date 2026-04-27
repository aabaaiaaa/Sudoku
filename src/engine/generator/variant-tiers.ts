import type { Variant } from '../types';
import { DIFFICULTY_ORDER, type Difficulty } from './rate';

/**
 * Highest difficulty tier the generator can realistically produce per variant.
 * Smaller grids cannot mathematically require advanced techniques, so the UI
 * hides infeasible tiers per the requirements §4.1.
 */
const VARIANT_TIER_CAP: Record<string, Difficulty> = {
  classic: 'Nightmare',
  six: 'Diabolical',
  mini: 'Hard',
};

/**
 * Difficulty tiers that should be shown for the given variant, in ascending
 * order. Returns the prefix of `DIFFICULTY_ORDER` up to and including the
 * variant's cap. Unknown variant ids fall back to the full tier range.
 */
export function availableTiers(variant: Variant): readonly Difficulty[] {
  const cap = VARIANT_TIER_CAP[variant.id] ?? 'Nightmare';
  const capIdx = DIFFICULTY_ORDER.indexOf(cap);
  return DIFFICULTY_ORDER.slice(0, capIdx + 1);
}
