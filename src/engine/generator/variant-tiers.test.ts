import { describe, it, expect } from 'vitest';
import { availableTiers } from './variant-tiers';
import { classicVariant, miniVariant, sixVariant } from '../variants';

describe('availableTiers', () => {
  it('returns the post-tuning classic tier list (Hard and Master descoped)', () => {
    // Iteration 4 §6 third lever: classic:Hard and classic:Master had rate=0
    // in the baseline summary and could not be rescued by levers 1 or 2.
    expect(availableTiers(classicVariant)).toEqual([
      'Easy',
      'Medium',
      'Expert',
      'Diabolical',
      'Demonic',
      'Nightmare',
    ]);
  });

  it('reduces Six to Easy only after iteration 4 tuning', () => {
    // Baseline summary showed Medium/Hard/Expert/Master/Diabolical all at
    // rate=0 on the 6x6 grid; only Easy reaches usable rate.
    expect(availableTiers(sixVariant)).toEqual(['Easy']);
  });

  it('reduces Mini to Easy only after iteration 4 tuning', () => {
    // Baseline summary showed Medium/Hard at rate=0 on the 4x4 grid; only
    // Easy reaches usable rate.
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
    expect(availableTiers(unknown)).toHaveLength(8);
  });
});
