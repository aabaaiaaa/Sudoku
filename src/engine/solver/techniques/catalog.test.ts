import { describe, expect, it } from 'vitest';
import {
  TECHNIQUE_CATALOG,
  TECHNIQUE_ORDER,
  type TechniqueCatalogEntry,
} from './catalog';
import { techniques, type TechniqueId } from './index';
import { DIFFICULTY_ORDER } from '../../generator/rate';

describe('TECHNIQUE_CATALOG', () => {
  it('has an entry for every TechniqueId registered in techniques[]', () => {
    // The `techniques` array in index.ts is keyed identically to the
    // TECHNIQUE_TIER record in rate.ts: both list every implemented
    // technique. The catalog must cover the same set so every hint and
    // every rater outcome can resolve to a help-screen entry.
    const registeredIds: readonly TechniqueId[] = techniques.map((t) => t.id);
    for (const id of registeredIds) {
      expect(
        TECHNIQUE_CATALOG[id],
        `expected catalog entry for technique "${id}"`,
      ).toBeDefined();
    }
    expect(Object.keys(TECHNIQUE_CATALOG)).toHaveLength(registeredIds.length);
  });

  it('every catalog entry carries a fixture, displayName, tier, and description', () => {
    for (const id of Object.keys(TECHNIQUE_CATALOG) as TechniqueId[]) {
      const entry: TechniqueCatalogEntry = TECHNIQUE_CATALOG[id];
      expect(entry.displayName.length, `${id} displayName`).toBeGreaterThan(0);
      expect(entry.description.length, `${id} description`).toBeGreaterThan(0);
      expect(DIFFICULTY_ORDER).toContain(entry.tier);
      expect(entry.fixture, `${id} fixture`).toBeDefined();
      expect(entry.fixture.board.replace(/\s+/g, '').length).toBeGreaterThan(0);
    }
  });

  it('TECHNIQUE_ORDER lists every TechniqueId exactly once', () => {
    const catalogIds = new Set<TechniqueId>(
      Object.keys(TECHNIQUE_CATALOG) as TechniqueId[],
    );
    const orderSet = new Set(TECHNIQUE_ORDER);
    expect(orderSet.size).toBe(TECHNIQUE_ORDER.length);
    expect(orderSet).toEqual(catalogIds);
  });
});
