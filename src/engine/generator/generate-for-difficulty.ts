import type { Variant } from '../types';
import { generate, type GeneratedPuzzle, type GenerateOptions } from './generate';
import {
  rate,
  CLUE_BOUNDS,
  DIFFICULTY_ORDER,
  type Difficulty,
  type RateResult,
} from './rate';

/** Default attempt cap per call (requirements §6.2). */
export const DEFAULT_MAX_ATTEMPTS = 50;
/** Default wall-clock timeout per call in ms (requirements §6.2). */
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Progress event payload emitted after each *rejected* attempt (requirements
 * §6.3). `attempt` is the 1-based count of attempts completed (including the
 * just-rejected one). `max` is the configured `maxRetries` cap, so consumers
 * can render a determinate progress indicator if they wish.
 */
export interface GenerationProgress {
  attempt: number;
  max: number;
}

export interface GenerateForDifficultyOptions {
  /** Optional random seed (32-bit int). Used as a base; retries derive seeds from it. */
  seed?: number;
  /**
   * Maximum number of distinct generation attempts before giving up.
   * Defaults to {@link DEFAULT_MAX_ATTEMPTS} (50). Whichever of `maxRetries`
   * or `timeoutMs` is reached first ends generation in failure.
   */
  maxRetries?: number;
  /**
   * Hard wall-clock timeout in milliseconds. Defaults to
   * {@link DEFAULT_TIMEOUT_MS} (60 000). Once the elapsed time meets or
   * exceeds this value, no further attempts are started and the function
   * returns a structured failure.
   */
  timeoutMs?: number;
  /**
   * Optional callback fired after each *rejected* attempt — i.e. an attempt
   * whose rating did not match the target tier. It is **not** called on the
   * accepted attempt that produces a success result. The Web Worker wrapper
   * (requirements §6.3) uses this to post `{ type: 'progress' }` messages.
   *
   * Exceptions thrown from the callback propagate out of
   * {@link generateForDifficulty} — handle errors inside the callback if you
   * want generation to continue regardless.
   */
  onProgress?: (progress: GenerationProgress) => void;
}

export interface DifficultyGeneratedPuzzle extends GeneratedPuzzle {
  kind: 'success';
  /** The rating for the returned puzzle. */
  rating: RateResult;
  /**
   * Always `true` under the strict tier rule (§6.1). Retained for callers
   * that branch on it; failure is signalled by a `GenerationFailed` result.
   */
  onTarget: true;
}

export interface GenerationFailed {
  kind: 'failed';
  /**
   * Rating of the puzzle whose tier was closest (by `DIFFICULTY_ORDER` rank
   * distance) to the requested target. `null` when no attempt completed —
   * e.g. the timeout fires before the first generation produces a rating.
   */
  closestRating: RateResult | null;
  /** Number of generation attempts started before the budget was exhausted. */
  attempts: number;
  /** Wall-clock time elapsed in milliseconds at the moment of failure. */
  elapsedMs: number;
}

export type GenerateForDifficultyResult =
  | DifficultyGeneratedPuzzle
  | GenerationFailed;

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
 * Generate a puzzle and try to hit the requested difficulty tier.
 *
 * Acceptance is **strict**: a generated puzzle is accepted only when
 * `rate(puzzle).difficulty === target` (exact match, per requirements §6.1).
 * Any other rating — easier or harder — is rejected and the generator retries.
 *
 * Generation is bounded by two budgets (requirements §6.2):
 *   1. `maxRetries` attempts (default 50), and
 *   2. `timeoutMs` wall-clock milliseconds (default 60 000).
 *
 * The timeout is checked before starting each new attempt; an attempt already
 * in flight is allowed to finish, but no further attempts are started once the
 * deadline is past. When either budget is exhausted without a matching tier,
 * the function returns a {@link GenerationFailed} result with the closest tier
 * produced (if any), the attempt count, and elapsed time.
 */
export function generateForDifficulty(
  variant: Variant,
  difficulty: Difficulty,
  options: GenerateForDifficultyOptions = {},
): GenerateForDifficultyResult {
  const maxRetries = Math.max(1, options.maxRetries ?? DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const targetRank = tierRank(difficulty);
  const minCluesHint = clueBoundsLowerForTier(variant.id, difficulty);

  const startedAt = Date.now();
  let attempts = 0;
  let closestRating: RateResult | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  while (attempts < maxRetries && Date.now() - startedAt < timeoutMs) {
    const genOpts: GenerateOptions = {};
    if (options.seed != null) {
      // Derive distinct deterministic seeds from the base seed.
      genOpts.seed = (options.seed + attempts) | 0;
    }
    if (minCluesHint != null) {
      genOpts.minClues = minCluesHint;
    }

    const result = generate(variant, genOpts);
    const rating = rate(result.puzzle);
    attempts++;

    // Strict tier rule (requirements §6.1): accept iff the rating matches the
    // target tier exactly. Easier or harder ratings are rejected and we retry.
    if (rating.difficulty === difficulty) {
      return { ...result, kind: 'success', rating, onTarget: true };
    }

    const distance = Math.abs(tierRank(rating.difficulty) - targetRank);
    if (distance < bestDistance) {
      bestDistance = distance;
      closestRating = rating;
    }

    options.onProgress?.({ attempt: attempts, max: maxRetries });
  }

  return {
    kind: 'failed',
    closestRating,
    attempts,
    elapsedMs: Date.now() - startedAt,
  };
}
