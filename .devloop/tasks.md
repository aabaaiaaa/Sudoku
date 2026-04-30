# Iteration 8 — Tasks

Reference: `.devloop/requirements.md`. Each task's verification
runs only the targeted tests for that task; the full unit / type-
check / build / E2E sweeps are the closing tasks.

---

### TASK-001: Create role taxonomy module
- **Status**: done
- **Type**: feat
- **Dependencies**: none
- **Description**: Create `src/engine/solver/techniques/roles.ts` exporting the `CellRole` enum, the `roleLabels: Record<CellRole, string>` table, and the `mergeCellRoles(roles: CellRole[]): CellRole` helper with the precedence chain from requirements §4. Reading-level for `roleLabels`: same target as descriptions (`pattern-primary` → "Pattern", `pattern-secondary` → "Supporting cells", `pivot` → "Centre cell", `pincer` → "Side cell", `cluster-a` → "Group A", `cluster-b` → "Group B", `chain-link` → "Chain step", `corner` → "Rectangle corner", `elimination` → "Cells affected", `placement` → "Place number here").
- **Verification**: `npx tsc --noEmit src/engine/solver/techniques/roles.ts` and `npm test -- src/engine/solver/techniques/roles` (a small unit test of `mergeCellRoles` precedence is added in this task).

### TASK-002: Add `--role-*` CSS tokens to all four themes
- **Status**: done
- **Type**: feat
- **Dependencies**: TASK-001
- **Description**: Add a `--role-pattern-primary`, `--role-pattern-secondary`, `--role-pivot`, `--role-pincer`, `--role-cluster-a`, `--role-cluster-b`, `--role-chain-link`, `--role-corner`, `--role-elimination`, `--role-placement` block to each of `src/themes/light.css`, `dark.css`, `notepad.css`, `space.css`. Tune per-theme so each role is visually distinguishable from the existing `--cell-*` tokens and from the other roles within the same theme. Use the requirements §4.1 light-theme palette as a starting point.
- **Verification**: `npx tsc --noEmit` (catches any TS that references the new vars) and visual smoke check by booting the dev server and toggling each theme on a Settings page screenshot. No automated test changes.

### TASK-003: Extend `TechniqueFixture` interface with `roles`
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: In `src/engine/solver/techniques/catalog.ts`, replace the `patternCells: Position[]` field on `TechniqueFixture` with `roles: FixtureCellRole[]` (where `FixtureCellRole = { pos: Position; role: CellRole }`). Existing fixture files temporarily still expose `patternCells`; this task narrows the type but does not yet rewrite fixtures. Add a deprecation TODO comment at the top of the interface noting that `patternCells` is removed. Provide a one-shot mechanical migration on every fixture file: `roles: patternCells.map(p => ({ pos: p, role: 'pattern-primary' as const }))`. Per-fixture authoring of correct roles happens in later tasks.
- **Breaking**: `TechniqueFixture.patternCells` is removed; `TechniqueFixture.roles` is required.
- **Verification**: `npx tsc --noEmit` passes (every fixture compiles after the mechanical migration); `npm test -- catalog` still passes.

### TASK-004: Create glossary module with term entries
- **Status**: done
- **Type**: feat
- **Dependencies**: none
- **Description**: Create `src/engine/solver/techniques/glossary.ts` with `GlossaryTermId` union, `GlossaryEntry` interface, and `GLOSSARY: Record<GlossaryTermId, GlossaryEntry>` populated with the 8 entries from requirements §6 (terms + plain-English definitions). Each entry's `diagram` field is initially a placeholder `() => null`; per-term SVG diagrams are authored in TASK-052.
- **Verification**: `npx tsc --noEmit src/engine/solver/techniques/glossary.ts` and `npm test -- glossary` (small unit test that every `GlossaryTermId` has a matching `GLOSSARY` entry).

### TASK-005: Extend `TechniqueCatalogEntry` with `glossaryTerms`
- **Status**: done
- **Type**: feat
- **Dependencies**: TASK-004
- **Description**: Add optional `glossaryTerms?: GlossaryTermId[]` to `TechniqueCatalogEntry` in `catalog.ts`. Leave every existing entry without the field for now — per-technique population happens in the per-fixture rewrite tasks.
- **Verification**: `npx tsc --noEmit src/engine/solver/techniques/catalog.ts`.

### TASK-006: Create `FINDER_BY_ID` lookup table
- **Status**: done
- **Type**: feat
- **Dependencies**: none
- **Description**: In `src/engine/solver/techniques/index.ts` (or a new colocated file `finders.ts` if the index is overcrowded), export `FINDER_BY_ID: Record<TechniqueId, (board: Board) => TechniqueResult | null>`. Each entry references the existing finder function for that technique. The exhaustive switch in `nextStep` may be refactored to consult this table; otherwise leave `nextStep` unchanged.
- **Verification**: `npx tsc --noEmit src/engine/solver/techniques/index.ts`; `npm test -- src/engine/solver/techniques/index.test.ts`.

### TASK-007: Add `cellHighlights` prop to Board with role precedence
- **Status**: pending
- **Type**: feat
- **Dependencies**: TASK-001, TASK-002
- **Description**: In `src/components/Board.tsx`, add the optional `cellHighlights?: ReadonlyArray<{ pos: Position; role: CellRole }>` prop. Convert it to a `Map<positionKey, CellRole>` once at render top, pass `roleHighlight` into `CellView`, and extend the `bg` decision tree with the `conflict → selected → role highlight → completed → given → default` precedence from requirements §10. Add a `data-role={roleHighlight}` attribute to each cell button when set. Update `src/components/Board.test.tsx` with cases asserting:
  1. role highlight wins over `completed` and `given`;
  2. role highlight loses to `selected` and `conflict`;
  3. omitting `cellHighlights` keeps existing rendering byte-for-byte.
- **Verification**: `npx vitest run src/components/Board.test.tsx`.

### TASK-008: Add `HintHighlight` type and `cellsAndRolesFromResult`
- **Status**: done
- **Type**: feat
- **Dependencies**: TASK-001
- **Description**: In `src/components/Hint.tsx`, add `export interface HintHighlight { pos: Position; role: CellRole }` and rename `cellsFromResult(result): Position[]` to `cellsAndRolesFromResult(result): HintHighlight[]`. Each branch of the exhaustive `result.technique` switch maps the result's semantic fields to roles per requirements §9 (e.g. `xy-wing → [{pos: result.pivot, role: 'pivot'}, ...result.pincers.map(p => ({pos: p, role: 'pincer'}))]` plus elimination cells with role `'elimination'`). The `onHighlight` prop signature changes from `(cells: Position[]) => void` to `(highlights: HintHighlight[]) => void`. Update `src/components/Hint.test.tsx`'s `Position[][]` type alias to `HintHighlight[][]` and update the `expect(highlighted).toEqual(...)` shape assertions to the new `{pos, role}` shape. (Plain-English copy assertions are left for TASK-071.)
- **Verification**: `npx vitest run src/components/Hint.test.tsx`.

### TASK-009: Create round-trip self-validation test infrastructure
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-003, TASK-006
- **Description**: Create `src/engine/solver/techniques/fixtures-round-trip.test.ts` that uses `it.each(Object.entries(TECHNIQUE_CATALOG))` to iterate fixtures and, for each technique:
  1. Parses the fixture board (with `a-i` placed-not-given handling for avoidable-rectangle).
  2. Looks up the finder via `FINDER_BY_ID`.
  3. Runs the finder.
  4. Asserts the result is non-null.
  5. Asserts the documented `placement` and `eliminations` are present in the finder's output (subset, not equality).
  6. Asserts every fixture `roles` cell appears in the finder's identified cells via `cellsAndRolesFromResult`.
  Failure messages name the fixture file. To keep this task's verification green, the two known-bad fixtures (`hidden-single` and `medusa-3d`) are placed in a `KNOWN_BAD_FIXTURES: Set<TechniqueId>` constant in this test file and routed through `it.skip` instead of `it`. TASK-015 and TASK-016 each remove their fixture from the set as part of the bug fix.
- **Verification**: `npx vitest run src/engine/solver/techniques/fixtures-round-trip.test.ts` exits 0 (35 fixtures pass, 2 skipped).

### TASK-010: Fix missing fixture import in `hidden-single.test.ts`
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-009, TASK-015
- **Description**: Add `import { fixture } from './hidden-single.fixture';` to `src/engine/solver/techniques/hidden-single.test.ts`. Add at least one new `it('round-trips its fixture')` case that runs the fixture through `findHiddenSingle` and asserts the deduction. TASK-015 having landed first means the fixture board is valid, so the round-trip case passes when this task lands.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-single.test.ts` — the new case passes.

### TASK-011: Fix missing fixture import in `naked-single.test.ts`
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-009
- **Description**: Add fixture import and round-trip case to `naked-single.test.ts` mirroring TASK-010.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-single.test.ts`.

### TASK-012: Fix missing fixture import in `x-wing.test.ts`
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-009
- **Description**: Add fixture import and round-trip case to `x-wing.test.ts` mirroring TASK-010.
- **Verification**: `npx vitest run src/engine/solver/techniques/x-wing.test.ts`.

### TASK-013: Fix missing fixture imports in `intersection.test.ts`
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-009
- **Description**: Add `import { fixture as pointingFixture } from './pointing.fixture';` and `import { fixture as boxLineReductionFixture } from './box-line-reduction.fixture';` plus round-trip cases for both techniques in `src/engine/solver/techniques/intersection.test.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/intersection.test.ts`.

### TASK-014: Fix missing fixture imports in `naked-subset.test.ts`
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-009
- **Description**: Add fixture imports for `naked-pair`, `naked-triple`, and `naked-quad` in `src/engine/solver/techniques/naked-subset.test.ts` plus a round-trip case per technique.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-subset.test.ts`.

### TASK-015: Replace hidden-single fixture with a valid construction
- **Status**: pending
- **Type**: fix
- **Dependencies**: TASK-009
- **Description**: Rewrite the board in `src/engine/solver/techniques/hidden-single.fixture.ts` so digit 9 occupies positions that block each row and column entering box 0 (top-left 3×3) without duplicating digit 9 in any row, column, or box. One valid layout: 9 at (1,4) blocking row 1 from box 0; 9 at (2,7) blocking row 2; 9 at (3,1) blocking column 1; 9 at (4,2) blocking column 2 — verify each pair sits in distinct rows, columns, and boxes from the others before committing. Update the fixture's docblock to match. Remove `'hidden-single'` from `KNOWN_BAD_FIXTURES` in `fixtures-round-trip.test.ts`. Description rewrite happens in TASK-018.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-single.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts` — the hidden-single round-trip case now runs (no longer skipped) and passes.

### TASK-016: Replace medusa-3d fixture with a valid construction
- **Status**: pending
- **Type**: fix
- **Dependencies**: TASK-009
- **Description**: Replace the board in `src/engine/solver/techniques/medusa-3d.fixture.ts` so the cluster cells span at least two boxes. A 2-row × 2-column corner cluster spanning a vertical box boundary (e.g. cells in box 1 and box 2, rows 1–2, columns 3 and 4) is a typical construction; alternatively, run the project's generator at Master tier and capture the first hit that produces a 3D Medusa puzzle, then commit the resulting seed and board as the new fixture (per requirements §17 fallback). Whichever construction is chosen, one bipartite colouring of the fixture's strong-link graph must hit a contradiction (digit twice in a row/column/box, or two digits in one cell) and the other colouring must be valid. Update the fixture's docblock with the new colouring analysis. Remove `'3d-medusa'` from `KNOWN_BAD_FIXTURES` in `fixtures-round-trip.test.ts`. Description rewrite happens in TASK-050.
- **Verification**: `npx vitest run src/engine/solver/techniques/medusa-3d.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts` — the medusa-3d round-trip case now passes.

### TASK-017: Rewrite naked-single fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-009
- **Description**: In `src/engine/solver/techniques/naked-single.fixture.ts`, rewrite the `description` string in plain English at the §5 reading level, replace the placeholder `pattern-primary` roles (from TASK-003's mechanical migration) with hand-authored roles — at minimum, the placement target gets `placement`, the constraining row/col/box cells get `pattern-primary`. In `catalog.ts`, set `glossaryTerms: ['placement']` on the naked-single entry.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-single.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-018: Rewrite hidden-single fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-015
- **Description**: After TASK-015 fixes the board, rewrite the description in plain English (target wording in requirements §5.3); replace placeholder roles with hand-authored ones — placement target gets `placement`, the four constraining 9s on row/col blocks get `pattern-primary`. Catalog `glossaryTerms: ['placement']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-single.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-019: Rewrite pointing fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-013
- **Description**: Rewrite description in plain English; intersection cells (the candidate cells in the box that all share one line) → `pattern-primary`; cells where the digit gets removed from the line → `elimination`. Catalog `glossaryTerms: ['box', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/intersection.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-020: Rewrite box-line-reduction fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-013
- **Description**: Rewrite description; intersection cells → `pattern-primary`; box-internal eliminations → `elimination`. Catalog `glossaryTerms: ['box', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/intersection.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-021: Rewrite naked-pair fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-014
- **Description**: Rewrite description per §5.3 example; subset cells → `pattern-primary`; eliminations → `elimination`. Catalog `glossaryTerms: ['pair', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-subset.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-022: Rewrite naked-triple fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-014
- **Description**: Rewrite as TASK-021. `glossaryTerms: ['pair', 'elimination']` (the pair entry covers triples/quads).
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-subset.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-023: Rewrite naked-quad fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-014
- **Description**: Rewrite as TASK-021. `glossaryTerms: ['pair', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-subset.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-024: Rewrite hidden-pair fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; subset cells → `pattern-primary`; eliminations (the *other* candidates inside the subset cells) → `elimination`. Catalog `glossaryTerms: ['pair', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-pair.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-025: Rewrite hidden-triple fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite as TASK-024. `glossaryTerms: ['pair', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-triple.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-026: Rewrite hidden-quad fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite as TASK-024. `glossaryTerms: ['pair', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-quad.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-027: Rewrite x-wing fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-012
- **Description**: Rewrite description per §5.3 example; corner cells → `pattern-primary`; the line cells (rest of the two rows or columns) where the digit is being eliminated → `elimination`. Catalog `glossaryTerms: ['candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/x-wing.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-028: Rewrite swordfish fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite as TASK-027 but for 3-row pattern. `glossaryTerms: ['candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/swordfish.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-029: Rewrite jellyfish fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite as TASK-027 but for 4-row pattern. `glossaryTerms: ['candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/jellyfish.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-030: Rewrite xy-wing fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; pivot → `pivot`; pincers → `pincer`; eliminations → `elimination`. Catalog `glossaryTerms: ['pivot-pincer', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/xy-wing.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-031: Rewrite xyz-wing fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite as TASK-030. `glossaryTerms: ['pivot-pincer', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/xyz-wing.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-032: Rewrite w-wing fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; bivalue cells → `pattern-primary`; strong-link cells → `pattern-secondary`; eliminations → `elimination`. Catalog `glossaryTerms: ['candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/w-wing.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-033: Rewrite simple-coloring fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; one-colour cluster → `cluster-a`; the other → `cluster-b`; eliminations → `elimination`. Catalog `glossaryTerms: ['cluster', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/simple-coloring.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-034: Rewrite x-cycle fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; cycle nodes → `chain-link`; eliminations → `elimination`. Catalog `glossaryTerms: ['chain', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/x-cycle.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-035: Rewrite empty-rectangle fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; box cells → `pattern-primary`; strong link cells → `pattern-secondary`; eliminations → `elimination`. Catalog `glossaryTerms: ['box', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/empty-rectangle.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-036: Rewrite skyscraper fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; roof cells → `pattern-primary`; base cells → `pattern-secondary`; eliminations → `elimination`. Catalog `glossaryTerms: ['candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/skyscraper.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-037: Rewrite two-string-kite fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; row tail and col tail cells → `pattern-primary`; row-box and col-box cells (the two cells inside the shared box) → `pattern-secondary`; eliminations → `elimination`. Catalog `glossaryTerms: ['box', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/two-string-kite.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-038: Rewrite unique-rectangle fixtures (Type 1, Type 2, Type 4)
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: `unique-rectangle.fixture.ts` exports three `fixture*` constants (Type 1, Type 2, Type 4). Rewrite all three descriptions; rectangle corners → `corner`; eliminations → `elimination`. Catalog entry for `unique-rectangle` gets `glossaryTerms: ['candidate', 'elimination']`. The three descriptions stay independent — no shared description string.
- **Verification**: `npx vitest run src/engine/solver/techniques/unique-rectangle.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-039: Rewrite bug-plus-one fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description, replacing "bivalue universal grave" framing with the §5.1 fallback ("a near-stuck pattern where every cell except one has only two possibilities"); the +1 cell → `placement`; the surrounding bivalue cells → `pattern-primary`. Catalog `glossaryTerms: ['candidate', 'placement']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/bug.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-040: Rewrite xy-chain fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; chain cells → `chain-link`; eliminations → `elimination`. Catalog `glossaryTerms: ['chain', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/xy-chain.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-041: Rewrite multi-coloring fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; cluster1A + cluster2A → `cluster-a`; cluster1B + cluster2B → `cluster-b`; eliminations → `elimination`. Catalog `glossaryTerms: ['cluster', 'candidate', 'elimination']`. Description's 3-sentence cap is relaxed to 5 sentences for this one (per §17 fallback).
- **Verification**: `npx vitest run src/engine/solver/techniques/multi-coloring.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-042: Rewrite als-xz fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description, replacing "almost-locked set" with the §5.1 fallback ("a small group of cells where you almost know which numbers go in them"); ALS A cells → `cluster-a`; ALS B cells → `cluster-b`; eliminations → `elimination`. Catalog `glossaryTerms: ['cluster', 'candidate', 'elimination']`. Sentence cap relaxed to 5.
- **Verification**: `npx vitest run src/engine/solver/techniques/als-xz.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-043: Rewrite wxyz-wing fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; hinge → `pivot`; three pincers → `pincer`; eliminations → `elimination`. Catalog `glossaryTerms: ['pivot-pincer', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/wxyz-wing.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-044: Rewrite hidden-rectangle fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; rectangle corners → `corner`; eliminations → `elimination`. Catalog `glossaryTerms: ['candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-rectangle.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-045: Rewrite avoidable-rectangle fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description, explaining that the technique works when *you* placed three of the four corners (not part of the original puzzle); placed corners → `pattern-primary`; target corner → `elimination` or `placement` depending on Type 1 vs other types; remaining patterns → `corner`. Avoidable-rectangle has multiple types; if multiple `fixture*` constants exist, handle each like TASK-038. Catalog `glossaryTerms: ['placement', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/avoidable-rectangle.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-046: Rewrite nice-loop fixtures (continuous + discontinuous)
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Two fixtures in `nice-loop.fixture.ts`. Rewrite both descriptions; loop nodes → `chain-link`; eliminations or placement → `elimination` / `placement`. Catalog `glossaryTerms: ['chain', 'candidate', 'elimination']`. Sentence cap relaxed to 5.
- **Verification**: `npx vitest run src/engine/solver/techniques/nice-loop.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-047: Rewrite grouped-x-cycle fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description; cycle nodes (each may span multiple cells) → `chain-link`; eliminations → `elimination`. Catalog `glossaryTerms: ['chain', 'candidate', 'elimination']`.
- **Verification**: `npx vitest run src/engine/solver/techniques/grouped-x-cycle.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-048: Rewrite death-blossom fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description, replacing graph-theoretic vocabulary; stem → `pivot`; petal ALSes → `pincer` (or `cluster-a/b` if pincer feels misleading at multiple petals — author discretion); eliminations → `elimination`. Catalog `glossaryTerms: ['pivot-pincer', 'cluster', 'candidate', 'elimination']`. Sentence cap relaxed to 5.
- **Verification**: `npx vitest run src/engine/solver/techniques/death-blossom.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-049: Rewrite forcing-chains fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005
- **Description**: Rewrite description, replacing "forcing chain" with plain language ("try each option; if every option leads to the same conclusion, that conclusion is forced"); source cell → `pivot`; eliminations or placement → `elimination` / `placement`. Catalog `glossaryTerms: ['chain', 'candidate', 'elimination', 'placement']`. Sentence cap relaxed to 5.
- **Verification**: `npx vitest run src/engine/solver/techniques/forcing-chains.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-050: Rewrite medusa-3d fixture description and roles
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-003, TASK-005, TASK-016
- **Description**: After TASK-016 fixes the board, rewrite the description in plain English (target wording in requirements §5.3); colourA cells → `cluster-a`; colourB cells → `cluster-b`; eliminations → `elimination`. Catalog `glossaryTerms: ['cluster', 'chain', 'candidate', 'elimination']`. Sentence cap relaxed to 5.
- **Verification**: `npx vitest run src/engine/solver/techniques/medusa-3d.test.ts src/engine/solver/techniques/fixtures-round-trip.test.ts`.

### TASK-051: Author glossary diagrams
- **Status**: done
- **Type**: feat
- **Dependencies**: TASK-004
- **Description**: Replace each `GLOSSARY[id].diagram` placeholder in `src/engine/solver/techniques/glossary.ts` with a tiny inline SVG (≤ 120×120 px) returning JSX. Each diagram visualizes the term using the role colours from §4.1. Exact visual is author-discretion; the glossary entry is considered complete when the diagram conveys the term in one glance.
- **Verification**: `npx vitest run src/engine/solver/techniques/glossary` (visual is not asserted; tests only verify the diagram returns truthy JSX); spot check by booting the dev server and visiting a TechniqueDetail page that lists each term.

### TASK-052: Rewrite naked-single explanation template
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: In `src/engine/solver/techniques/naked-single.ts`, rewrite the `explanation:` template per §5/§8: drop the `R${row+1}C${col+1}` interpolation; produce a sentence at 12-yo reading level. Example target: `Place ${digit} in the highlighted cell — every other number in its row, column, and box is already taken.`
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-single.test.ts`.

### TASK-053: Rewrite hidden-single explanation template
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: As TASK-052 for `hidden-single.ts`. Drop cell coordinates; produce plain-English sentence.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-single.test.ts`.

### TASK-054: Rewrite intersection explanation templates (pointing + box-line-reduction)
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: In `src/engine/solver/techniques/intersection.ts`, rewrite the two `explanation:` templates (one each for pointing and box-line-reduction).
- **Verification**: `npx vitest run src/engine/solver/techniques/intersection.test.ts`.

### TASK-055: Rewrite naked-subset explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: In `src/engine/solver/techniques/naked-subset.ts`, rewrite the explanation templates for naked-pair / naked-triple / naked-quad.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-subset.test.ts`.

### TASK-056: Rewrite hidden-pair / triple / quad explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation templates in `hidden-pair.ts`, `hidden-triple.ts`, `hidden-quad.ts` (separate files per the existing structure; if they share a `hidden-subset.ts`, edit that single file).
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-pair.test.ts src/engine/solver/techniques/hidden-triple.test.ts src/engine/solver/techniques/hidden-quad.test.ts`.

### TASK-057: Rewrite x-wing / swordfish / jellyfish explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation templates in `x-wing.ts`, `swordfish.ts`, `jellyfish.ts` (or shared `fish.ts` if used).
- **Verification**: `npx vitest run src/engine/solver/techniques/x-wing.test.ts src/engine/solver/techniques/swordfish.test.ts src/engine/solver/techniques/jellyfish.test.ts`.

### TASK-058: Rewrite xy-wing / xyz-wing / wxyz-wing explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation templates in `xy-wing.ts`, `xyz-wing.ts`, `wxyz-wing.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/xy-wing.test.ts src/engine/solver/techniques/xyz-wing.test.ts src/engine/solver/techniques/wxyz-wing.test.ts`.

### TASK-059: Rewrite w-wing explanation template
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation in `w-wing.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/w-wing.test.ts`.

### TASK-060: Rewrite simple-coloring explanation template
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation in `simple-coloring.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/simple-coloring.test.ts`.

### TASK-061: Rewrite multi-coloring explanation template
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation in `multi-coloring.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/multi-coloring.test.ts`.

### TASK-062: Rewrite x-cycle / grouped-x-cycle explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation templates in `x-cycle.ts` and `grouped-x-cycle.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/x-cycle.test.ts src/engine/solver/techniques/grouped-x-cycle.test.ts`.

### TASK-063: Rewrite empty-rectangle / skyscraper / two-string-kite explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation templates in the three files.
- **Verification**: `npx vitest run src/engine/solver/techniques/empty-rectangle.test.ts src/engine/solver/techniques/skyscraper.test.ts src/engine/solver/techniques/two-string-kite.test.ts`.

### TASK-064: Rewrite unique-rectangle / hidden-rectangle / avoidable-rectangle explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite the three (or more, if multiple types per file) explanation templates.
- **Verification**: `npx vitest run src/engine/solver/techniques/unique-rectangle.test.ts src/engine/solver/techniques/hidden-rectangle.test.ts src/engine/solver/techniques/avoidable-rectangle.test.ts`.

### TASK-065: Rewrite bug-plus-one explanation template
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation in `bug.ts`. See requirements §8 for example target wording.
- **Verification**: `npx vitest run src/engine/solver/techniques/bug.test.ts`.

### TASK-066: Rewrite als-xz / death-blossom explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation templates in `als-xz.ts` and `death-blossom.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/als-xz.test.ts src/engine/solver/techniques/death-blossom.test.ts`.

### TASK-067: Rewrite xy-chain / nice-loop explanation templates
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation templates in `xy-chain.ts` and `nice-loop.ts` (the latter has two: continuous and discontinuous).
- **Verification**: `npx vitest run src/engine/solver/techniques/xy-chain.test.ts src/engine/solver/techniques/nice-loop.test.ts`.

### TASK-068: Rewrite 3d-medusa explanation template
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation in `medusa-3d.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/medusa-3d.test.ts`.

### TASK-069: Rewrite forcing-chains explanation template
- **Status**: pending
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite explanation in `forcing-chains.ts`.
- **Verification**: `npx vitest run src/engine/solver/techniques/forcing-chains.test.ts`.

### TASK-070: Wire `Hint.onHighlight` through `Game.tsx` to `Board.cellHighlights`
- **Status**: pending
- **Type**: feat
- **Dependencies**: TASK-007, TASK-008
- **Description**: In `src/screens/Game.tsx`, add a local `[hintHighlights, setHintHighlights] = useState<HintHighlight[]>([])` and pass `onHighlight={setHintHighlights}` to `<Hint>`. Pass `cellHighlights={hintHighlights}` to `<Board>`. Subscribe to `store.board` and clear `hintHighlights` whenever `board` changes (use a `useEffect` with `board` as dependency, comparing reference equality is fine).
- **Verification**: `npx vitest run src/screens/Game.test.tsx`.

### TASK-071: Update `Hint.test.tsx` plain-English copy assertions
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-008, TASK-052
- **Description**: Update the `expect(getByTestId('hint-explanation').textContent).toBe('R1C1 has only 9 as a candidate')` assertion (and any like it) to match the rewritten plain-English copy from TASK-052+. Use a regex-based match (e.g. `expect(...).toMatch(/place 9 in the highlighted cell/i)`) to allow minor authoring tweaks. Add an assertion that the explanation does NOT contain `/[Rr]\d+[Cc]\d+/` and does NOT contain banned-jargon terms (`bivalue`, `house`, `strong link`, etc. — pick a representative subset for the regex). Payload-shape assertions are already covered by TASK-008.
- **Verification**: `npx vitest run src/components/Hint.test.tsx`.

### TASK-072: Update `TechniqueDetail.tsx` for legend strip, role highlights, and glossary section
- **Status**: pending
- **Type**: feat
- **Dependencies**: TASK-007, TASK-005, TASK-051
- **Description**: In `src/screens/TechniqueDetail.tsx`:
  1. Delete `formatPosition` and `deductionSummary`.
  2. Compute `cellHighlights` from `fixture.roles` (during `pattern` step) and from `fixture.deduction` cells (during `deduction` and `applied` steps, with `placement`/`elimination` precedence).
  3. Render a legend strip above `<Board>`: list each role used by the current fixture with a swatch and `roleLabels[role]`.
  4. Replace the walkthrough panel's text content per requirements §11 (no more r1c1 lists).
  5. After the walkthrough buttons, render the collapsible "Terms used here" section listing entries from `entry.glossaryTerms`.
- **Verification**: `npx vitest run src/screens/TechniqueDetail.test.tsx`.

### TASK-073: Update `TechniqueDetail.test.tsx` for new walkthrough copy and legend
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-072
- **Description**: Update tests in `src/screens/TechniqueDetail.test.tsx`:
  1. Drop assertions on `walkthrough-pattern-cells` containing `r1c1` text.
  2. Add an assertion that the panel contains the new walkthrough copy from §11.
  3. Add a regex assertion that no `r1c1`-style coordinate appears anywhere in the rendered detail.
  4. Add an assertion that the legend strip renders for `xy-wing` (which uses pivot + pincer + elimination).
  5. Add an assertion that the "Terms used here" section renders for at least one technique that has `glossaryTerms` populated.
- **Verification**: `npx vitest run src/screens/TechniqueDetail.test.tsx`.

### TASK-074: Update `Game.test.tsx` for hint-driven role highlighting
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-070
- **Description**: In `src/screens/Game.test.tsx`, add a test case that:
  1. Renders the Game with a board where `nextStep` returns a known technique result;
  2. Clicks the Hint button;
  3. Asserts the corresponding cells on the board have the expected `data-role` attributes;
  4. Mutates the board (places a digit) and asserts `data-role` is gone.
- **Verification**: `npx vitest run src/screens/Game.test.tsx`.

### TASK-075: Update `catalog.test.ts` for glossary-term integrity and roles non-empty
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-005, TASK-049
- **Description**: In `src/engine/solver/techniques/catalog.test.ts` (or wherever catalog assertions live), add:
  1. A test that every catalog entry's `glossaryTerms` (when present) lists only valid `GlossaryTermId` values.
  2. A test that every fixture's `roles` array is non-empty.
- **Verification**: `npx vitest run src/engine/solver/techniques/catalog.test.ts`.

### TASK-076: Bump `package.json` to `0.7.0`
- **Status**: pending
- **Type**: chore
- **Dependencies**: TASK-001
- **Description**: Set `version: '0.7.0'` in `package.json`. Update `package-lock.json` if the version is mirrored there.
- **Verification**: `node -e "if(require('./package.json').version !== '0.7.0') process.exit(1)"` exits 0.

### TASK-077: Full unit-test sweep
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011, TASK-012, TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019, TASK-020, TASK-021, TASK-022, TASK-023, TASK-024, TASK-025, TASK-026, TASK-027, TASK-028, TASK-029, TASK-030, TASK-031, TASK-032, TASK-033, TASK-034, TASK-035, TASK-036, TASK-037, TASK-038, TASK-039, TASK-040, TASK-041, TASK-042, TASK-043, TASK-044, TASK-045, TASK-046, TASK-047, TASK-048, TASK-049, TASK-050, TASK-051, TASK-052, TASK-053, TASK-054, TASK-055, TASK-056, TASK-057, TASK-058, TASK-059, TASK-060, TASK-061, TASK-062, TASK-063, TASK-064, TASK-065, TASK-066, TASK-067, TASK-068, TASK-069, TASK-070, TASK-071, TASK-072, TASK-073, TASK-074, TASK-075, TASK-076
- **Description**: Run the full unit-test suite. Investigate and fix any failures.
- **Verification**: `npm test` exits 0.

### TASK-078: Type-check and production build sweep
- **Status**: pending
- **Type**: build
- **Dependencies**: TASK-077
- **Description**: Run `npx tsc --noEmit` (full project type-check) and `npm run build` (production build). Both must succeed without errors.
- **Verification**: Both commands exit 0.

### TASK-079: Targeted Playwright spot-check on hint and learn flow
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-078
- **Description**: Run `npx playwright test tests/e2e/hint-learn-more.spec.ts` (the existing Playwright spec covering hint Learn-more navigation). Patch any assertions that check old-style `r1c1` text in hint output; the test should now expect on-board highlighting and plain-English copy. Spec file edits in scope.
- **Verification**: `npx playwright test tests/e2e/hint-learn-more.spec.ts --project=chromium --project=webkit` passes on both browsers.

### TASK-080: Full E2E sweep on Chromium and WebKit
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-079
- **Description**: Run `npx playwright test --project=chromium && npx playwright test --project=webkit` (or the project's standard E2E command). No regressions expected outside the hint and learn surface; investigate any unexpected failures.
- **Verification**: Both Playwright projects exit 0.
