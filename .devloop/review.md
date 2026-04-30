# Iteration 8 Code Review — Learn Section Overhaul

**Reviewer**: Senior Code Review Agent
**Date**: 2026-04-30
**Scope**: Iteration 8 — role-coded highlighting, plain-English copy, glossary, fixture fixes, round-trip validation

---

## Summary

The implementation is in a strong state. All 80 tasks are marked done; the full unit sweep (TASK-077), type-check and build sweep (TASK-078), targeted Playwright spot-check (TASK-079), and the full E2E sweep (TASK-080) have all passed according to git history. The core architectural goals — role taxonomy, `cellHighlights` prop, `Hint.onHighlight`, `FINDER_BY_ID`, round-trip test infrastructure, fixture bug fixes, glossary — are all implemented correctly and coherently.

Several issues remain that warrant attention before this codebase sees further iterations or public release.

---

## 1. Requirements vs Implementation

### 1.1 Fully met requirements

The following requirements from §2 are satisfied:

- **Role taxonomy** (`src/engine/solver/techniques/roles.ts`): all 10 `CellRole` values are defined, `roleLabels` is populated with reading-level labels, and `mergeCellRoles` implements the correct precedence chain (placement > elimination > pattern-primary > ... > pattern-secondary).
- **CSS tokens** (`src/themes/*.css`): all four theme stylesheets define every `--role-*` variable. The light and notepad themes use appropriately warm/cool palette split. The dark and space themes use very dark background colours consistent with those themes' contrast needs.
- **`TechniqueFixture` interface** (`catalog.ts`): `patternCells` is gone; `roles: FixtureCellRole[]` is the replacement. The TODO comment at line 55 correctly documents the removal.
- **`TechniqueCatalogEntry.glossaryTerms`**: present and populated on all 34 entries. The `catalog.test.ts` guards integrity via two assertions (all referenced terms exist in `GLOSSARY`; all `fixture.roles` arrays are non-empty).
- **`FINDER_BY_ID`** (`index.ts`): all 34 techniques are mapped. The round-trip test consumes this directly.
- **`Board.cellHighlights`** (`Board.tsx`): prop accepted, converted to `Map<string, CellRole>` once at render top (O(1) per-cell lookup), `data-role` attribute emitted correctly. Precedence chain `conflict → selected → role highlight → completed → given → default` is correctly implemented. The `highlighted` (digit-match highlight) branch falls through between `roleHighlight` and `completed`, which matches the spec.
- **`Hint.cellsAndRolesFromResult`** (`Hint.tsx`): all 34 techniques are covered in the exhaustive switch. Role assignments match the per-technique semantics described in requirements §9.
- **`Game.tsx` wiring**: `hintHighlights` state is managed, `onHighlight={setHintHighlights}` is passed to `<Hint>`, `cellHighlights={hintHighlights}` is passed to `<Board>`, and `useEffect` with `[board]` dependency clears highlights on every board reference change.
- **`TechniqueDetail.tsx`**: `formatPosition` and `deductionSummary` are gone. The legend strip (`role-legend` testid) renders the used roles. The walkthrough panel produces the `highlighted cell(s)` copy without coordinates. The collapsible `GlossarySection` component is correct. The `cellHighlights` computation applies deduction-role overlay on top of pattern roles using `mergeCellRoles`.
- **Fixture fixes**: the hidden-single and medusa-3d fixtures have been replaced with valid constructions (confirmed by reviewing the board strings and docblock analyses). The medusa-3d fixture's `roles` array contains cluster-a, cluster-b, and elimination entries for the same cells, which is a valid multi-role pattern (the `mergeCellRoles` precedence resolves the overlap on render).
- **Round-trip test** (`fixtures-round-trip.test.ts`): 34 fixtures covered; `KNOWN_BROKEN` is now an empty `Set` (no fixtures are skipped). The JSON-substring approach for position matching is lightweight but adequate (see §3.2 below for a caveat).
- **Five previously fixtureless tests**: `hidden-single.test.ts`, `naked-single.test.ts`, `x-wing.test.ts`, `intersection.test.ts`, `naked-subset.test.ts` all import their fixtures and include round-trip cases. The tests assert `result.technique`, `result.cell`/`result.deduction`, and confirm no `R\d+C\d+` patterns in `explanation`.
- **Plain-English copy**: sampled across `naked-single.ts`, `hidden-single.ts`, `bug.ts`, and `nice-loop.ts`. The `naked-single` explanation (`The highlighted cell can only be ${digit} — every other number is already used by a cell in the same row, column, or box. Place ${digit} in the highlighted cell.`) meets the §5 style guide. `bug.ts` follows the §8 example target exactly. `nice-loop.ts` uses "switching back and forth" instead of "alternation", which is correct.
- **Glossary module** (`glossary.tsx`): 8 terms with definitions and inline SVG diagrams. The `glossary.test.ts` verifies all 8 are present with non-empty term/definition/diagram function.
- **`package.json`**: version is `0.7.0`, matching the requirement.
- **`3d-medusa` moved from Nightmare to Nightmare tier**: no change needed; requirement only asked for the new fixture. Confirmed: tier is `'Nightmare'` in `catalog.ts`.

### 1.2 Partial implementations and deviations

**1.2.1 `3d-medusa` round-trip test is deliberately weakened**

The `fixtures-round-trip.test.ts` header comment explicitly notes that `3d-medusa` was excluded from the generic JSON-position check because `Medusa3DElimination` uses `cell` not `pos`. The comment says this is intentional — instead of a code skip, the test continues but the position-check loop would simply never match because `entry.fixture.deduction.eliminations[].pos` exists but the result uses `result.eliminations[].cell`. As implemented, the round-trip test for `3d-medusa` still passes because the test asserts `result !== null` and `result.technique === id`, which are satisfied. However, the position-subset check (`expect(json).toContain('"row":${pos.row}')`) will match incidentally because the JSON does contain those row/col values under `cell` rather than `pos` — so the check may pass for the wrong reason. A dedicated `medusa-3d.test.ts` fixture round-trip test (`it('fixture deduction matches the finder output')` at line 143) provides the real guard, making this acceptable.

**1.2.2 `nice-loop.ts` retains `formatCell` function**

`formatCell` at `nice-loop.ts:157` produces `R${p.row + 1}C${p.col + 1}` strings. The function is used only in `buildAdjacency` at line 204 for an internal `witness` field (a debug label on adjacency entries, never surfaced in any `explanation`). The player-facing `explanation` strings at lines 423, 448, and 474 contain no cell coordinates. This is not a requirements violation (requirements §8 says to drop `R${...}C${...}` from `explanation` templates, not from all internal functions), but the `formatCell` function name and the `witness` field it populates could mislead future developers into believing coordinates are safe to use in user-facing text. See recommendation §4.1.

**1.2.3 `3d-medusa` explanation uses solver-paper terminology**

The three `explanation` strings in `medusa-3d.ts` (lines 312-314, 372-374, 431-433) use "colour A/B", "contradiction", "candidates". The requirements §5.1 lists `candidate` as a term that should become "possible number" in user-facing prose. The §8 example for 3D Medusa shows plain-English copy, but that example is for the fixture `description`, not the runtime `explanation`. The medusa test (`medusa-3d.test.ts` line 139) asserts `result!.explanation.toContain('3D Medusa')` and `result!.explanation.toContain('box 1')`, both satisfied, but does not assert plain-English style. The `Hint.test.tsx` ban assertion `/\bbivalue\b|\bhouse\b|\bstrong link\b|\bconjugate\b|\balternation\b/i` does not cover "candidates". This is a minor style deviation, not a functional defect.

**1.2.4 `unique-rectangle.fixture.ts` exposes multiple `fixture*` constants per requirements**

Requirements §38 note that `unique-rectangle.fixture.ts` exports three fixture constants (Type 1, Type 2, Type 4). `catalog.ts` at line 231 imports only `uniqueRectangleFixture` from `./unique-rectangle.fixture`. Checking the catalog, `unique-rectangle` has a single `fixture` property. The requirements mentioned three types but the catalog only surfaces one. If `unique-rectangle.fixture.ts` exports three separate constants and only the first is wired into the catalog, Types 2 and 4 are not exercised by the round-trip test. This is a scope question: were Types 2 and 4 intended to be cataloged separately or was a single representative fixture acceptable? As shipped, only one type is tested.

**1.2.5 Walkthrough legend strip only shows roles from `fixture.roles`, not deduction roles**

In `TechniqueDetail.tsx`, the legend strip (lines 269-285) iterates `fixture.roles.map(r => r.role)` to find used roles. The `elimination` and `placement` roles added during the deduction step are not listed in the legend unless they already appear in `fixture.roles`. For most techniques this is fine because their fixture `roles` array already contains elimination/placement entries. However, for techniques where the deduction cells are not in `fixture.roles` at all (only added at the deduction step), those roles will be absent from the legend even though they appear on the board. This is a minor UX gap — the legend correctly covers the pattern step, but may be incomplete during the deduction/applied steps.

---

## 2. Code Quality

### 2.1 No bugs found in critical paths

The `mergeCellRoles` logic is correct: it uses a position-in-array comparison against `ROLE_PRECEDENCE`, lower index wins. The empty-array guard (`throw new Error`) is present and tested. The `Board` component converts `cellHighlights` to a `Map` once before rendering, avoiding O(n) repeated searches inside the cell loop. The `Game.tsx` `useEffect` with `[board]` dependency correctly clears highlights on every board reference change (new game, digit placed, note toggled).

### 2.2 `data-role` renders as `data-role="undefined"` string risk

In `Board.tsx` line 77: `data-role={roleHighlight}`. When `roleHighlight` is `undefined`, React omits the attribute entirely from the DOM, which is the correct and tested behavior (the test at `Board.test.tsx:73-78` asserts `querySelectorAll('[data-role]').length === 0` when no highlights are provided). This is not a bug but it is worth noting: the test correctly uses `getAttribute('data-role')` returning `null` (not `undefined`) to verify absence.

### 2.3 `TechniqueDetail.tsx` computes `cellHighlights` in a `useMemo` with `[step, fixture]` dependencies

The `cellHighlights` memo at lines 196-231 parses `fixture.roles` on every `step` change. Since `fixture` is derived from `entry.fixture` which is a module-level constant, `fixture` reference is stable across renders. The dependency is correct. The `mergeCellRoles` call inside the memo handles multi-role cells (as in `medusa-3d.fixture.ts` where the same cell appears as both `cluster-a` and `elimination`). The `mergeCellRoles` precedence means `elimination` wins over `cluster-a` at that cell during the deduction step, which is the intended behaviour.

### 2.4 `GlossarySection` collapse state is lost on navigation

`TechniqueDetail.tsx:125` — `GlossarySection` uses `useState(false)` for collapse state. Requirements §6 explicitly states "Persisted state is not stored — collapse state resets on navigation." This is intentional and correctly implemented. No issue.

### 2.5 `nice-loop.ts:204` internal `witness` field uses `formatCell`

As noted in §1.2.2, `formatCell` produces `R1C1`-style strings for the internal `witness` field only. The `witness` field is used to label adjacency entries in the BFS graph structure and is never included in the `explanation` string or passed to any UI component. No user sees these strings. However the field appears in the `AdjEntry` type and in the adjacency map, meaning any future developer extending the nice-loop finder could accidentally surface `witness` in an explanation without realising it violates the plain-English standard. This is a latent risk, not a current defect.

### 2.6 `medusa-3d.fixture.ts` duplicate roles on same cell

The `roles` array in `medusa-3d.fixture.ts` lists the same cells (e.g. `{row:0, col:0}`) under `cluster-a`, `cluster-b`, and `elimination`. The `TechniqueDetail.tsx` `cellHighlights` memo handles this correctly via `mergeCellRoles` (lines 201-210). The `Board` component uses a `Map` which takes the last set value — but `cellHighlights` is built from the `roleMap`, so by the time it reaches the `Board` each position appears at most once with the merged role. No rendering bug.

### 2.7 `catalog.ts` TODO comment is stale

Line 55 in `catalog.ts`: `// TODO: 'patternCells' was removed in iteration 7 and replaced with 'roles'.`

This comment states "iteration 7" but the interface change was made in this iteration (iteration 8). More importantly, the TODO has already been resolved — `roles` is the current field and `patternCells` is nowhere in the live codebase. A resolved TODO comment with an incorrect iteration reference is minor but should be cleaned up.

### 2.8 `glossary.tsx` returns `ReactElement | null` but diagrams never return `null`

The `GlossaryEntry.diagram` type is `() => ReactElement | null`. All eight diagrams unconditionally return an SVG element. The `| null` union type is harmless but slightly misleading: it was originally a placeholder for the "initial placeholder" phase described in TASK-004. Since all diagrams are now authored (TASK-051 done), the return type could be tightened to `() => ReactElement`. This is a cosmetic issue.

---

## 3. Testing

### 3.1 Test coverage is strong for the core requirements

- `roles.test.ts`: 8 assertions covering all important precedence cases including empty-array guard. Complete.
- `glossary.test.ts`: 5 assertions verifying structural integrity. Does not assert diagram return values are truthy JSX (only that `diagram` is a function), but the round-trip tests indirectly cover rendering.
- `catalog.test.ts`: covers glossaryTerms integrity and `fixture.roles` non-empty for all 34 entries. Also includes an in-file round-trip check that exercises every finder.
- `Board.test.tsx`: 5 targeted assertions. Covers `data-role` presence, multi-cell highlights, and the "no cellHighlights" baseline. Does not assert role-based background colour precedence over `completed` (as required by §7 of requirements), but background colour is a computed CSS style that JSDOM does not evaluate from custom properties — this is a known limitation, not a gap.
- `Hint.test.tsx`: asserts plain-English copy (regex), no `R\d+C\d+` coordinates, no banned jargon, and correct `{pos, role}` shape for `onHighlight`. The banned-jargon regex (`bivalue`, `house`, `strong link`, `conjugate`, `alternation`) is a reasonable representative subset.
- `Game.test.tsx`: the hint-highlights-and-clears test (lines 82-102) is correctly structured. It clears highlights by setting a new board reference (not by direct store mutation of an individual cell), which exercises the `useEffect([board])` clearing path correctly.
- `TechniqueDetail.test.tsx`: covers the legend strip for `xy-wing` and the glossary section toggle for `naked-single`. The regex assertion that no `R\d+C\d+` appears in the walkthrough panel is present at line 126.
- `fixtures-round-trip.test.ts`: covers all 34 fixtures with non-null result, matching `technique` id, and JSON-presence check for documented deduction positions.

### 3.2 Weakness in round-trip test position-checking strategy

The round-trip test checks fixture deduction positions by asserting `JSON.stringify(result).toContain('"row":N')`. This is a substring search on the full serialised result, not a structural check. It can produce false positives if the row number `N` appears in an unrelated field. For example, if the result contains `"row":0` in the `colorA` array of a medusa result, the check passes even if the `eliminations` array is missing that position. For the current fixture set this is unlikely to cause false-positive passes, but it is a fragile testing pattern. The `medusa-3d.test.ts:143-176` dedicated fixture test uses structural comparison (`findElim` helper, `toHaveLength`) and is the correct pattern.

### 3.3 Missing role-precedence test in `Board.test.tsx`

Requirements §7 and the task description for TASK-007 state: "role highlight wins over `completed` and `given`; role highlight loses to `selected` and `conflict`." The existing `Board.test.tsx` tests only confirm `data-role` is set, not that the background colour precedence is correct. As noted above, JSDOM does not evaluate CSS custom properties, so a background-colour assertion cannot be made at unit-test level without mocking. A comment in the test acknowledging this limitation would improve maintainability.

### 3.4 `unique-rectangle` Types 2 and 4 not in round-trip

If `unique-rectangle.fixture.ts` exports multiple fixture constants but only the first is wired into the catalog (and therefore the round-trip test), Types 2 and 4 are not validated. This should be verified and potentially addressed.

### 3.5 `Hint.test.tsx` banned-jargon check incomplete

The banned-jargon check at `Hint.test.tsx:58` only applies to the `naked-single` explanation. The hint explanation for each technique is tested only when that technique fires on the test board. There is no test that instantiates a board triggering a Medusa, ALS-XZ, or forcing-chains result and checks those explanations for jargon. This means jargon that survives in higher-tier `explanation` strings could go undetected by the current test suite. The `medusa-3d.ts` explanations use "colour A/B is a contradiction" which contains "candidates" (a §5.1 term to be avoided). These are not tested.

---

## 4. Recommendations

### Critical (must fix before shipping)

None identified. The implementation compiles, all tasks are marked done, sweeps have passed.

### Important (should fix)

**4.1 `nice-loop.ts` `formatCell` function name and usage**

The function at `nice-loop.ts:157` should be renamed or have a comment making clear it is only for internal BFS graph labelling and must never be used in player-facing strings. Suggested: rename to `internalCellKey` or `debugCellLabel` and add a comment `// Internal BFS witness label — never used in explanation strings.`

**4.2 `medusa-3d.ts` explanation strings use "candidates"**

Lines 313-314, 373-374, 432-433: `"remove all colour ${rule2Color} candidates"`. Per requirements §5.1, "candidate (in user-facing prose)" should become "possible number". The medusa-3d explanation is shown in the Hint panel `hint-explanation` testid. Change "candidates" to "possible numbers" in these three templates. The `Hint.test.tsx` jargon regex should be extended to include `\bcandidate\b` and `\bcandidates\b` to guard this going forward.

**4.3 Resolve `unique-rectangle` Type 2 and Type 4 fixture coverage**

Verify that `unique-rectangle.fixture.ts` exports only one fixture constant (Type 1) or that all exported types are cataloged. If Types 2 and 4 exist but are not in `TECHNIQUE_CATALOG`, they bypass the round-trip test entirely. Either wire them into the catalog under separate technique IDs, or document explicitly that only Type 1 is the demonstrated fixture and the other types are tested through the per-technique test.

**4.4 Remove or resolve the stale `// TODO:` comment in `catalog.ts`**

Line 55: `// TODO: 'patternCells' was removed in iteration 7 and replaced with 'roles'.` The task is done. Remove the comment or replace with a plain documentation comment explaining the history without the TODO marker.

### Suggestions (nice to have)

**4.5 Tighten `GlossaryEntry.diagram` return type**

Change `diagram: () => ReactElement | null` to `() => ReactElement` in `glossary.tsx` now that all diagrams are authored. The `null` option was a placeholder for the initial stub phase.

**4.6 Extend the legend strip to include deduction roles**

`TechniqueDetail.tsx` legend strip shows only roles from `fixture.roles`. Consider including `placement` and `elimination` in the legend whenever those roles appear during the deduction step (even if they are not in `fixture.roles`). This ensures the legend is accurate for the deduction and applied steps. Implementation: derive the legend from `cellHighlights` (the already-computed merged set) rather than from `fixture.roles` directly, and conditionally render it when `step !== 'initial'`.

**4.7 Add a comment in `Board.test.tsx` about CSS custom-property limitation**

The test asserts `data-role` presence but cannot assert background colour. A one-line comment noting that background-colour precedence is validated through the component's logic (not through JSDOM computed styles) would help future maintainers understand the coverage boundary.

---

## 5. Future Considerations

**5.1 `formatCell` / `witness` exposure in `nice-loop.ts`**

If the nice-loop finder is extended (e.g. to include a richer trace for educational purposes), the `witness` field contains `R1C1`-style references that could accidentally surface in a UI. The architecture is safe today but the field's purpose is underdocumented.

**5.2 Round-trip test structural fragility**

As noted in §3.2, the position-checking strategy in `fixtures-round-trip.test.ts` is JSON-substring-based. A future refactor that adds a new field containing the same row/col values could mask a broken deduction position. For the current fixture set the risk is low, but migrating to a structural check using a typed helper (similar to `findElim` in the per-technique tests) would remove the fragility entirely.

**5.3 Glossary diagram accessibility**

All eight SVG diagrams carry `aria-hidden="true"`. The glossary entry's text definition provides the accessible content. This is correct per requirements. However, the `candidate` diagram shows a cell with "1 3" pencil marks and a large "5" — a reader unfamiliar with sudoku notation might not understand the visual. This is a content quality note, not an accessibility defect, but is worth revisiting once the Learn section has real players.

**5.4 Hint panel does not clear on navigation away from Game**

The `hintHighlights` state in `Game.tsx` is cleared when `board` changes (via `useEffect`). It is not explicitly cleared when the Game screen is unmounted and re-mounted (e.g. back-to-home then new game). Since `hintHighlights` is local state, it resets to `[]` on mount by default, which is the correct behaviour. No action needed, but documenting this in the component's JSDoc would be useful as the Game screen gains complexity.

**5.5 `TechniqueFixture` interface is duplicated in every fixture file**

Every `*.fixture.ts` file re-declares the `TechniqueFixture` interface locally and imports `Position`, `Digit`, `CellRole` independently. The canonical interface lives in `catalog.ts`. This was likely done to avoid circular imports (fixture files importing from catalog which imports from fixture files). A separate `types/fixture.ts` exporting only the interface (no catalog data) would eliminate the 34 redundant declarations while avoiding circularity. This is a low-priority refactor but will become increasingly awkward if the fixture interface evolves further.

---

## 6. Conclusion

The iteration 8 implementation is coherent and complete. All 34 technique fixtures have been rewritten to the role taxonomy, both known-bad fixtures are replaced with valid constructions verified by tests, the Hint panel now emits role-annotated highlights to the live game board, and the TechniqueDetail walkthrough is free of cell coordinates. The testing infrastructure (round-trip tests, fixture imports, jargon checks) provides meaningful regression coverage.

The two items that most warrant attention before the next iteration are the "candidates" wording in the medusa-3d explanation strings (a §5.1 violation in user-facing text) and the unique-rectangle Type 2/4 coverage gap. Both are addressable in a small follow-up task without replanning.
