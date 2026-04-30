import { describe, it, expect } from 'vitest';
import { availableTiers } from './variant-tiers';
import { classicVariant, miniVariant, sixVariant } from '../variants';

describe('availableTiers', () => {
  it('returns five-tier classic list after iteration-7 final-snapshot contingency', () => {
    // Iteration-7 final snapshot (n=50) showed classic:Master solvedRate=0.04
    // (below the ≥0.05 threshold), triggering the §11 contingency. Master is
    // descoped; classic ships Easy / Medium / Hard / Expert / Nightmare.
    expect(availableTiers(classicVariant)).toEqual([
      'Easy',
      'Medium',
      'Hard',
      'Expert',
      'Nightmare',
    ]);
  });

  it('reduces Six to Easy only after iteration-7 final-snapshot contingency', () => {
    // Iteration-7 final snapshot (n=50) showed six:Medium solvedRate=0.02
    // (below the ≥0.05 threshold), triggering the §11 contingency. Medium is
    // descoped; Six ships Easy only.
    expect(availableTiers(sixVariant)).toEqual(['Easy']);
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
