import { describe, it, expect } from 'vitest';
import {
  generateForDifficulty,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_TIMEOUT_MS,
} from './generate-for-difficulty';
import { classicVariant } from '../variants';
import { DIFFICULTY_ORDER, type Difficulty } from './rate';
import { countSolutions } from '../solver/backtracking';

describe('generateForDifficulty — classic 9x9', () => {
  // Per-tier seeds chosen so that the generator hits the requested tier within
  // the retry budget. Seeds are deterministic via `mulberry32` inside
  // `generate`, and `generateForDifficulty` derives distinct seeds per attempt.
  const TIER_SEEDS: Record<Difficulty, number> = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
    Expert: 4,
  };

  for (const tier of DIFFICULTY_ORDER) {
    it(
      `produces a puzzle rated ${tier} for classic`,
      () => {
        const seed = TIER_SEEDS[tier];
        const result = generateForDifficulty(classicVariant, tier, {
          seed,
          maxRetries: 80,
        });

        expect(result.kind).toBe('success');
        if (result.kind !== 'success') return;

        expect(result.rating.difficulty).toBe(tier);
        expect(result.onTarget).toBe(true);

        // Basic sanity: the puzzle has a unique solution and the stored
        // solution is consistent.
        expect(countSolutions(result.puzzle, 2)).toBe(1);
        expect(result.solution.variant.id).toBe(classicVariant.id);
        expect(result.rating.clueCount).toBeGreaterThan(0);
      },
      120_000,
    );
  }
});

describe('generateForDifficulty — strict exact tier rule', () => {
  // Per requirements §6.1, generated puzzles must be accepted only when the
  // rating exactly matches the target tier — not any easier, not any harder.
  // Any returned puzzle with `kind === 'success'` must have a rating equal to
  // the requested target. When the budget is exhausted, the function returns
  // a `GenerationFailed` result instead of silently downgrading.

  it(
    'success result always rates exactly at the target tier',
    () => {
      const targets: Difficulty[] = ['Easy', 'Hard', 'Expert'];
      const seeds = [1, 7, 42, 999_999];
      for (const target of targets) {
        for (const seed of seeds) {
          const result = generateForDifficulty(classicVariant, target, {
            seed,
            maxRetries: 4,
            timeoutMs: 30_000,
          });
          if (result.kind === 'success') {
            expect(result.rating.difficulty).toBe(target);
            expect(result.onTarget).toBe(true);
          } else {
            // Failure is a structured result — verify its shape.
            expect(result.kind).toBe('failed');
            expect(result.attempts).toBeGreaterThan(0);
            expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
          }
        }
      }
    },
    120_000,
  );
});

describe('generateForDifficulty — default budget constants', () => {
  it('exposes the documented defaults (50 attempts, 60s timeout)', () => {
    expect(DEFAULT_MAX_ATTEMPTS).toBe(50);
    expect(DEFAULT_TIMEOUT_MS).toBe(60_000);
  });
});

describe('generateForDifficulty — retry attempts budget', () => {
  // Requirements §6.2: maximum of 50 attempts per call. When the attempts
  // budget is exhausted without a matching tier, the function returns a
  // structured `GenerationFailed` containing the closest rating produced,
  // the attempt count, and elapsed time.

  it(
    'returns a structured failure with closestRating and attempts when the attempts cap is hit',
    () => {
      // maxRetries=2 with a generous timeout — the failure path can only be
      // taken via the attempts budget here.
      const result = generateForDifficulty(classicVariant, 'Expert', {
        seed: 999_999,
        maxRetries: 2,
        timeoutMs: 60_000,
      });

      // Either we got lucky and matched (success), or the attempts budget
      // exhausted (failed). The attempts-budget path is what this test
      // primarily exercises; assert the shape strictly when failed.
      if (result.kind === 'failed') {
        expect(result.attempts).toBe(2);
        expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
        expect(result.elapsedMs).toBeLessThan(60_000);
        // closestRating is populated whenever at least one attempt completes
        // (which is guaranteed here because we got 2 attempts in).
        expect(result.closestRating).not.toBeNull();
        expect(result.closestRating!.difficulty).not.toBe('Expert');
        expect(DIFFICULTY_ORDER).toContain(result.closestRating!.difficulty);
        expect(result.closestRating!.clueCount).toBeGreaterThan(0);
      } else {
        // The success branch is also valid — assert the strict tier rule.
        expect(result.rating.difficulty).toBe('Expert');
      }
    },
    60_000,
  );

  it(
    'never starts more than maxRetries attempts before failing',
    () => {
      // Use a target/seed combo extremely unlikely to match in a single
      // attempt so the failure path is taken deterministically.
      const result = generateForDifficulty(classicVariant, 'Expert', {
        seed: 12_345,
        maxRetries: 1,
        timeoutMs: 60_000,
      });

      if (result.kind === 'failed') {
        // Strict bound: at most maxRetries attempts.
        expect(result.attempts).toBeLessThanOrEqual(1);
        // And at least one — the loop only exits early on the timeout, which
        // is set far above the cost of a single attempt.
        expect(result.attempts).toBeGreaterThanOrEqual(1);
      }
      // If success, the strict tier rule guarantees the match.
      else {
        expect(result.rating.difficulty).toBe('Expert');
      }
    },
    60_000,
  );
});

describe('generateForDifficulty — wall-clock timeout', () => {
  // Requirements §6.2: hard 60-second wall-clock timeout, whichever (cap or
  // timeout) hits first. Tests use a tiny `timeoutMs` so the failure path is
  // hit reliably without waiting a real minute.

  it(
    'returns a structured failure when the timeoutMs deadline is reached first',
    () => {
      // timeoutMs=0 means the deadline is past before the first attempt is
      // started — no generation is performed.
      const before = Date.now();
      const result = generateForDifficulty(classicVariant, 'Expert', {
        seed: 1,
        maxRetries: 1_000_000,
        timeoutMs: 0,
      });
      const realElapsed = Date.now() - before;

      expect(result.kind).toBe('failed');
      if (result.kind !== 'failed') return;

      expect(result.attempts).toBe(0);
      expect(result.closestRating).toBeNull();
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
      // Sanity: the function returned promptly — much less than the
      // un-throttled maxRetries would have taken.
      expect(realElapsed).toBeLessThan(5_000);
    },
    10_000,
  );

  it(
    'reports an attempts count and closestRating when the timeout fires after some work',
    () => {
      // A small but non-zero timeout. The exact number of attempts is
      // implementation- and machine-dependent, but we can assert the
      // post-conditions: kind is well-formed, elapsedMs is reasonable, and
      // attempts is bounded above by maxRetries.
      const result = generateForDifficulty(classicVariant, 'Expert', {
        seed: 7,
        maxRetries: 1_000_000,
        timeoutMs: 50,
      });

      if (result.kind === 'failed') {
        expect(result.attempts).toBeGreaterThanOrEqual(0);
        expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
        // closestRating is only set when at least one rating completed.
        if (result.attempts > 0) {
          expect(result.closestRating).not.toBeNull();
          expect(DIFFICULTY_ORDER).toContain(result.closestRating!.difficulty);
        } else {
          expect(result.closestRating).toBeNull();
        }
      } else {
        // Success is also a valid outcome (the first attempt may match).
        expect(result.rating.difficulty).toBe('Expert');
      }
    },
    10_000,
  );
});
