# Sudoku PWA — Iteration 3 Tasks

These tasks implement `.devloop/requirements.md`. Each task references
the requirements section that motivates it. Tasks are ordered so that
dependent work follows its prerequisites; a few independent tracks
(matrix E2E setup, PWA update, save schema) can run in parallel once
their early prerequisites land.

---

### TASK-001: Bump app version to 0.3.0
- **Status**: done
- **Dependencies**: none
- **Description**: Bump `package.json` version to `0.3.0` so new save/stats/settings records carry the iteration 3 `appVersion` stamp. See requirements §11.
- **Verification**: `node -p "require('./package.json').version"` prints `0.3.0`.

### TASK-002: Add per-attempt try/catch in generateForDifficulty
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/engine/generator/generate-for-difficulty.ts`, wrap each `generate()` + `rate()` pair inside the retry loop in `try/catch`. On exception: count the attempt, store the error message (and any technique id available) on a closure-scoped `lastError` variable, and continue. Add `lastError?: string` to the `GenerationFailed` interface and include it in the returned object. See requirements §4.1.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts` passes.

### TASK-003: Test that exception in rate is contained per attempt
- **Status**: done
- **Dependencies**: TASK-002
- **Description**: Add a Vitest case to `src/engine/generator/generate-for-difficulty.test.ts` that monkey-patches `rate` (or supplies a fake) to throw on attempt 1 and succeed on attempt 2; assert the function returns `kind: 'success'` and the test does not throw. Add a second case where every attempt throws; assert `kind: 'failed'` with `attempts === maxRetries` and `lastError` populated. See requirements §4.1.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts` passes including the two new cases.

### TASK-004: Surface lastError through worker
- **Status**: done
- **Dependencies**: TASK-002
- **Description**: In `src/workers/generator.worker.ts`, add `lastError?: string` to the `FailedMessage` interface. When `generateForDifficulty` returns `kind: 'failed'`, copy `result.lastError` onto the posted `failed` message. Also `console.warn` every caught exception inside the worker's outer try/catch with the message and stack so a developer running locally can identify the offender. See requirements §4.1.
- **Verification**: `npx vitest run src/workers/generator-client.test.ts` passes (FakeWorker tests still green).

### TASK-005: Propagate lastError to GeneratorFailure result
- **Status**: pending
- **Dependencies**: TASK-004
- **Description**: In `src/workers/generator-client.ts`, add `lastError?: string` to the `GeneratorFailure` interface. The message handler for `failed` should copy it into the resolved result. See requirements §4.1.
- **Verification**: `npx vitest run src/workers/generator-client.test.ts` passes.

### TASK-006: Plumb lastError into GenerationFailure store state
- **Status**: pending
- **Dependencies**: TASK-005
- **Description**: In `src/store/game.ts`, add `lastError?: string` to the `GenerationFailure` interface and copy it across in the failure-handling branch of `newGame`. See requirements §4.1.
- **Verification**: `npx vitest run src/store/game.test.ts` passes.

### TASK-007: Render lastError in GenerationFailedDialog
- **Status**: pending
- **Dependencies**: TASK-006
- **Description**: In `src/components/GenerationFailedDialog.tsx`, when the `failure.lastError` is non-empty render a small muted technical-details line below the existing buttons (e.g. `<p data-testid="failure-last-error" className="text-xs opacity-70 mt-2 break-words">`). Always visible — no toggle. See requirements §4.1, §10.
- **Verification**: `npx vitest run src/components/GenerationFailedDialog.test.tsx` passes including a new case asserting `lastError` is rendered when present and not rendered when null.

### TASK-008: Fix silent-skip in rate.ts extended chain
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/engine/generator/rate.ts`, for each extended-chain finder block (lines ~681–940), add a `console.warn` call when the finder returns non-null but `applyEliminations` returns false. No need to dedupe across finder invocations — rating is short-lived and warning spam during a test run is acceptable. Existing fall-through behaviour is preserved. See requirements §4.4.
- **Verification**: `npx vitest run src/engine/generator/rate.test.ts` passes.

### TASK-009: Remove Expert fallback in rate
- **Status**: done
- **Dependencies**: TASK-008
- **Description**: In `src/engine/generator/rate.ts`, change the post-loop logic so `difficulty` is set to `hardestTier` regardless of whether the cascade finished. The `solved` flag (already in `RateResult`) is the authoritative signal for "fully solved by cascade". Update the JSDoc on `rate()` to reflect this. The existing `rate.test.ts` cases that asserted `difficulty === 'Expert'` for stalled puzzles will fail after this change — that is expected and is repaired in TASK-010. See requirements §4.4.
- **Verification**: `npx tsc --noEmit` exits zero (the change compiles cleanly). Test-pass verification is delegated to TASK-010, which lands in the same commit chain immediately after.

### TASK-010: Update rate.test fixtures for solved-flag semantics
- **Status**: pending
- **Dependencies**: TASK-009
- **Description**: Update `src/engine/generator/rate.test.ts` cases that previously asserted `difficulty === 'Expert'` for cascade-stalled puzzles to instead assert `solved === false`. Add at least one new case that supplies a puzzle whose cascade stalls and whose hardest fired technique is below Expert; assert the rated difficulty matches that lower tier and `solved === false`. See requirements §4.4.
- **Verification**: `npx vitest run src/engine/generator/rate.test.ts` passes.

### TASK-011: Reject unsolved puzzles in generateForDifficulty
- **Status**: pending
- **Dependencies**: TASK-009, TASK-010
- **Description**: In `src/engine/generator/generate-for-difficulty.ts`, after rating each generated puzzle, treat `rating.solved === false` as an automatic rejection regardless of difficulty match. The puzzle still counts toward the attempt budget and contributes to `closestRating` only if `solved`. See requirements §4.4.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts` passes including a new case that asserts an unsolved-rating puzzle is rejected even when its `difficulty` field matches the target.

### TASK-012: Reconcile cascade order with catalog
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/engine/solver/techniques/index.ts`, reorder the `techniques[]` cascade entries so the order matches `src/engine/solver/techniques/catalog.ts`'s `TECHNIQUE_ORDER`. Update the explanatory comment to declare the catalog as canonical. The rater's order in `rate.ts` is independent and stays as today. See requirements §4.4.
- **Verification**: `npx vitest run src/engine/solver/techniques/index.test.ts` passes (or existing equivalent test file). Add an assertion if no test currently locks the order: `expect(techniques.map(t => t.id)).toEqual(TECHNIQUE_ORDER)`.

### TASK-013: Add fuzz harness for technique finders
- **Status**: done
- **Dependencies**: none
- **Description**: Create `src/engine/solver/techniques/fuzz.test.ts`. For each finder in the 27-technique chain, run it against a bounded set of randomly-reduced boards across `classic`, `mini`, `six` (e.g. 50 boards per variant per finder). Use a deterministic seed based on the finder's id and variant for reproducibility. Assert no finder throws. On failure, print variant id, seed, finder id, and the reduced board's serialized form. Use a small per-test budget so the harness stays inside Vitest's timeout. See requirements §4.2.
- **Verification**: The test file exists at the named path and is runnable via `npx vitest run src/engine/solver/techniques/fuzz.test.ts`. If all finders are clean the test passes immediately and TASK-014a/b/c can be marked no-op. If any finder throws, the test fails with a reproducible seed printed in the failure message — that output is consumed by TASK-014a. The fuzz harness is "green" only after TASK-014c lands; this task creates the harness, it does not gate-on its passing.

### TASK-014a: Triage fuzz failures and fix first throwing finder
- **Status**: done
- **Dependencies**: TASK-013
- **Description**: Run the fuzz harness, identify the first finder that throws, fix the root cause (typically: degenerate-grid handling, off-by-one on box dimensions, assumption that `variant.size === 9`). Add a regression fixture to that finder's existing `<name>.test.ts` reproducing the failure. If no finders throw, mark this task and TASK-014b/c complete with a note. See requirements §4.2.
- **Verification**: `npx vitest run src/engine/solver/techniques/<fixed-name>.test.ts` passes the new regression case; `npx vitest run src/engine/solver/techniques/fuzz.test.ts` no longer reports that finder.

### TASK-014b: Fix second throwing finder if any
- **Status**: pending
- **Dependencies**: TASK-014a
- **Description**: Repeat TASK-014a for the next throwing finder. Same pattern.
- **Verification**: same pattern as TASK-014a.

### TASK-014c: Green the fuzz harness across all variants
- **Status**: pending
- **Dependencies**: TASK-014b
- **Description**: Run the fuzz harness, fix every remaining throwing finder, and add a regression fixture per finder to the corresponding `<name>.test.ts`. If more than one finder remains throwing after TASK-014b, do not balloon this task — split into additional sub-tasks (TASK-014d, TASK-014e, …) during execution, one per throwing finder, and treat this task as the final "green-the-harness" gate that lands once everything else is fixed. See requirements §4.2.
- **Verification**: `npx vitest run src/engine/solver/techniques/fuzz.test.ts` passes with zero failures across `classic`, `mini`, and `six`.

### TASK-015: Add maxClues hint plumbing in generate
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/engine/generator/generate.ts`, add an optional `maxClues?: number` to `GenerateOptions`. When supplied, the clue-removal loop refuses to remove a clue that would push the puzzle below `maxClues`. Update the JSDoc on `GenerateOptions`. See requirements §4.3.
- **Verification**: `npx vitest run src/engine/generator/generate.test.ts` passes including a new case asserting clue count after generation is `>= maxClues`.

### TASK-016: Add per-tier attempt budgets
- **Status**: pending
- **Dependencies**: TASK-002
- **Description**: In `src/engine/generator/generate-for-difficulty.ts`, replace the single `DEFAULT_MAX_ATTEMPTS` constant with a per-tier table: `Easy/Medium = 50`, `Hard/Expert/Master = 100`, `Diabolical/Demonic/Nightmare = 50`. The per-call default is now derived from the target tier. `options.maxRetries` continues to override. Wall-clock cap is unchanged at 60s. See requirements §4.3.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts` passes including a new case asserting Hard/Expert/Master use 100 attempts by default.

### TASK-017: Wire upper clue-bounds hint for mid-range tiers
- **Status**: pending
- **Dependencies**: TASK-015, TASK-016
- **Description**: In `src/engine/generator/generate-for-difficulty.ts`, after `clueBoundsLowerForTier`, also extract the upper bound from `CLUE_BOUNDS[variantId][tier][1]` and pass it as `maxClues` to `generate()`. The bound is advisory — if no entry exists, no `maxClues` is passed. The dependency on TASK-016 is sequencing-only: both tasks edit `generate-for-difficulty.ts`, so doing them in order avoids a merge conflict. See requirements §4.3.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts` passes.

### TASK-018: Drop sm:hidden on bottom tab bar
- **Status**: pending
- **Dependencies**: none
- **Description**: In `src/App.tsx`, on the `<nav data-testid="tab-bar">` element (currently around line 138), change `className="fixed bottom-0 inset-x-0 flex sm:hidden"` to `className="fixed bottom-0 inset-x-0 flex"`. The bottom tab bar now shows on every viewport. There is no existing `App.test.tsx` to run against, so regression coverage for this change is provided by TASK-044 (E2E desktop nav). See requirements §7.
- **Verification**: `npx tsc --noEmit` exits zero. Manual smoke: `npm run dev`, open at a desktop viewport (≥640 px wide), assert the tab bar is visible. Automated regression coverage lands with TASK-044.

### TASK-019: Create reusable ConfirmDialog component
- **Status**: pending
- **Dependencies**: none
- **Description**: Create `src/components/ConfirmDialog.tsx` exporting `<ConfirmDialog>` with props `{ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }`. Style follows the existing `GenerationFailedDialog` (backdrop overlay, card, primary/secondary buttons). Uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Test ids: `confirm-dialog`, `confirm-dialog-confirm`, `confirm-dialog-cancel`. Defer focus management to TASK-038. See requirements §5.4.
- **Verification**: `npx vitest run src/components/ConfirmDialog.test.tsx` passes — covers render with open=true/false, click handlers fire correctly.

### TASK-020: Define save schema v3 storage shape
- **Status**: pending
- **Dependencies**: none
- **Description**: In `src/store/save.ts`, change `SAVE_STORAGE_KEY` from `sudoku.save.v2` to `sudoku.save.v3`, `SAVE_SCHEMA_VERSION` to 3. Add a `slotKey(variantId, difficulty)` helper that returns `${variantId}:${difficultySlug}`. Internal `saves` map stays a `Record<string, SavedGame>` but is now keyed by slot. Update `loadSaveFile` to skip mismatched versions (existing pattern). The existing tests in `save.test.ts` use the v2-keyed signatures and will fail after this change — that is expected and is repaired in TASK-021. See requirements §5.1.
- **Verification**: `npx tsc --noEmit` exits zero (the change compiles cleanly). Test-pass verification is delegated to TASK-021, which lands in the same commit chain immediately after.

### TASK-021: Update save helpers to (variant, difficulty) signatures
- **Status**: pending
- **Dependencies**: TASK-020
- **Description**: Update `getSavedGame`, `clearSavedGame`, `hasSavedGame` in `src/store/save.ts` to accept `(variantId, difficulty)` and operate on the slot key. `putSavedGame(saved)` derives the slot from `saved.variant + saved.difficulty`. Add `listSavedGames(): SavedGame[]` returning all slots sorted by `savedAt` descending. Update existing tests in `save.test.ts` to use the new signatures. See requirements §5.1.
- **Verification**: `npx vitest run src/store/save.test.ts` passes.

### TASK-022: Bump stats schema to v3
- **Status**: pending
- **Dependencies**: none
- **Description**: In `src/store/stats.ts`, bump the storage key from `sudoku.stats.v2` to `sudoku.stats.v3` and `SCHEMA_VERSION` to 3. No structural change beyond the key bump and a fresh `appVersion` stamp at write time. Update existing tests. See requirements §5.1.
- **Verification**: `npx vitest run src/store/stats.test.ts` passes.

### TASK-023: Bump settings schema to v3
- **Status**: pending
- **Dependencies**: none
- **Description**: In `src/store/settings.ts`, bump the storage key from `sudoku.settings.v2` to `sudoku.settings.v3` and `SCHEMA_VERSION` to 3. No structural change. Update existing tests. See requirements §5.1.
- **Verification**: `npx vitest run src/store/settings.test.ts` passes.

### TASK-024: Update game store to per-(variant, difficulty) saves
- **Status**: pending
- **Dependencies**: TASK-021
- **Description**: In `src/store/game.ts`, update `newGame` to call `putSavedGame` with the new slot semantics; update `resumeSavedGame(variantId, difficulty)` to accept the difficulty and load via `getSavedGame(variantId, difficulty)`; update `completeGame()` to clear only the current slot via `clearSavedGame(board.variant.id, difficulty)`; update `saveCurrent()` similarly. The existing tests in `game.test.ts` use the per-variant signatures and will fail after this change — that is expected and is repaired in TASK-025. See requirements §5.2.
- **Verification**: `npx tsc --noEmit` exits zero (the change compiles cleanly). Test-pass verification is delegated to TASK-025, which lands in the same commit chain immediately after.

### TASK-025: Update game store tests for slot signatures
- **Status**: pending
- **Dependencies**: TASK-024
- **Description**: Update `src/store/game.test.ts` cases that exercise resume/complete/save flows to pass difficulty alongside variant. Add a new test asserting two simultaneous saves for the same variant but different difficulties coexist after `newGame` is called for a third (variant, difficulty) collision. See requirements §5.2.
- **Verification**: `npx vitest run src/store/game.test.ts` passes.

### TASK-026: Resume list — list all slots, sorted, with timestamp
- **Status**: pending
- **Dependencies**: TASK-021
- **Description**: In `src/screens/Home.tsx`, replace the `getSavedGameImpl` per-variant filter with a call to `listSavedGames()` (sorted by `savedAt` desc by helper). Render one card per slot. Each card shows variant label, `DifficultyBadge`, elapsed time, and a `savedAt` timestamp formatted as `YYYY-MM-DD HH:MM:SS` in local time. Test ids: `home-resume-${variantId}-${difficultySlug}` (variant + difficulty), with `-elapsed`, `-difficulty`, `-saved-at` sub-ids on the card. See requirements §5.3.
- **Verification**: `npx vitest run src/screens/Home.test.tsx` passes including a new case asserting two saves for the same variant render as two cards in `savedAt` desc order.

### TASK-027: Replace window.confirm with ConfirmDialog in Home
- **Status**: pending
- **Dependencies**: TASK-019, TASK-021
- **Description**: In `src/screens/Home.tsx`, remove the `confirmReplace` prop and the `window.confirm` call. Add local state `replaceDialog: { open, variantId, difficulty } | null`. When `handleNewGame` finds an existing slot, set the dialog state instead of confirming inline; render `<ConfirmDialog>` with the title "Replace existing game?" and a body that names the variant + difficulty + elapsed + savedAt. Confirm calls `newGame` and navigates; cancel closes the dialog. Update the existing `Home.test.tsx` cases that supplied `confirmReplace` to drive the dialog through DOM clicks. See requirements §5.4.
- **Verification**: `npx vitest run src/screens/Home.test.tsx` passes.

### TASK-028: Migration detector for old localStorage keys
- **Status**: pending
- **Dependencies**: none
- **Description**: Create `src/store/migration.ts` exporting `hasOldSaves(storage?: Storage): boolean` and `removeOldSaves(storage?: Storage): void`. The detector enumerates `localStorage` keys and returns true iff any matches `^sudoku\.(save|stats|settings)\.v[12]$`. The remover deletes every matching key. See requirements §5.5.
- **Verification**: `npx vitest run src/store/migration.test.ts` passes — covers detection of mixed v1/v2 entries, no-op when only v3 entries, and removal correctness.

### TASK-029: First-load migration prompt in App
- **Status**: pending
- **Dependencies**: TASK-019, TASK-028
- **Description**: In `src/App.tsx`, on mount call `hasOldSaves()`. Hold result in state plus a session-only `dismissed` flag. When `hasOldSaves && !dismissed`, render `<ConfirmDialog>` over the app shell with the copy from requirements §5.5. **Remove now** triggers `removeOldSaves()` then sets `hasOldSaves` to false. **Decide later** sets `dismissed=true` (in memory only). See requirements §5.5.
- **Verification**: `npx vitest run src/App.test.tsx` passes including new cases for both buttons.

### TASK-030: Settings — Storage section with Remove old saves button
- **Status**: pending
- **Dependencies**: TASK-019, TASK-028
- **Description**: In `src/screens/Settings.tsx`, add a "Storage" section that is conditionally rendered when `hasOldSaves()` is true. Section contains a button labelled "Remove old saves" that opens a `<ConfirmDialog>` with copy "Remove all old saves now?". Confirm calls `removeOldSaves()` and the section disappears. See requirements §5.5.
- **Verification**: `npx vitest run src/screens/Settings.test.tsx` passes including a new case that seeds a v2 key, asserts the section appears, clicks the button, and asserts the section disappears.

### TASK-031: Stats screen — per-variant tier filter pills
- **Status**: pending
- **Dependencies**: none
- **Description**: In `src/screens/Stats.tsx`, above each variant's table render a row of pill buttons: **All** + each tier in `availableTiers(variant)`. Local `useState` per variant section; default `All`. When a tier is selected, the table renders only that tier's column. Test ids: `stats-filter-${variantId}-all` and `stats-filter-${variantId}-${slug}`. State does not persist across visits. See requirements §6.
- **Verification**: `npx vitest run src/screens/Stats.test.tsx` passes including a new case that clicks a tier pill and asserts only that column is rendered.

### TASK-032: Periodic update poll in usePwaUpdate
- **Status**: pending
- **Dependencies**: none
- **Description**: In `src/pwa/useUpdate.ts`, pass an `onRegisteredSW(swUrl, r)` to `registerSW` that does `setInterval(() => r?.update(), 60_000)`. Capture the interval id and clear it on hook unmount. See requirements §8.
- **Verification**: `npx vitest run src/pwa/useUpdate.test.ts` passes including a new case using fake timers that asserts `update()` is called after 60s.

### TASK-033: Visibility-driven update check
- **Status**: pending
- **Dependencies**: TASK-032
- **Description**: In `src/pwa/useUpdate.ts`, register a `visibilitychange` listener that, when `document.visibilityState === 'visible'`, calls `r?.update()`. Remove the listener on unmount. See requirements §8.
- **Verification**: `npx vitest run src/pwa/useUpdate.test.ts` passes including a case that dispatches a `visibilitychange` event and asserts `update()` was called.

### TASK-034: Expose checkForUpdates from usePwaUpdate
- **Status**: pending
- **Dependencies**: TASK-032
- **Description**: In `src/pwa/useUpdate.ts`, expose a `checkForUpdates: () => Promise<'updated' | 'idle' | 'error'>` callback that calls `r?.update()` and resolves once the call completes. The result distinguishes whether `onNeedRefresh` fired during the check. See requirements §8.
- **Verification**: `npx vitest run src/pwa/useUpdate.test.ts` passes including a case asserting the resolved status values for each scenario.

### TASK-035: Settings — Updates section with Check for updates button
- **Status**: pending
- **Dependencies**: TASK-034
- **Description**: In `src/screens/Settings.tsx`, add an "Updates" section with a single button. Label cycles based on the resolved status from `checkForUpdates`:
  - **Check for updates** (idle, default) → **Checking…** (while the promise is in flight) →
  - On `'idle'`: **Up to date** for ~2 s, then revert to **Check for updates**.
  - On `'updated'`: no special button text — the existing `<update-banner>` at the top of the app shell handles user-facing notification.
  - On `'error'` (e.g. offline, fetch failure): **Couldn't check — try again** for ~2 s, then revert to **Check for updates**.
  Test ids: `settings-check-updates` on the button. See requirements §8.
- **Verification**: `npx vitest run src/screens/Settings.test.tsx` passes including new cases for each of the three result states (`'idle'`, `'updated'`, `'error'`).

### TASK-036: Slow-generate test hatch — request payload + main-thread plumbing
- **Status**: pending
- **Dependencies**: TASK-004, TASK-005
- **Description**: The hatch must flow page → main thread → worker; a Web Worker's `self.location` is the worker file URL, not the page URL, so the worker cannot read the query string itself. Implementation:
  1. In `src/workers/generator.worker.ts`, extend `GenerateRequest` with an optional `slowGenerateMs?: number`. On receipt, when the field is a positive integer, `await new Promise(r => setTimeout(r, slowGenerateMs))` once **before** invoking `generateForDifficulty`. Field is silently ignored otherwise.
  2. In `src/workers/generator-client.ts` (or wherever `postMessage({ type: 'generate', ... })` is composed), add a guarded read: `if (import.meta.env.DEV) { const m = /[?&]slowGenerate=(\d+)/.exec(window.location.search); if (m) request.slowGenerateMs = Number(m[1]); }`. Production builds strip the branch.
  3. Document the hatch in a top-of-file comment in both files naming `tests/e2e/difficulty-loading.spec.ts` as the consumer.
  See requirements §9.3.
- **Verification**: `npx vitest run src/workers/generator-client.test.ts` passes (FakeWorker tests unaffected — they construct requests without the field). Manual: `npm run dev`, open `http://localhost:5179/?slowGenerate=2000`, click New Game, observe the overlay is held visible for ≥2 s before the board renders.

### TASK-037: Re-enable difficulty-loading.spec.ts via slow-generate
- **Status**: pending
- **Dependencies**: TASK-036
- **Description**: In `tests/e2e/difficulty-loading.spec.ts`, remove `test.skip(...)` and rewrite the test to navigate to `/?slowGenerate=15000` (covers 200ms overlay debounce + 10s Cancel reveal). Assert the spinner appears, the Cancel button reveals after 10s, clicking Cancel returns to Home. Bump the test timeout to a comfortable 30s. See requirements §9.3.
- **Verification**: `npx playwright test difficulty-loading.spec.ts --project=chromium` passes. The test should not be `.skip`'d.

### TASK-038: Focus management on dialogs
- **Status**: pending
- **Dependencies**: TASK-007, TASK-019
- **Description**: Create `src/components/useFocusTrap.ts` exporting a hook that, when active, traps Tab focus within a container element and returns focus to the previously-focused element on deactivation. Apply it in both `<ConfirmDialog>` and `<GenerationFailedDialog>`. Add a keyboard handler for Escape that triggers the cancel/dismiss action. The dependency on TASK-007 is sequencing-only: both tasks edit `GenerationFailedDialog.tsx`, so doing them in order avoids a merge conflict. See requirements §10.
- **Verification**: `npx vitest run src/components/useFocusTrap.test.ts src/components/ConfirmDialog.test.tsx src/components/GenerationFailedDialog.test.tsx` passes — covers Tab cycling, Escape closing, and focus restoration.

### TASK-039: useDebouncedFlag unit test
- **Status**: pending
- **Dependencies**: none
- **Description**: Create `src/hooks/useDebouncedFlag.test.ts` (or wherever `useDebouncedFlag.ts` resides) that uses `vi.useFakeTimers()` to verify the hook never returns true before `ms` ms have elapsed and returns false instantly when the source flag flips false. Cover edge cases: flag flipping true then false within the debounce window. See requirements §9.6.
- **Verification**: `npx vitest run src/hooks/useDebouncedFlag.test.ts` (or correct path) passes.

### TASK-040: Async newGame failure-path test
- **Status**: pending
- **Dependencies**: TASK-006
- **Description**: In `src/store/game.test.ts`, add a case that supplies a fake generator returning `kind: 'failed'` with `lastError: 'oops'`; asserts `loading` becomes false, `generationFailure` is populated, and `lastError === 'oops'`. Add a second case for `kind: 'error'` with the same assertions. See requirements §9.6.
- **Verification**: `npx vitest run src/store/game.test.ts` passes including the two new cases.

### TASK-041: Cancel-in-flight newGame test
- **Status**: pending
- **Dependencies**: none
- **Description**: In `src/store/game.test.ts`, add a case that calls `newGame` with a never-resolving fake generator handle, then calls `cancelGeneration()` before the promise resolves; asserts `loading` is false and the fake handle's `cancel()` was invoked. See requirements §9.6.
- **Verification**: `npx vitest run src/store/game.test.ts` passes.

### TASK-042: Fixture round-trip test
- **Status**: pending
- **Dependencies**: TASK-009, TASK-014c
- **Description**: In `src/engine/solver/techniques/catalog.test.ts` (or a new `fixture-roundtrip.test.ts`), iterate every entry in the technique catalog. Load its fixture's board, call `rate(fixture.board)`, and assert `result.difficulty === entry.tier`. This protects against fixture drift from rater behaviour. See requirements §9.6.
- **Verification**: `npx vitest run src/engine/solver/techniques/catalog.test.ts` passes including the new round-trip cases.

### TASK-043: WebKit Playwright project
- **Status**: pending
- **Dependencies**: none
- **Description**: In `playwright.config.ts`, add a second project entry: `{ name: 'webkit', use: { ...devices['Desktop Safari'] } }`. The full project list becomes Chromium + WebKit. CI is unchanged (still unit-tests-only). See requirements §9.5.
- **Verification**: `npx playwright test --project=webkit smoke.spec.ts` passes.

### TASK-044: E2E desktop nav test
- **Status**: pending
- **Dependencies**: TASK-018, TASK-043
- **Description**: Create `tests/e2e/desktop-nav.spec.ts`. Asserts: tab bar visible on Home (`[data-testid=tab-bar]`); clicking each of `tab-home`, `tab-stats`, `tab-learn`, `tab-settings` navigates to the correct screen (URL hash changes and the corresponding screen test id is visible); the tab bar remains visible across all four screens. See requirements §9.2.
- **Verification**: `npx playwright test desktop-nav.spec.ts --project=chromium` and `--project=webkit` both pass.

### TASK-045a: E2E difficulty matrix — Classic
- **Status**: pending
- **Dependencies**: TASK-007, TASK-018
- **Description**: Create `tests/e2e/difficulty-matrix.spec.ts`. For variant `classic`, iterate every tier in `availableTiers(classic)`. Each iteration: clear localStorage, navigate Home, select the tier, click New Game, and within 75s either (a) assert the board renders with at least one given cell *or* (b) assert the failure dialog renders with non-empty `closestRating` and a populated `lastError`. Use `test.describe.parallel` and per-iteration `test()` so each combo is its own report row. See requirements §9.1.
- **Verification**: `npx playwright test difficulty-matrix.spec.ts --project=chromium --grep classic` passes.

### TASK-045b: E2E difficulty matrix — Six
- **Status**: pending
- **Dependencies**: TASK-045a
- **Description**: Extend `difficulty-matrix.spec.ts` with the same per-tier iteration for variant `six`. See requirements §9.1.
- **Verification**: `npx playwright test difficulty-matrix.spec.ts --project=chromium --grep six` passes.

### TASK-045c: E2E difficulty matrix — Mini
- **Status**: pending
- **Dependencies**: TASK-045b
- **Description**: Extend `difficulty-matrix.spec.ts` with the same per-tier iteration for variant `mini`. See requirements §9.1.
- **Verification**: `npx playwright test difficulty-matrix.spec.ts --project=chromium --grep mini` passes.

### TASK-046: E2E PWA update banner
- **Status**: pending
- **Dependencies**: TASK-032, TASK-033
- **Description**: Create `tests/e2e/pwa-update.spec.ts`. The dev server does not produce a real SW manifest, so the test must run against `vite preview`. Configuration changes:
  1. In `playwright.config.ts`, change the `webServer` field from a single object to an array of two entries — one running `npm run dev` on port 5179 (existing default for all other specs), and a second running `npm run build && npm run preview -- --port 5180` on port 5180.
  2. Add `test.use({ baseURL: 'http://localhost:5180' })` at the top of `pwa-update.spec.ts` so this spec — and only this spec — targets the preview server.
  Test body: load the app, wait for SW registration, then use `page.route` to intercept the next SW manifest request and serve a manifest with a bumped revision so Workbox detects an update. Trigger an update check via a `visibilitychange` event. Assert `[data-testid=update-banner]` becomes visible. Click `[data-testid=update-reload]` and assert the page navigates (Playwright observes a `framenavigated`). See requirements §9.4.
- **Verification**: `npx playwright test pwa-update.spec.ts --project=chromium` passes. Both webServer entries start successfully when the suite is invoked.

### TASK-047: Settings test — updates + storage sections
- **Status**: pending
- **Dependencies**: TASK-030, TASK-035
- **Description**: Augment `src/screens/Settings.test.tsx` to cover: the Updates section's button cycle (idle → checking → up-to-date → idle), the Storage section's visibility gating on `hasOldSaves`, the Remove flow's confirm dialog interaction, and that the Storage section disappears after removal. See requirements §9.6.
- **Verification**: `npx vitest run src/screens/Settings.test.tsx` passes.

### TASK-048: Migration test — first-load prompt behaviour
- **Status**: pending
- **Dependencies**: TASK-029
- **Description**: Augment `src/App.test.tsx` (or create one if absent) to cover: (a) seed `sudoku.save.v2` and assert the first-load `<ConfirmDialog>` renders; (b) click "Decide later" and assert the dialog disappears, the v2 key is still in localStorage, and reloading the App re-renders the dialog; (c) click "Remove now" and assert the v2 key is gone and the dialog never re-appears. See requirements §9.6.
- **Verification**: `npx vitest run src/App.test.tsx` passes including the three new cases.

### TASK-049: Verify Bug B status with matrix E2E
- **Status**: pending
- **Dependencies**: TASK-014c, TASK-016, TASK-017, TASK-045c
- **Description**: Run the full difficulty-matrix E2E (`npx playwright test difficulty-matrix.spec.ts`). For each (variant, tier) that still fails, capture the failure mode (instant vs budget-exhausted) and the `lastError`. If any combos fail with budget exhaustion (no exception), that signals genuine Bug B and a follow-up task is needed. Document findings as a markdown comment in the spec or a brief note added to the next iteration's review. If everything passes, this task records "Bug B not observed" and the §4.3 mitigation in requirements is descoped. See requirements §4.3.
- **Verification**: `npx playwright test difficulty-matrix.spec.ts --project=chromium` passes — *or* a documented note explains which combos fail and why, with a follow-up task identified for iteration 4.

### TASK-050: Full unit-test sweep
- **Status**: pending
- **Dependencies**: TASK-001, TASK-002, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011, TASK-012, TASK-013, TASK-014c, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019, TASK-020, TASK-021, TASK-022, TASK-023, TASK-024, TASK-025, TASK-026, TASK-027, TASK-028, TASK-029, TASK-030, TASK-031, TASK-032, TASK-033, TASK-034, TASK-035, TASK-036, TASK-038, TASK-039, TASK-040, TASK-041, TASK-042, TASK-047, TASK-048
- **Description**: Run the full unit test suite and ensure every test passes with no skipped tests other than those documented as intentionally `.todo`. Repair any ripple-failures from the schema bumps. See requirements §12.
- **Verification**: `npx vitest run` exits zero with no failing tests.

### TASK-051: Full type check + build
- **Status**: pending
- **Dependencies**: TASK-050
- **Description**: Run a full TypeScript type check and a production build to make sure nothing escapes the test net. See requirements §12.
- **Verification**: `npx tsc --noEmit` exits zero; `npm run build` completes with no errors.

### TASK-052: Full E2E sweep — Chromium and WebKit
- **Status**: pending
- **Dependencies**: TASK-037, TASK-043, TASK-044, TASK-045c, TASK-046, TASK-049, TASK-051
- **Description**: Run the full E2E suite under both Playwright projects. See requirements §12.
- **Verification**: `npx playwright test --project=chromium` and `npx playwright test --project=webkit` both exit zero. Document elapsed time for each so future iterations can spot drift.
