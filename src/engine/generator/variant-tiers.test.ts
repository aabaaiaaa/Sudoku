import { describe, it, expect } from 'vitest';
import { availableTiers } from './variant-tiers';
import { classicVariant, miniVariant, sixVariant } from '../variants';

describe('availableTiers', () => {
  it('returns all eight tiers for Classic', () => {
    expect(availableTiers(classicVariant)).toEqual([
      'Easy',
      'Medium',
      'Hard',
      'Expert',
      'Master',
      'Diabolical',
      'Demonic',
      'Nightmare',
    ]);
  });

  it('caps Six at Diabolical (six tiers)', () => {
    expect(availableTiers(sixVariant)).toEqual([
      'Easy',
      'Medium',
      'Hard',
      'Expert',
      'Master',
      'Diabolical',
    ]);
  });

  it('caps Mini at Hard (three tiers)', () => {
    expect(availableTiers(miniVariant)).toEqual(['Easy', 'Medium', 'Hard']);
  });

  it('returns tiers in ascending difficulty order', () => {
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
