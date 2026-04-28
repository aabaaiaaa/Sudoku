import { describe, it, expect, vi } from 'vitest';
import {
  generateForDifficulty,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_TIMEOUT_MS,
  type GenerationProgress,
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
    Master: 5,
    Diabolical: 6,
    Demonic: 7,
    Nightmare: 8,
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

describe('generateForDifficulty — onProgress callback', () => {
  // Requirements §6.3: the worker wrapper posts a `progress` message after
  // each rejected attempt. `generateForDifficulty` exposes that hook via an
  // optional `onProgress({ attempt, max })` callback fired only on rejection
  // — never on the accepted attempt that yields a success result.

  it(
    'fires onProgress once per rejected attempt with monotonically increasing attempt counts',
    () => {
      // Force the failure path so every attempt is rejected: timeoutMs is
      // generous, but maxRetries=3 with a target/seed that is unlikely to hit
      // Expert in three tries makes rejection effectively guaranteed.
      const calls: GenerationProgress[] = [];
      const result = generateForDifficulty(classicVariant, 'Expert', {
        seed: 999_999,
        maxRetries: 3,
        timeoutMs: 60_000,
        onProgress: (p) => calls.push(p),
      });

      if (result.kind === 'failed') {
        // One progress event per rejected attempt — equal to result.attempts.
        expect(calls.length).toBe(result.attempts);
        // attempt is 1-based and strictly increasing.
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]!.attempt).toBe(i + 1);
          expect(calls[i]!.max).toBe(3);
        }
      } else {
        // If we got lucky and matched, onProgress fires only for the rejected
        // attempts that came before the accepted one — i.e. one fewer than
        // the total number of attempts the loop ran. Asserting that the
        // accepted attempt did not emit progress is the key invariant.
        expect(calls.length).toBeLessThan(3);
        for (let i = 0; i < calls.length; i++) {
          expect(calls[i]!.attempt).toBe(i + 1);
          expect(calls[i]!.max).toBe(3);
        }
      }
    },
    60_000,
  );

  it(
    'does not call onProgress when the timeout fires before any attempt completes',
    () => {
      // timeoutMs=0 short-circuits the loop before any work happens, so no
      // rejected attempts exist and onProgress must never be called.
      const onProgress = vi.fn();
      const result = generateForDifficulty(classicVariant, 'Expert', {
        seed: 1,
        maxRetries: 100,
        timeoutMs: 0,
        onProgress,
      });

      expect(result.kind).toBe('failed');
      if (result.kind === 'failed') {
        expect(result.attempts).toBe(0);
      }
      expect(onProgress).not.toHaveBeenCalled();
    },
    10_000,
  );

  it(
    'is optional — generation works the same when onProgress is omitted',
    () => {
      const result = generateForDifficulty(classicVariant, 'Easy', {
        seed: 1,
        maxRetries: 80,
      });
      expect(result.kind).toBe('success');
    },
    120_000,
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
