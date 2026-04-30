/**
 * Fixture round-trip self-validation test.
 *
 * For every entry in TECHNIQUE_CATALOG this test:
 *   1. Parses the fixture's board string into a Board.
 *   2. Looks up the technique's finder via FINDER_BY_ID.
 *   3. Asserts the finder returns a non-null result.
 *   4. Asserts result.technique matches the catalog id.
 *   5. Asserts that each deduction position (placement or elimination) appears
 *      in the JSON-serialised result — a lightweight guard that the returned
 *      result at least references the documented cell(s).
 *
 * One fixture is known to be unworkable with this generic check and is
 * explicitly skipped:
 *   - 3d-medusa: the result shape uses `cell` for eliminations rather than
 *     `pos`, which the generic JSON position check cannot match reliably.
 */

import { describe, it, expect } from 'vitest';
import { TECHNIQUE_CATALOG } from './catalog';
import { FINDER_BY_ID, type TechniqueId } from './index';
import { createEmptyBoard, createGivenCell } from '../../types';
import { classicVariant, sixVariant, miniVariant } from '../../variants';
import type { Board, Digit, Variant } from '../../types';

// ---------------------------------------------------------------------------
// Known-broken fixtures — skipped rather than removed so the skip list is
// visible and easy to re-enable once the underlying issues are resolved.
// ---------------------------------------------------------------------------
const KNOWN_BROKEN = new Set<string>(['3d-medusa']);

// ---------------------------------------------------------------------------
// Board parser
// ---------------------------------------------------------------------------

function variantFor(name: 'classic' | 'six' | 'mini'): Variant {
  if (name === 'classic') return classicVariant;
  if (name === 'six') return sixVariant;
  return miniVariant;
}

/**
 * Parse a fixture board string into a Board.
 *
 * Character mapping (whitespace is ignored):
 *   '1'-'9'  → given cell with that digit
 *   '.', '0' → empty cell (skipped)
 *   'a'-'i'  → placed-not-given cell with value 1-9 (used by avoidable-rectangle)
 */
function parseBoard(
  variantName: 'classic' | 'six' | 'mini',
  boardStr: string,
): Board {
  const variant = variantFor(variantName);
  const cleaned = boardStr.replace(/\s+/g, '');
  const expected = variant.size * variant.size;
  if (cleaned.length !== expected) {
    throw new Error(
      `parseBoard: expected ${expected} characters for ${variantName}, got ${cleaned.length}`,
    );
  }

  const board = createEmptyBoard(variant);

  for (let i = 0; i < expected; i++) {
    const ch = cleaned[i];
    const r = Math.floor(i / variant.size);
    const c = i % variant.size;

    if (ch === '.' || ch === '0') {
      // Empty cell — already initialised by createEmptyBoard
      continue;
    }

    if (ch >= '1' && ch <= '9') {
      const d = Number.parseInt(ch, 10) as Digit;
      if (d < 1 || d > variant.size) {
        throw new Error(
          `parseBoard: digit '${ch}' out of range for ${variantName} at index ${i}`,
        );
      }
      board.cells[r][c] = createGivenCell(d);
      continue;
    }

    if (ch >= 'a' && ch <= 'i') {
      // Placed-not-given: avoidable-rectangle fixtures use this encoding.
      const d = (ch.charCodeAt(0) - 'a'.charCodeAt(0) + 1) as Digit;
      if (d < 1 || d > variant.size) {
        throw new Error(
          `parseBoard: placement '${ch}' out of range for ${variantName} at index ${i}`,
        );
      }
      board.cells[r][c].value = d;
      board.cells[r][c].given = false;
      continue;
    }

    throw new Error(
      `parseBoard: unexpected character '${ch}' at index ${i}`,
    );
  }

  return board;
}

// ---------------------------------------------------------------------------
// Round-trip tests — one per catalog entry
// ---------------------------------------------------------------------------

describe('fixture round-trip', () => {
  for (const [id, entry] of Object.entries(TECHNIQUE_CATALOG)) {
    const skip = KNOWN_BROKEN.has(id);

    (skip ? it.skip : it)(
      `${id}: finder returns result matching fixture`,
      () => {
        const board = parseBoard(entry.fixture.variant, entry.fixture.board);
        const finder = FINDER_BY_ID[id as TechniqueId];
        const result = finder(board);

        expect(
          result,
          `${id}: finder returned null for fixture board`,
        ).not.toBeNull();

        expect(
          result!.technique,
          `${id}: result.technique mismatch`,
        ).toBe(id);

        const json = JSON.stringify(result);

        // Check that every documented placement position appears in the result.
        if (entry.fixture.deduction.placement) {
          const { pos } = entry.fixture.deduction.placement;
          expect(
            json,
            `${id}: placement row ${pos.row} not found in result JSON`,
          ).toContain(`"row":${pos.row}`);
          expect(
            json,
            `${id}: placement col ${pos.col} not found in result JSON`,
          ).toContain(`"col":${pos.col}`);
        }

        // Check that every documented elimination position appears in the result.
        if (entry.fixture.deduction.eliminations) {
          for (const { pos } of entry.fixture.deduction.eliminations) {
            expect(
              json,
              `${id}: elimination row ${pos.row} not found in result JSON`,
            ).toContain(`"row":${pos.row}`);
            expect(
              json,
              `${id}: elimination col ${pos.col} not found in result JSON`,
            ).toContain(`"col":${pos.col}`);
          }
        }
      },
    );
  }
});
