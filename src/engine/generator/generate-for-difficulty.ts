import type { Variant } from '../types';
import { generate, type GeneratedPuzzle, type GenerateOptions } from './generate';
import {
  rate,
  CLUE_BOUNDS,
  DIFFICULTY_ORDER,
  type Difficulty,
  type RateResult,
} from './rate';

/**
 * Per-tier attempt cap per call (Iteration 3 §4.3). Hard/Expert/Master are
 * mid-range tiers whose generator distribution doesn't reliably hit the
 * target inside 50 tries, so they get a larger 100-attempt budget.
 * Diabolical/Demonic/Nightmare keep 50 because each attempt is much more
 * expensive — they typically consume the full 60s wall-clock budget anyway.
 * Easy/Medium are cheap and almost always match within 50.
 */
export const MAX_ATTEMPTS_BY_TIER: Record<Difficulty, number> = {
  Easy: 50,
  Medium: 50,
  Hard: 100,
  Expert: 100,
  Master: 100,
  Diabolical: 50,
  Demonic: 50,
  Nightmare: 50,
};
/**
 * Legacy default attempt cap (requirements §6.2). Retained for callers and
 * tests that branch on a single canonical default; the per-tier table in
 * {@link MAX_ATTEMPTS_BY_TIER} is the source of truth at call time.
 */
export const DEFAULT_MAX_ATTEMPTS = 50;
/** Default wall-clock timeout per call in ms (requirements §6.2). */
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Returns the default attempts budget for the given target tier (Iteration 3
 * §4.3). Callers can still override via `options.maxRetries`.
 */
export function defaultMaxAttemptsForTier(difficulty: Difficulty): number {
  return MAX_ATTEMPTS_BY_TIER[difficulty] ?? DEFAULT_MAX_ATTEMPTS;
}

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
   * Defaults to the per-tier value in {@link MAX_ATTEMPTS_BY_TIER} (50 for
   * Easy/Medium and Diabolical/Demonic/Nightmare; 100 for Hard/Expert/Master).
   * Whichever of `maxRetries` or `timeoutMs` is reached first ends generation
   * in failure.
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
  /**
   * Best-effort message from the most recent attempt that threw. Captured so
   * that finder bugs surface to the UI without crashing generation. Undefined
   * when no attempt threw during the run.
   */
  lastError?: string;
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
 * as the `clueFloor` hint for `generate` so that generation biases toward the
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

function normalizeDifficulty(value: string): Difficulty | null {
  if (value == null) return null;
  const lc = String(value).toLowerCase();
  for (const tier of DIFFICULTY_ORDER) {
    if (tier.toLowerCase() === lc) return tier;
  }
  return null;
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
  // Defensive normalisation: callers from the UI layer (Home → store →
  // worker) pass slugs like 'easy', while DIFFICULTY_ORDER and rate() use
  // Title Case. Without this, strict tier matching would never succeed for
  // requests originating from the UI.
  const normalized = normalizeDifficulty(difficulty);
  if (normalized == null) {
    throw new Error(`Unknown difficulty tier: ${String(difficulty)}`);
  }
  difficulty = normalized;

  const maxRetries = Math.max(
    1,
    options.maxRetries ?? defaultMaxAttemptsForTier(difficulty),
  );
  const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const targetRank = tierRank(difficulty);
  const clueFloorHint = clueBoundsLowerForTier(variant.id, difficulty);

  const startedAt = Date.now();
  let attempts = 0;
  let closestRating: RateResult | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let lastError: string | undefined;

  while (attempts < maxRetries && Date.now() - startedAt < timeoutMs) {
    const genOpts: GenerateOptions = {};
    if (options.seed != null) {
      // Derive distinct deterministic seeds from the base seed.
      genOpts.seed = (options.seed + attempts) | 0;
    }
    if (clueFloorHint != null) {
      genOpts.clueFloor = clueFloorHint;
    }

    // Per-attempt try/catch (requirements §4.1): a finder bug must never
    // throw out of generateForDifficulty. Count the failed attempt against
    // the retry budget, capture a best-effort error message, and continue.
    try {
      const result = generate(variant, genOpts);
      const rating = rate(result.puzzle);
      attempts++;

      // Reject any puzzle the cascade couldn't fully solve (requirements §4.4).
      // After removing the 'Expert' fallback in rate.ts, `solved: false` is the
      // authoritative "stalled" signal — we must not accept such puzzles even
      // when the difficulty field happens to match the target. Unsolved
      // ratings also do not contribute to closestRating since the rated tier
      // is not trustworthy.
      if (!rating.solved) {
        options.onProgress?.({ attempt: attempts, max: maxRetries });
        continue;
      }

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
    } catch (err) {
      attempts++;
      const baseMessage = err instanceof Error ? err.message : String(err);
      // If the thrown error carries a `technique` identifier (some finders
      // attach this for triage), prefix the message so the UI can surface it.
      const techniqueId =
        err != null && typeof err === 'object' && 'technique' in err
          ? String((err as { technique?: unknown }).technique ?? '')
          : '';
      lastError = techniqueId ? `[${techniqueId}] ${baseMessage}` : baseMessage;
      options.onProgress?.({ attempt: attempts, max: maxRetries });
    }
  }

  return {
    kind: 'failed',
    closestRating,
    attempts,
    elapsedMs: Date.now() - startedAt,
    lastError,
  };
}
