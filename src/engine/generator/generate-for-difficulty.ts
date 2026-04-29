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
 * Per-tier generation budget. Each entry pairs an attempt cap (`maxAttempts`)
 * with a wall-clock timeout (`timeoutMs`). The two were parallel `Record`
 * tables prior to iteration 7 (review §5.4); they are now consolidated so
 * the per-tier shape is impossible to skew (no chance of widening one but
 * forgetting the other).
 *
 * Values are derived from the iteration-7 corrected baseline
 * (`scripts/tier-distribution.summary.json`, committed 2026-04-29, n=50)
 * using the requirements §6 reliability formula:
 *
 *   maxAttempts = ceil(log(0.002) / log(1 − solvedRate))   // 99.8% reliability
 *   timeoutMs   = max(60_000, maxAttempts × 2000ms × 1.5)
 *
 * A floor of 50 attempts is applied when the formula N falls below 50
 * (small-sample variance protection). The `timeoutMs` rule applies to every
 * advertised tier whose attempt cap is widened above the default floor —
 * the timeout is a backstop against pathological single-attempt runtime,
 * not the primary budget (closes iteration-6 review G3).
 *
 * Driver tuples for non-default entries:
 *   Medium:    six:Medium,        solvedRate=0.02, N=308  (worst-case driver)
 *   Expert:    classic:Expert,    solvedRate=0.06, N=101
 *   Master:    classic:Master,    solvedRate=0.04, N=153
 *   Nightmare: classic:Nightmare, solvedRate=0.10, N=59
 *
 * Floor-capped entries (formula N < 50):
 *   Easy:  classic:Easy@0.96 → N=2,  hard-floored to 50
 *   Hard:  classic:Hard@0.18 → N=32, hard-floored to 50
 */
export interface TierBudget {
  maxAttempts: number;
  timeoutMs: number;
}

export const TIER_BUDGETS: Record<Difficulty, TierBudget> = {
  Easy:      { maxAttempts:  50, timeoutMs: 150_000 },
  Medium:    { maxAttempts: 308, timeoutMs: 924_000 },
  Hard:      { maxAttempts:  50, timeoutMs: 150_000 },
  Expert:    { maxAttempts: 101, timeoutMs: 303_000 },
  Master:    { maxAttempts: 153, timeoutMs: 459_000 },
  Nightmare: { maxAttempts:  59, timeoutMs: 177_000 },
};

/**
 * Returns the default attempts budget for the given target tier from
 * {@link TIER_BUDGETS}. Callers can still override via `options.maxRetries`.
 * Retained as a thin wrapper over the consolidated table for the existing
 * public surface.
 */
export function defaultMaxAttemptsForTier(difficulty: Difficulty): number {
  return TIER_BUDGETS[difficulty]?.maxAttempts ?? 50;
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
   * Defaults to `TIER_BUDGETS[difficulty].maxAttempts`, falling back to 50
   * for tiers without an entry. Whichever of `maxRetries` or `timeoutMs`
   * is reached first ends generation in failure.
   */
  maxRetries?: number;
  /**
   * Hard wall-clock timeout in milliseconds. Defaults to
   * `TIER_BUDGETS[difficulty].timeoutMs`, falling back to 60 000 for tiers
   * without an entry. Once the elapsed time meets or exceeds this value,
   * no further attempts are started and the function returns a structured
   * failure.
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
    options.maxRetries ?? TIER_BUDGETS[difficulty]?.maxAttempts ?? 50,
  );
  const timeoutMs = Math.max(
    0,
    options.timeoutMs ?? TIER_BUDGETS[difficulty]?.timeoutMs ?? 60_000,
  );
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
