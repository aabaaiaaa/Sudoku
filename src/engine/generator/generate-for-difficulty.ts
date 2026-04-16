import type { Variant } from '../types';
import { generate, type GeneratedPuzzle, type GenerateOptions } from './generate';
import {
  rate,
  CLUE_BOUNDS,
  DIFFICULTY_ORDER,
  type Difficulty,
  type RateResult,
} from './rate';

export interface GenerateForDifficultyOptions {
  /** Optional random seed (32-bit int). Used as a base; retries derive seeds from it. */
  seed?: number;
  /** Max retries (distinct generation attempts) before giving up. Default 40. */
  maxRetries?: number;
}

export interface DifficultyGeneratedPuzzle extends GeneratedPuzzle {
  /** The rating for the returned puzzle. */
  rating: RateResult;
  /** True when the produced puzzle matched the requested tier exactly. */
  onTarget: boolean;
}

function tierRank(d: Difficulty): number {
  return DIFFICULTY_ORDER.indexOf(d);
}

/**
 * Returns the clue-count lower bound for the given variant/difficulty, or
 * `undefined` if the variant isn't listed in `CLUE_BOUNDS`. This value is used
 * as the `minClues` hint for `generate` so that generation biases toward the
 * target tier (Easy keeps more clues, Expert removes more).
 */
function clueBoundsLowerForTier(
  variantId: string,
  difficulty: Difficulty,
): number | undefined {
  const entry = CLUE_BOUNDS[variantId];
  if (entry == null) return undefined;
  const window = entry[difficulty];
  if (window == null) return undefined;
  return window[0];
}

/**
 * Generate a puzzle and try to hit the requested difficulty tier. Repeatedly
 * calls `generate` with deterministically-derived seeds (when `seed` is
 * provided) and rates each result. Returns the first puzzle whose rating
 * matches the target tier; if no attempt matches within `maxRetries`, returns
 * the closest-rated attempt (by `DIFFICULTY_ORDER` rank distance; ties go to
 * the first encountered) with `onTarget: false`.
 */
export function generateForDifficulty(
  variant: Variant,
  difficulty: Difficulty,
  options: GenerateForDifficultyOptions = {},
): DifficultyGeneratedPuzzle {
  const maxRetries = options.maxRetries ?? 40;
  const attempts = Math.max(1, maxRetries);
  const targetRank = tierRank(difficulty);
  const minCluesHint = clueBoundsLowerForTier(variant.id, difficulty);

  let best: DifficultyGeneratedPuzzle | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < attempts; i++) {
    const genOpts: GenerateOptions = {};
    if (options.seed != null) {
      // Derive distinct deterministic seeds from the base seed.
      genOpts.seed = (options.seed + i) | 0;
    }
    if (minCluesHint != null) {
      genOpts.minClues = minCluesHint;
    }

    const result = generate(variant, genOpts);
    const rating = rate(result.puzzle);

    if (rating.difficulty === difficulty) {
      return { ...result, rating, onTarget: true };
    }

    const distance = Math.abs(tierRank(rating.difficulty) - targetRank);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { ...result, rating, onTarget: false };
    }
  }

  // Should always be set since attempts >= 1, but guard for the type-checker.
  if (best == null) {
    throw new Error('generateForDifficulty: no attempts were made');
  }
  return best;
}
