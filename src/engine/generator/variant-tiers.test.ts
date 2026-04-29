import { describe, it, expect } from 'vitest';
import { availableTiers } from './variant-tiers';
import { classicVariant, miniVariant, sixVariant } from '../variants';

describe('availableTiers', () => {
  it('returns the full six-tier classic list (iteration-7 collapse)', () => {
    // Iteration 7 collapsed the ladder to six tiers. Every tier in the new
    // ladder is reachable on classic per the iteration-7 corrected baseline.
    expect(availableTiers(classicVariant)).toEqual([
      'Easy',
      'Medium',
      'Hard',
      'Expert',
      'Master',
      'Nightmare',
    ]);
  });

  it('exposes Easy and Medium for Six after iteration-6 lever-2 rescue', () => {
    // Iteration-6 lever-2 sweep rescued Six:Medium at clueFloor=14
    // (solvedRate=0.05); harder tiers remain unreachable on the 6x6 grid.
    expect(availableTiers(sixVariant)).toEqual(['Easy', 'Medium']);
  });

  it('reduces Mini to Easy only', () => {
    // Iteration-6 corrected baseline + lever-2 sweep both showed
    // solvedRate=0 for Medium/Hard at every tested clueFloor on the 4x4
    // grid; only Easy reaches usable rate.
    expect(availableTiers(miniVariant)).toEqual(['Easy']);
  });

  it('returns tiers starting at Easy', () => {
    for (const variant of [classicVariant, miniVariant, sixVariant]) {
      const tiers = availableTiers(variant);
      expect(tiers[0]).toBe('Easy');
      expect(tiers.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the full tier list for unknown variants', () => {
    const unknown = { ...classicVariant, id: 'unknown-variant' };
    expect(availableTiers(unknown)).toHaveLength(6);
  });
});
