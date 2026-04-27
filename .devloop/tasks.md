# Sudoku PWA — Iteration 2 Tasks: Difficulty Overhaul

See `.devloop/requirements.md` for full context. The previous iteration's
tasks (v0.1.0, TASK-001..046) are archived under
`.devloop/archive/iteration-1/`. Task numbering restarts at TASK-001 for this
iteration.

Conventions:
- Engine code is pure TS (no React) under `src/engine/`.
- Unit tests live next to the file under test (`foo.ts` + `foo.test.ts`).
- Each new solving technique includes its implementation, unit test, and a
  fixture file (`<name>.fixture.ts`) used by both the test and the help
  screen. Fixture format per requirements §8.4.
- Technique tasks each add their mapping to `TECHNIQUE_TIER` and their id to
  `TechniqueId` in `rate.ts`, but do NOT wire the finder into rate's internal
  solver chain — that happens in TASK-035. This keeps individual tests green
  even before the rater is fully wired.
- Implementations may share helpers (e.g. extending `naked-subset.ts` for
  quads, or factoring out fish detection) where the logic naturally
  generalises. Match the existing code style in `src/engine/solver/`.

---

## Phase 1: Foundation

### TASK-001: Expand Difficulty union and DIFFICULTY_ORDER
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/engine/generator/rate.ts`, expand the `Difficulty` type to `'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master' | 'Diabolical' | 'Demonic' | 'Nightmare'`. Update `DIFFICULTY_ORDER` to match. Existing `tierRank` stays correct because it uses indexOf. Update `RateResult.difficulty` references.
- **Verification**: `npx tsc --noEmit -p tsconfig.json`

### TASK-002: Update CLUE_BOUNDS for new tiers
- **Status**: done
- **Dependencies**: TASK-001
- **Description**: In `rate.ts`, expand `CLUE_BOUNDS` to include all 8 tiers per variant. Mini only needs Easy/Medium/Hard (cap is Hard). Six needs Easy through Diabolical. Classic needs all 8. Use sensible advisory windows (e.g. classic: Master 26-31, Diabolical 24-28, Demonic 22-26, Nightmare 20-24). These are advisory only — strict tier matching is the primary filter.
- **Verification**: `npx tsc --noEmit -p tsconfig.json`

### TASK-003: Variant tier-cap helper
- **Status**: done
- **Dependencies**: TASK-001
- **Description**: Create `src/engine/generator/variant-tiers.ts` exporting `availableTiers(variant: Variant): readonly Difficulty[]` returning the tiers shown for that variant per requirements §4.1. Add `variant-tiers.test.ts` covering each variant returns the expected tier list.
- **Verification**: `npx vitest run src/engine/generator/variant-tiers.test.ts`

### TASK-004: Vite define for __APP_VERSION__
- **Status**: done
- **Dependencies**: none
- **Description**: In `vite.config.ts`, read `package.json#version` (e.g. via `JSON.parse(fs.readFileSync('package.json'))`) and add a `define` block exposing `__APP_VERSION__: JSON.stringify(pkg.version)`. Declare the global in `src/vite-env.d.ts` so TS recognises it.
- **Verification**: `npm run build` completes; `grep -r "0\\.2\\.0" dist/assets/*.js` finds the version (after TASK-005 bumps it).

### TASK-005: Bump app version to 0.2.0
- **Status**: done
- **Dependencies**: none
- **Description**: Bump `package.json` version from `0.1.0` to `0.2.0`. Also update the version shown in `src/components/UpdatePrompt.tsx` if it's hard-coded there; otherwise leave for build-time injection.
- **Verification**: `node -p "require('./package.json').version"` outputs `0.2.0`.

### TASK-006: Rebuild TECHNIQUE_TIER for existing techniques
- **Status**: done
- **Dependencies**: TASK-001
- **Description**: In `rate.ts`, REWRITE `TECHNIQUE_TIER` to the new mapping for existing techniques per requirements §5.2: naked-single→Easy, hidden-single→Medium, pointing→Hard, box-line-reduction→Hard, naked-pair→Expert, naked-triple→Expert, x-wing→Master. Update existing `rate.test.ts` fixtures so puzzles previously rated Hard via naked-pair are now rated Expert, etc. New technique entries are added by their own tasks.
- **Verification**: `npx vitest run src/engine/generator/rate.test.ts`

---

## Phase 2: New solver techniques

Each technique task implements the finder, a `<name>.fixture.ts`, and a
`<name>.test.ts`. Each task also adds its `TechniqueId` and `TECHNIQUE_TIER`
entry. Wiring into the rater chain and `techniques/index.ts` is deferred to
TASK-035 and TASK-036.

### TASK-007: Hidden Pair
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Add `src/engine/solver/techniques/hidden-pair.ts`: in any house, two digits whose only candidate cells in the house are the same two cells form a Hidden Pair — eliminate all other candidates from those two cells. May share helpers with `naked-subset.ts`. Fixture + positive/negative tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-pair.test.ts`

### TASK-008: Hidden Triple
- **Status**: done
- **Dependencies**: TASK-007
- **Description**: Add `hidden-triple.ts`: three digits confined to the same three cells in a house. Eliminate other candidates from those cells. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-triple.test.ts`

### TASK-009: Naked Quad
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Add `naked-quad.ts` (or extend `naked-subset.ts` to support size 4). Four cells in a house whose union of candidates is exactly four digits → eliminate those digits from the house's other cells. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-quad.test.ts`

### TASK-010: Hidden Quad
- **Status**: done
- **Dependencies**: TASK-008
- **Description**: Add `hidden-quad.ts`: four digits confined to four cells in a house. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-quad.test.ts`

### TASK-011: Swordfish
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Add `swordfish.ts`: three rows where a digit's candidate cells are confined to the same three columns → eliminate that digit from those columns in other rows. Mirror for column-orientation. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/swordfish.test.ts`

### TASK-012: Jellyfish
- **Status**: done
- **Dependencies**: TASK-011
- **Description**: Add `jellyfish.ts`: 4-row/4-column generalisation of Swordfish. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/jellyfish.test.ts`

### TASK-013: XY-Wing
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Add `xy-wing.ts`: a pivot bivalue cell (XY) and two pincer bivalue cells (XZ, YZ) where each pincer shares a house with the pivot but the pincers don't share. Eliminate Z from cells that see both pincers. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/xy-wing.test.ts`

### TASK-014: XYZ-Wing
- **Status**: done
- **Dependencies**: TASK-013
- **Description**: Add `xyz-wing.ts`: pivot is trivalue (XYZ), two pincers are bivalues (XZ, YZ) that see the pivot. Eliminate Z from cells that see all three. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/xyz-wing.test.ts`

### TASK-015: W-Wing
- **Status**: done
- **Dependencies**: TASK-013
- **Description**: Add `w-wing.ts`: two bivalue cells with the same digits (XY, XY) connected by a strong link on Y. Eliminate X from cells that see both bivalue cells. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/w-wing.test.ts`

### TASK-016: Simple Coloring
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Add `simple-coloring.ts`: for a chosen digit, build the strong-link graph (cells where the digit appears in only two cells of a house). Two-color the graph; if any house contains two same-colored cells, that color is invalid → eliminate the digit from those cells. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/simple-coloring.test.ts`

### TASK-017: X-Cycle
- **Status**: done
- **Dependencies**: TASK-016
- **Description**: Add `x-cycle.ts`: a cycle of strong/weak links for one digit. Continuous cycles eliminate from cells seeing both endpoints of weak links; discontinuous cycles place or eliminate at the discontinuity. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/x-cycle.test.ts`

### TASK-018: Empty Rectangle
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Add `empty-rectangle.ts`: in a box, a digit's candidates are confined to one row and one column intersecting at an "empty rectangle" cell; combined with a strong link in another house, eliminate at the intersection. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/empty-rectangle.test.ts`

### TASK-019: Skyscraper
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Add `skyscraper.ts`: two rows (or two columns) where a digit appears exactly twice each, and one column (row) is shared. The other two cells form the "roof"; eliminate the digit from cells that see both roof cells. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/skyscraper.test.ts`

### TASK-020: Two-String Kite
- **Status**: done
- **Dependencies**: TASK-019
- **Description**: Add `two-string-kite.ts`: like Skyscraper but the strong links are in different orientations (one row, one column) sharing a box. Eliminate the digit from the cell seeing both endpoints. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/two-string-kite.test.ts`

### TASK-021: Unique Rectangle (Types 1, 2, 4)
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Add `unique-rectangle.ts` covering Types 1, 2, and 4. The pattern: four cells in a rectangle spanning two boxes, each containing the same two candidates X,Y. If allowed, the puzzle would have multiple solutions, so the configuration is impossible. Per type, eliminate or restrict candidates accordingly. Fixture (one per type, all in the file) + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/unique-rectangle.test.ts`

### TASK-022: BUG+1
- **Status**: pending
- **Dependencies**: TASK-006
- **Description**: Add `bug.ts`: detect Bivalue Universal Grave +1 — every unsolved cell except one has exactly two candidates. The "+1" cell must be the digit that would otherwise appear three times in some house, otherwise the puzzle would have multiple solutions. Place that digit. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/bug.test.ts`

### TASK-023: XY-Chain
- **Status**: pending
- **Dependencies**: TASK-013
- **Description**: Add `xy-chain.ts`: extension of XY-Wing to longer chains. A sequence of bivalue cells where consecutive cells share a digit and a house, starting and ending with the same digit Z. Eliminate Z from cells that see both endpoints. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/xy-chain.test.ts`

### TASK-024: Multi-Coloring
- **Status**: pending
- **Dependencies**: TASK-016
- **Description**: Add `multi-coloring.ts`: build coloring chains for a digit and identify when two color clusters interact such that one color from each cluster is forced false, leading to eliminations on cells seeing both. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/multi-coloring.test.ts`

### TASK-025: ALS-XZ
- **Status**: pending
- **Dependencies**: TASK-006
- **Description**: Add `als-xz.ts`: two Almost Locked Sets (ALS) sharing a "restricted common" digit X. Any digit Z common to both ALS that is not the restricted common can be eliminated from cells seeing all Z-candidates in both ALS. Implement an ALS detector helper (used here and possibly in later tasks). Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/als-xz.test.ts`

### TASK-026: WXYZ-Wing
- **Status**: pending
- **Dependencies**: TASK-014
- **Description**: Add `wxyz-wing.ts`: 4-cell extension of XYZ-Wing where four cells share four candidates W,X,Y,Z and eliminate Z from cells that see all four. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/wxyz-wing.test.ts`

### TASK-027: Hidden Rectangle
- **Status**: pending
- **Dependencies**: TASK-021
- **Description**: Add `hidden-rectangle.ts`: a uniqueness pattern where a rectangle of bivalue corners would create two solutions; one corner having extra candidates lets you eliminate one of the bivalue digits from that corner. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-rectangle.test.ts`

### TASK-028: Avoidable Rectangle
- **Status**: pending
- **Dependencies**: TASK-021
- **Description**: Add `avoidable-rectangle.ts`: uniqueness pattern using already-placed digits. If two non-given placed digits and one bivalue cell complete a rectangle, the bivalue cell must take the digit that avoids creating the deadly pattern. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/avoidable-rectangle.test.ts`

### TASK-029: Nice Loop (continuous)
- **Status**: pending
- **Dependencies**: TASK-017
- **Description**: Add `nice-loop.ts` implementing continuous nice loops (alternating strong/weak inferences forming a closed cycle). Eliminations come from weak links involving cells outside the cycle. Implement the cycle detection plus elimination logic. Fixture + tests for the continuous case.
- **Verification**: `npx vitest run src/engine/solver/techniques/nice-loop.test.ts -t "continuous"`

### TASK-030: Nice Loop (discontinuous)
- **Status**: pending
- **Dependencies**: TASK-029
- **Description**: Extend `nice-loop.ts` to also detect discontinuous nice loops (two weak or two strong links meeting at one node). At the discontinuity, the digit is forced or eliminated. Add fixture + test for the discontinuous case.
- **Verification**: `npx vitest run src/engine/solver/techniques/nice-loop.test.ts -t "discontinuous"`

### TASK-031: Grouped X-Cycle
- **Status**: pending
- **Dependencies**: TASK-017
- **Description**: Add `grouped-x-cycle.ts`: extension of X-Cycle where some "nodes" are groups of cells (two or three cells in the same row/col within a box) treated as a unit. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/grouped-x-cycle.test.ts`

### TASK-032: 3D Medusa
- **Status**: pending
- **Dependencies**: TASK-024
- **Description**: Add `medusa-3d.ts`: extends coloring across multiple digits. Color bivalue cells and bivalue houses simultaneously; conflicts within a color invalidate it. Eliminate accordingly. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/medusa-3d.test.ts`

### TASK-033: Death Blossom
- **Status**: pending
- **Dependencies**: TASK-025
- **Description**: Add `death-blossom.ts`: a "stem" cell with N candidates, each linked to an ALS where placing that candidate would force a digit Z out of the ALS. Z is eliminated from cells seeing all Z-candidates across the petal ALSes. Reuses ALS detector from TASK-025. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/death-blossom.test.ts`

### TASK-034: Forcing Chains
- **Status**: pending
- **Dependencies**: TASK-023
- **Description**: Add `forcing-chains.ts`: pick a cell with N candidates; for each candidate, follow logical implications. If all branches eliminate the same digit elsewhere or place the same digit in the same cell, that elimination/placement is forced. Cap chain depth to a reasonable limit (e.g. 50 implications) to bound runtime. Fixture + tests.
- **Verification**: `npx vitest run src/engine/solver/techniques/forcing-chains.test.ts`

---

## Phase 3: Solver and rater integration

### TASK-035: Wire new techniques into rate.ts internal solver
- **Status**: pending
- **Dependencies**: TASK-007, TASK-008, TASK-009, TASK-010, TASK-011, TASK-012, TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019, TASK-020, TASK-021, TASK-022, TASK-023, TASK-024, TASK-025, TASK-026, TASK-027, TASK-028, TASK-029, TASK-030, TASK-031, TASK-032, TASK-033, TASK-034
- **Description**: Extend the `rate()` function's solver loop in `rate.ts` to call each new finder in increasing-difficulty order (Hidden Pair → Hidden Triple → Naked Quad → Hidden Quad → Swordfish → ... → Forcing Chains). Each branch calls `noteTechnique(id)` and either places a digit via `placeDigit` or applies eliminations via `applyEliminations`. Solver still restarts at Naked Single on any progress.
- **Verification**: `npx vitest run src/engine/generator/rate.test.ts`

### TASK-036: Register new techniques in techniques/index.ts
- **Status**: pending
- **Dependencies**: TASK-035
- **Description**: Update `src/engine/solver/techniques/index.ts` to import all new techniques and add them to the `nextStep` cascade in difficulty order. Update the exported technique-list array (used elsewhere) accordingly. Update `index.test.ts` to assert that nextStep applies them in correct order.
- **Verification**: `npx vitest run src/engine/solver/techniques/index.test.ts`

### TASK-037: Add rate.test.ts fixtures for new tiers
- **Status**: pending
- **Dependencies**: TASK-035
- **Description**: Extend `rate.test.ts` with hand-authored Classic 9×9 puzzles for each new tier (Master, Diabolical, Demonic, Nightmare). Each fixture should be solvable using a technique from that tier as its hardest step, and not solvable with anything easier. Assert `rate(p).difficulty === expectedTier`.
- **Verification**: `npx vitest run src/engine/generator/rate.test.ts -t "Master|Diabolical|Demonic|Nightmare"`

---

## Phase 4: Generator changes

### TASK-038: Strict tier rule in generate-for-difficulty
- **Status**: pending
- **Dependencies**: TASK-035
- **Description**: In `src/engine/generator/generate-for-difficulty.ts`, change the acceptance test so generated puzzles are accepted only when `rate(p).difficulty === target` (exact match). Reject and retry otherwise.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts -t "exact tier"`

### TASK-039: Retry cap and hard timeout
- **Status**: pending
- **Dependencies**: TASK-038
- **Description**: Update `generateForDifficulty` to enforce a maximum of 50 attempts AND a 60-second wall-clock timeout (whichever first). On budget exhaustion, return a structured `GenerationFailed` result containing closest tier produced (if any), attempt count, and elapsed time. Update tests to use a short timeout for the failure case.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts -t "timeout|attempts"`

### TASK-040: Progress callback support
- **Status**: pending
- **Dependencies**: TASK-039
- **Description**: Extend `generateForDifficulty` (or a new `generateForDifficultyWithProgress`) to accept an optional `onProgress({ attempt, max })` callback called after each rejected attempt. Used by the worker wrapper for progress events.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts -t "progress"`

---

## Phase 5: Web Worker

### TASK-041: Generator Web Worker entry point
- **Status**: pending
- **Dependencies**: TASK-040
- **Description**: Create `src/workers/generator.worker.ts` exporting a worker that handles `{ type: 'generate', variantId, difficulty }` messages. Resolves the variant via the variant registry, calls `generateForDifficulty` with a progress callback that posts `{ type: 'progress', attempt, max }` messages, and posts a terminal `{ type: 'done', puzzle, rating }` or `{ type: 'failed', closestRating, attempts, elapsedMs }`. Handle one request at a time.
- **Verification**: `npx tsc --noEmit src/workers/generator.worker.ts`

### TASK-042: Generator worker client wrapper
- **Status**: pending
- **Dependencies**: TASK-041
- **Description**: Create `src/workers/generator-client.ts` exporting `generateInWorker(variant, difficulty)` returning `{ promise: Promise<GenResult>, cancel: () => void, onProgress: (cb) => void }`. Internally instantiates the worker, wires up the messaging, supports cancel via `worker.terminate()`. Add `generator-client.test.ts` using a fake worker (mocked Worker class with a queue of messages).
- **Verification**: `npx vitest run src/workers/generator-client.test.ts`

### TASK-043: Game store async newGame integration
- **Status**: pending
- **Dependencies**: TASK-042
- **Description**: Make `newGame(variant, difficulty)` in `src/store/game.ts` async. Set `loading: true`, call `generateInWorker`, on `done` populate the board and set `loading: false`. On `failed`, set `loading: false` and surface `generationFailure` state for the UI to render. Add a `cancelGeneration()` action that calls the worker's cancel and clears loading. Update existing tests of `newGame` to await the action.
- **Verification**: `npx vitest run src/store/game.test.ts`

---

## Phase 6: Loading UX

### TASK-044: Loading overlay component
- **Status**: pending
- **Dependencies**: TASK-043
- **Description**: Create `src/components/LoadingOverlay.tsx` rendering a full-screen overlay with the same blurred-grid styling as the existing pause overlay (reuse those styles or extract a shared `BlurOverlay` component). Centers a CSS spinner. Accepts `visible: boolean` prop. No text.
- **Verification**: `npx vitest run src/components/LoadingOverlay.test.tsx`

### TASK-045: 200ms debounce wiring
- **Status**: pending
- **Dependencies**: TASK-044
- **Description**: In `src/screens/Game.tsx`, render `<LoadingOverlay>` driven by the game store's `loading` flag, but only after a 200ms debounce so quick generations don't flash an overlay. Use a small hook `useDebouncedFlag(value, ms)`.
- **Verification**: `npx vitest run src/screens/Game.test.tsx -t "loading"`

### TASK-046: Cancel button + 10s threshold
- **Status**: pending
- **Dependencies**: TASK-045
- **Description**: Extend `LoadingOverlay` (or compose a sibling component) so that after 10 seconds of continuous visibility, a Cancel button and the note "Higher difficulties can take longer to generate." fade in below the spinner. Cancel calls `cancelGeneration()` and navigates to Home. Test asserts the button is hidden initially and visible after 10s (using fake timers).
- **Verification**: `npx vitest run src/components/LoadingOverlay.test.tsx -t "cancel|10s"`

### TASK-047: Generation-failure fallback dialog
- **Status**: pending
- **Dependencies**: TASK-043
- **Description**: Create `src/components/GenerationFailedDialog.tsx` that renders when game store's `generationFailure` is set. Heading mentions the target tier (e.g. "Couldn't find a Demonic puzzle in time."), body text explains briefly, three actions: Try again (re-runs same target), Try [next-easier-tier] (only if one exists), Cancel (returns to Home). Wire into `Game.tsx`.
- **Verification**: `npx vitest run src/components/GenerationFailedDialog.test.tsx`

---

## Phase 7: Variant-aware difficulty picker

### TASK-048: Home difficulty picker per variant
- **Status**: pending
- **Dependencies**: TASK-003
- **Description**: Update `src/screens/Home.tsx` to use `availableTiers(variant)` to render only the difficulty buttons supported by the currently-selected variant. Switching variants updates the visible tier set; if the previously-selected tier is no longer available, fall back to the highest available. Update `Home.test.tsx` to cover Mini/Six/Classic showing the right tier counts.
- **Verification**: `npx vitest run src/screens/Home.test.tsx`

### TASK-049: Difficulty badge styling for new tiers
- **Status**: pending
- **Dependencies**: TASK-001
- **Description**: Add visual styles for the 4 new tier badges (Master, Diabolical, Demonic, Nightmare) wherever the difficulty is shown (Home resume cards, Game header, Stats screen, WinModal). Use a colour ramp that visually escalates (e.g. deepening reds/purples through Nightmare). Update any snapshot or visual-regression tests.
- **Verification**: `npx vitest run src/components/DifficultyBadge.test.tsx` (create if it doesn't exist)

### TASK-050: Stats screen 8-tier layout
- **Status**: pending
- **Dependencies**: TASK-001, TASK-003
- **Description**: Update `src/screens/Stats.tsx` to render columns/rows for all available tiers per variant (use `availableTiers(variant)`). Mini shows 3 columns, Six 6, Classic 8. Empty cells (no completions yet) render gracefully. Update tests.
- **Verification**: `npx vitest run src/screens/Stats.test.tsx`

---

## Phase 8: Save versioning

### TASK-051: Bump save schema to v2 with appVersion stamp
- **Status**: pending
- **Dependencies**: TASK-004
- **Description**: In `src/store/save.ts`, change the persistence key from `sudoku.save.v1` to `sudoku.save.v2`. Extend the persisted state shape to include `appVersion: string` populated from `__APP_VERSION__` at write time. Existing v1 entries are silently dropped on first load (existing schema-mismatch behaviour). Update `save.test.ts` for the new key and the appVersion stamp.
- **Verification**: `npx vitest run src/store/save.test.ts`

### TASK-052: Bump stats schema to v2 with appVersion stamp
- **Status**: pending
- **Dependencies**: TASK-004
- **Description**: Same treatment for `src/store/stats.ts` — `sudoku.stats.v1` → `sudoku.stats.v2`, add `appVersion` stamp. Initialise tier-keyed records to include the new tier names so the Stats screen has stable shape. Update `stats.test.ts`.
- **Verification**: `npx vitest run src/store/stats.test.ts`

### TASK-053: Settings schema appVersion stamp
- **Status**: pending
- **Dependencies**: TASK-004
- **Description**: For consistency, also bump `sudoku.settings.v1` to v2 with an `appVersion` stamp. Old settings discarded on schema mismatch (acceptable — user just re-picks theme). Update `settings.test.ts`.
- **Verification**: `npx vitest run src/store/settings.test.ts`

---

## Phase 9: Techniques help section

### TASK-054: Techniques screen index
- **Status**: pending
- **Dependencies**: TASK-036
- **Description**: Create `src/screens/Techniques.tsx` rendering an index of all 34 techniques grouped by tier. Each row shows technique name + tier badge and links to a detail page. Pull the technique list from a single source of truth (e.g. a `TECHNIQUE_CATALOG` constant under `src/engine/solver/techniques/catalog.ts` mapping technique id → display name + tier). Add `Techniques.test.tsx` asserting all 34 are rendered.
- **Verification**: `npx vitest run src/screens/Techniques.test.tsx`

### TASK-055: Technique detail page component
- **Status**: pending
- **Dependencies**: TASK-054
- **Description**: Create `src/screens/TechniqueDetail.tsx` rendering the detail page for a single technique (selected via route param). Loads the fixture, shows description, tier badge, and embeds the `Board` component with the fixture's board state. Three walkthrough buttons (Highlight pattern / Show deduction / Apply) and a Reset button. Walkthrough state is local (not in the game store). Test the three steps advance correctly.
- **Verification**: `npx vitest run src/screens/TechniqueDetail.test.tsx`

### TASK-056: Technique catalog wiring
- **Status**: pending
- **Dependencies**: TASK-054
- **Description**: In `src/engine/solver/techniques/catalog.ts`, define `TECHNIQUE_CATALOG: Record<TechniqueId, { displayName: string; tier: Difficulty; fixture: TechniqueFixture; description: string }>` importing each technique's fixture file. This is the single source of truth used by the index, the detail page, and the hint Learn-more link. Add a test that asserts every TechniqueId in `TECHNIQUE_TIER` has a catalog entry.
- **Verification**: `npx vitest run src/engine/solver/techniques/catalog.test.ts`

### TASK-057: Bottom tab bar Learn entry
- **Status**: pending
- **Dependencies**: TASK-054
- **Description**: Add a "Learn" entry to the bottom tab bar / navigation alongside Home, Stats, Settings. Wires routing to `Techniques.tsx`. Update navigation tests if any.
- **Verification**: `npx vitest run src/App.test.tsx -t "Learn"`

### TASK-058: Hint "Learn more" link
- **Status**: pending
- **Dependencies**: TASK-056, TASK-057
- **Description**: Update `src/components/Hint.tsx` so when a hint is shown, a "Learn more about [technique name] →" link appears below the explanation. Clicking navigates to the matching technique's detail page (using the route from TASK-057). Update `Hint.test.tsx` to assert the link is present and navigates to the right route.
- **Verification**: `npx vitest run src/components/Hint.test.tsx -t "learn more"`

---

## Phase 10: E2E tests

### TASK-059: E2E — generate Demonic, observe spinner and cancel
- **Status**: pending
- **Dependencies**: TASK-046, TASK-048
- **Description**: Add `tests/e2e/difficulty-loading.spec.ts`. Navigate to Home, pick Classic + Demonic, click New Game. Assert the loading overlay appears (blurred grid + spinner). Wait at least 10 seconds (or reduce thresholds in test config) and assert the Cancel button appears. Click Cancel and assert return to Home. Use generous Playwright timeouts since the test waits on real generation.
- **Verification**: `npx playwright test tests/e2e/difficulty-loading.spec.ts`

### TASK-060: E2E — Learn tab walkthrough
- **Status**: pending
- **Dependencies**: TASK-055, TASK-057
- **Description**: Add `tests/e2e/techniques-help.spec.ts`. Navigate to the Learn tab, click into Hidden Single, step through the three walkthrough buttons, click Reset, return to the index. Assert each walkthrough step changes the visible board state.
- **Verification**: `npx playwright test tests/e2e/techniques-help.spec.ts`

### TASK-061: E2E — Hint Learn-more navigates correctly
- **Status**: pending
- **Dependencies**: TASK-058
- **Description**: Add `tests/e2e/hint-learn-more.spec.ts`. Start a Classic Easy game (fast generation), click the Hint button, click "Learn more about Naked Single →", assert the URL/screen reflects the Naked Single detail page.
- **Verification**: `npx playwright test tests/e2e/hint-learn-more.spec.ts`

### TASK-062: E2E — Difficulty picker hides infeasible tiers
- **Status**: pending
- **Dependencies**: TASK-048
- **Description**: Add `tests/e2e/variant-tier-caps.spec.ts`. Switch variant on Home and assert the visible difficulty buttons match the variant cap (Mini: 3, Six: 6, Classic: 8). No "Master+" button visible on Mini.
- **Verification**: `npx playwright test tests/e2e/variant-tier-caps.spec.ts`

---

## Phase 11: Final verification

### TASK-063: Full unit-test sweep
- **Status**: pending
- **Dependencies**: TASK-058
- **Description**: Run the full Vitest suite to confirm no regressions across foundation, techniques, generator, store, and components. Fix any issues surfaced.
- **Verification**: `npx vitest run`

### TASK-064: Full build + type check
- **Status**: pending
- **Dependencies**: TASK-063
- **Description**: Run `tsc --noEmit` over the whole project and `npm run build`. Confirm no type errors and a clean production build. Inspect the bundle size — the Web Worker should be a separate chunk.
- **Verification**: `npm run build`

### TASK-065: Full E2E sweep
- **Status**: pending
- **Dependencies**: TASK-062, TASK-064
- **Description**: Run the full Playwright suite (existing v1 specs + new ones) to confirm no regressions.
- **Verification**: `npx playwright test`
