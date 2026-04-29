import { describe, expect, it } from 'vitest';
import {
  TECHNIQUE_CATALOG,
  TECHNIQUE_ORDER,
  type TechniqueCatalogEntry,
} from './catalog';
import { techniques, type TechniqueId } from './index';
import { DIFFICULTY_ORDER, rate } from '../../generator/rate';
import { createEmptyBoard, createGivenCell } from '../../types';
import { classicVariant, miniVariant, sixVariant } from '../../variants';
import type { Board, Digit, Variant } from '../../types';

function variantFor(name: 'classic' | 'six' | 'mini'): Variant {
  if (name === 'classic') return classicVariant;
  if (name === 'six') return sixVariant;
  return miniVariant;
}

function parseBoardString(name: 'classic' | 'six' | 'mini', s: string): Board {
  const variant = variantFor(name);
  const cleaned = s.replace(/\s+/g, '');
  const expected = variant.size * variant.size;
  if (cleaned.length !== expected) {
    throw new Error(`Expected ${expected} cells, got ${cleaned.length}`);
  }
  const board = createEmptyBoard(variant);
  for (let i = 0; i < expected; i++) {
    const ch = cleaned[i];
    const r = Math.floor(i / variant.size);
    const c = i % variant.size;
    if (ch === '.' || ch === '0') continue;
    const d = Number.parseInt(ch, 10);
    if (!Number.isInteger(d) || d < 1 || d > variant.size) {
      throw new Error(`Bad cell '${ch}' at index ${i}`);
    }
    board.cells[r][c] = createGivenCell(d as Digit);
  }
  return board;
}

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

describe('fixture round-trip', () => {
  // Each catalog fixture is hand-authored to demonstrate exactly one
  // technique. Passing the fixture's board through the rater must yield the
  // tier the catalog claims for that technique — otherwise the help-screen
  // demo would mislead the player about how hard the puzzle truly is. This
  // guards against silent drift in either direction (a fixture that becomes
  // solvable by easier techniques after a solver tweak, or a tier remapping
  // that leaves stale fixture entries behind).
  const cases = (Object.entries(TECHNIQUE_CATALOG) as Array<
    [TechniqueId, TechniqueCatalogEntry]
  >).map(([id, entry]) => ({ id, entry }));

  it.each(cases)('$id fixture rates as its catalog tier', ({ id, entry }) => {
    const board = parseBoardString(entry.fixture.variant, entry.fixture.board);
    const result = rate(board);
    expect(
      result.difficulty,
      `expected ${id} fixture to rate as ${entry.tier}, got ${result.difficulty}`,
    ).toBe(entry.tier);
  });
});
