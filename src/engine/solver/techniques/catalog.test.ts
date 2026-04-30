import { describe, expect, it } from 'vitest';
import {
  TECHNIQUE_CATALOG,
  TECHNIQUE_ORDER,
  type TechniqueCatalogEntry,
} from './catalog';
import { GLOSSARY } from './glossary';
import { techniques, type TechniqueId } from './index';
import { DIFFICULTY_ORDER } from '../../generator/rate';
import { createEmptyBoard, createGivenCell } from '../../types';
import { classicVariant, miniVariant, sixVariant } from '../../variants';
import type { Board, Cell, Digit, Variant } from '../../types';

function variantFor(name: 'classic' | 'six' | 'mini'): Variant {
  if (name === 'classic') return classicVariant;
  if (name === 'six') return sixVariant;
  return miniVariant;
}

function placedCell(value: Digit): Cell {
  return { value, notes: new Set<Digit>(), given: false };
}

/**
 * Parse a fixture board string. '1'-'9' are givens; '.' or '0' are empty;
 * lowercase 'a'-'i' encode placed (non-given) values 1-9 (used by fixtures
 * such as Avoidable Rectangle whose pattern hinges on the given/placed
 * distinction). Whitespace is ignored.
 */
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
    if (ch >= '1' && ch <= '9') {
      const d = Number.parseInt(ch, 10);
      if (d < 1 || d > variant.size) {
        throw new Error(`Bad given '${ch}' at index ${i}`);
      }
      board.cells[r][c] = createGivenCell(d as Digit);
      continue;
    }
    if (ch >= 'a' && ch <= 'i') {
      const d = ch.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
      if (d < 1 || d > variant.size) {
        throw new Error(`Bad placement '${ch}' at index ${i}`);
      }
      board.cells[r][c] = placedCell(d as Digit);
      continue;
    }
    throw new Error(`Bad cell '${ch}' at index ${i}`);
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

  it('every glossaryTerms entry is a valid GlossaryTermId', () => {
    const validIds = new Set(Object.keys(GLOSSARY));
    for (const [id, entry] of Object.entries(TECHNIQUE_CATALOG) as Array<[TechniqueId, TechniqueCatalogEntry]>) {
      if (!entry.glossaryTerms) continue;
      for (const term of entry.glossaryTerms) {
        expect(
          validIds.has(term),
          `${id} glossaryTerms includes unknown term "${term}"`,
        ).toBe(true);
      }
    }
  });

  it('every fixture roles array is non-empty', () => {
    for (const [id, entry] of Object.entries(TECHNIQUE_CATALOG) as Array<[TechniqueId, TechniqueCatalogEntry]>) {
      expect(
        entry.fixture.roles.length,
        `${id} fixture.roles must be non-empty`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('fixture round-trip', () => {
  // Each catalog fixture is hand-authored to demonstrate exactly one
  // technique. The fixtures are mid-game one-step demonstrations rather
  // than fully-solvable puzzles, so they cannot round-trip through `rate()`
  // to a tier label (the cascade has no way to "finish" a partial puzzle).
  // The drift signal we can guard cheaply is: the technique's own finder
  // still produces a non-null result on its fixture board. Per-finder unit
  // tests verify shape-of-deduction; this catalog-level check verifies the
  // catalog's id → finder mapping never silently breaks (e.g. a fixture
  // edit that destroys the demonstrated pattern would be caught here).
  const cases = (Object.entries(TECHNIQUE_CATALOG) as Array<
    [TechniqueId, TechniqueCatalogEntry]
  >).map(([id, entry]) => ({ id, entry }));

  const finderById = new Map(techniques.map((t) => [t.id, t.find]));

  it.each(cases)("$id fixture demonstrates its catalog technique", ({ id, entry }) => {
    const board = parseBoardString(entry.fixture.variant, entry.fixture.board);
    const finder = finderById.get(id);
    expect(finder, `expected a registered finder for "${id}"`).toBeDefined();
    const result = finder!(board);
    expect(
      result,
      `expected ${id} fixture to demonstrate technique "${id}" via its finder`,
    ).not.toBeNull();
  });

  it('every catalog tier appears in DIFFICULTY_ORDER', () => {
    for (const [id, entry] of Object.entries(TECHNIQUE_CATALOG) as Array<
      [TechniqueId, TechniqueCatalogEntry]
    >) {
      expect(
        DIFFICULTY_ORDER,
        `catalog tier ${entry.tier} for ${id} must be a known difficulty`,
      ).toContain(entry.tier);
    }
  });
});
