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
