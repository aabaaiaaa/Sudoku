import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from './generate-for-difficulty';
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

describe('generateForDifficulty — fallback when target not hit', () => {
  it('returns onTarget: false with a valid rating when retries are exhausted', () => {
    // A single attempt with this seed is very unlikely to land exactly on
    // Expert — but whatever tier it lands on, the fallback should still return
    // a well-formed result.
    const result = generateForDifficulty(classicVariant, 'Expert', {
      seed: 999_999,
      maxRetries: 1,
    });

    expect(DIFFICULTY_ORDER).toContain(result.rating.difficulty);
    // With only a single attempt, we either hit Expert (onTarget: true) or
    // fall back (onTarget: false). Assert consistency: onTarget iff the
    // rating matches the target.
    expect(result.onTarget).toBe(result.rating.difficulty === 'Expert');
    expect(result.rating.clueCount).toBeGreaterThan(0);
    expect(countSolutions(result.puzzle, 2)).toBe(1);
  });
});

describe('generateForDifficulty — strict exact tier rule', () => {
  // Per requirements §6.1, generated puzzles must be accepted only when the
  // rating exactly matches the target tier — not any easier, not any harder.
  // The invariant: `onTarget` is true if and only if
  // `rating.difficulty === target`. Any returned puzzle with `onTarget=true`
  // must have a rating equal to the requested target; any returned puzzle
  // with `onTarget=false` is a fallback and must have a non-target rating.

  it(
    'enforces exact tier match: onTarget iff rating.difficulty === target',
    () => {
      // Sweep a few seeds and a few targets so the test exercises both the
      // accept path (rating matches) and the reject-then-fallback path
      // (rating does not match within maxRetries).
      const targets: Difficulty[] = ['Easy', 'Hard', 'Expert'];
      const seeds = [1, 7, 42, 999_999];
      for (const target of targets) {
        for (const seed of seeds) {
          const result = generateForDifficulty(classicVariant, target, {
            seed,
            maxRetries: 4,
          });
          expect(result.onTarget).toBe(result.rating.difficulty === target);
          if (result.onTarget) {
            expect(result.rating.difficulty).toBe(target);
          } else {
            expect(result.rating.difficulty).not.toBe(target);
          }
        }
      }
    },
    120_000,
  );

  it(
    'never silently promotes a near-miss: a single attempt that lands off-target returns onTarget=false',
    () => {
      // With maxRetries=1 there is exactly one generated puzzle; the strict
      // rule means the result is onTarget only if that puzzle rates exactly
      // at the target. Run a handful of seeds and assert the invariant for
      // each — no silent promotion of a different tier to onTarget=true.
      for (const seed of [11, 22, 33, 44, 55]) {
        const result = generateForDifficulty(classicVariant, 'Expert', {
          seed,
          maxRetries: 1,
        });
        if (result.rating.difficulty !== 'Expert') {
          expect(result.onTarget).toBe(false);
        } else {
          expect(result.onTarget).toBe(true);
        }
      }
    },
    60_000,
  );
});
