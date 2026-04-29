# Iteration 7 — Tasks

These tasks implement the iteration-7 plan documented in
`.devloop/requirements.md`. Each task is small and focused.
Verification fields are scoped to the touched suites only — the
full unit / type / build / E2E sweeps run as final tasks.

### TASK-001: Collapse `Difficulty` type and `DIFFICULTY_ORDER`
- **Status**: done
- **Type**: feat
- **Dependencies**: none
- **Description**: In `src/engine/generator/rate.ts`, drop the `'Diabolical'` and `'Demonic'` literals from the `Difficulty` union and from `DIFFICULTY_ORDER`. The new order is `['Easy', 'Medium', 'Hard', 'Expert', 'Master', 'Nightmare']`. See requirements §4. Type-check will fail in dependent files until subsequent tasks land — that is expected. This task only edits `rate.ts`. Update the docblock above the type to cite iteration-7.
- **Verification**: `npx tsc --noEmit src/engine/generator/rate.ts` passes for this file (other files will fail to type-check until later tasks; that is acceptable for this task's scope).

### TASK-002: Remap `TECHNIQUE_TIER`
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: Rewrite `TECHNIQUE_TIER` in `rate.ts` per the table in requirements §4.1. Move `pointing` and `box-line-reduction` to `Hard` (alongside subsets); move x-wing/swordfish/jellyfish into `Expert` (alongside wings/colorings/cycles); move unique-rectangle/BUG+1/xy-chain/multi-coloring/als-xz/wxyz-wing/hidden-rectangle/avoidable-rectangle into `Master`. Nightmare members unchanged. Refresh the docblock above the table.
- **Verification**: `npx vitest run src/engine/generator/rate.test.ts` passes after TASK-015 lands its assertions. For this task in isolation: `npx tsc --noEmit src/engine/generator/rate.ts` exits 0.

### TASK-003: Rewrite `CLUE_BOUNDS`
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: In `rate.ts`, rewrite `CLUE_BOUNDS` per requirements §4.2: classic gets `Easy/Medium/Hard/Expert/Master/Nightmare` windows (the old `Expert/Diabolical/Demonic/Nightmare` windows shift in by name); the old classic `Hard` and `Master` windows are dropped. Six keeps `Easy[22,26]`, `Medium[14,21]`. Mini keeps `Easy[12,14]` only. Refresh the comment above the `six` and `mini` blocks to cite iteration 7.
- **Verification**: `npx tsc --noEmit src/engine/generator/rate.ts` exits 0.

### TASK-004: Update `TECHNIQUE_CATALOG` tier strings
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-001, TASK-002
- **Description**: In `src/engine/solver/techniques/catalog.ts`, change every `tier:` field on `TECHNIQUE_CATALOG` entries to match the new mapping in requirements §4.1. The catalog must agree with `TECHNIQUE_TIER`. Sanity-check by eye: every technique imported in catalog.ts has its `tier:` updated. Display names unchanged.
- **Verification**: `npx tsc --noEmit src/engine/solver/techniques/catalog.ts` exits 0 and `npx vitest run src/engine/solver/techniques/catalog.test.ts` passes.

### TASK-005: Rewrite `VARIANT_TIERS` and docblock
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: In `src/engine/generator/variant-tiers.ts`, set `VARIANT_TIERS.classic = ['Easy', 'Medium', 'Hard', 'Expert', 'Master', 'Nightmare']` (all six). Six and mini lists unchanged from iteration 6. Rewrite the file-level docblock to cite iteration 7's corrected baseline (which TASK-013 will produce) and the rationale for collapsing the empty bands. Keep the iteration-6 lever-2 sweep ranges in the docblock as historical record so iteration 8 has the trail.
- **Verification**: `npx vitest run src/engine/generator/variant-tiers.test.ts` passes after TASK-017 updates the test. For this task in isolation: type-check passes for the file.

### TASK-006: Rename `TIER_FIXTURES` keys for the new tier mapping
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: In `src/engine/solver/techniques/tier-fixtures.ts`, rewrite the keys of every existing entry per the iteration-7 mapping in requirements §4.1. The semantic content of each fixture (its seed and board) does not change here; only the key it lives under does. The rename map (existing iteration-6 key → iteration-7 key) is: `classic:Easy → classic:Easy` (unchanged), `classic:Medium → classic:Medium` (unchanged), `classic:Expert → classic:Hard` (subsets are now Hard), `classic:Diabolical → classic:Expert` (wings are now Expert), `classic:Demonic → classic:Master` (chains are now Master), `classic:Nightmare → classic:Nightmare` (unchanged), `six:Medium → six:Medium` (unchanged). Existing seed and board values stay in place as placeholders — TASK-015 replaces them with iteration-7 baseline values. Remove the obsolete `// classic:Hard, classic:Master — unobtainable` comment. New entries (`six:Easy`, `mini:Easy`) are added in TASK-015. Update the file-level docblock to drop the "Hard and Master are omitted" line and note that TASK-015 will refresh seeds and boards from the iteration-7 baseline.
- **Verification**: `npx tsc --noEmit src/engine/solver/techniques/tier-fixtures.ts` exits 0; the file contains exactly seven entries with keys `classic:Easy/Medium/Hard/Expert/Master/Nightmare` and `six:Medium`. The round-trip test in `tier-fixtures.test.ts` is allowed to fail at this point; TASK-015 brings it green.

### TASK-007: Consolidate `TIER_BUDGETS` in `generate-for-difficulty.ts`
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-001
- **Description**: In `src/engine/generator/generate-for-difficulty.ts`, remove the parallel `MAX_ATTEMPTS_BY_TIER` and `TIMEOUT_MS_BY_TIER` records and the `DEFAULT_MAX_ATTEMPTS` / `DEFAULT_TIMEOUT_MS` constants (the last two are no longer publicly used). Add a single `TIER_BUDGETS: Record<Difficulty, { maxAttempts: number; timeoutMs: number }>` per requirements §6. Initial values: translate iteration-6 budgets under the rename — `Easy 50/150_000`, `Medium 122/370_000`, `Hard 50/150_000`, `Expert 50/150_000`, `Master 122/370_000`, `Nightmare 59/180_000`. These are placeholders that TASK-014 will re-pin against the iteration-7 baseline. Update the internal call site in `generateForDifficulty` to read `TIER_BUDGETS[difficulty]?.maxAttempts ?? 50` and `TIER_BUDGETS[difficulty]?.timeoutMs ?? 60_000`. Keep `defaultMaxAttemptsForTier` as a thin wrapper. Refresh the docblock to cite iteration 7 and the §6 reliability formula.
- **Verification**: `npx tsc --noEmit src/engine/generator/generate-for-difficulty.ts` exits 0.

### TASK-008: Bump save schema to v4
- **Status**: done
- **Type**: refactor
- **Dependencies**: none
- **Description**: In `src/store/save.ts`, change `SAVE_STORAGE_KEY` to `'sudoku.save.v4'` and `SAVE_SCHEMA_VERSION` to `4`. The internal `SaveFile` shape and the slotKey/entry helpers are unchanged. The persistence comment at the top of the file is refreshed to cite v4 and to note the iteration-7 tier collapse as the reason for the bump.
- **Verification**: `npx vitest run src/store/save.test.ts` passes after TASK-019 updates the test literals. For this task in isolation: type-check passes.

### TASK-009: Bump stats schema to v4 and lowercase `entryKey`
- **Status**: done
- **Type**: refactor
- **Dependencies**: none
- **Description**: In `src/store/stats.ts`, change `STATS_STORAGE_KEY` to `'sudoku.stats.v4'` and `STATS_SCHEMA_VERSION` to `4`. Add `.toLowerCase()` to the difficulty argument in `entryKey` so it matches `slotKey` in `save.ts` (closes review §5.1). Update the comment block at lines 53-57 to cite the iteration-7 tier names (`'easy', 'medium', 'hard', 'expert', 'master', 'nightmare'`).
- **Verification**: `npx vitest run src/store/stats.test.ts` passes after TASK-019 updates the test. For this task in isolation: type-check passes.

### TASK-010: Extend `OLD_SAVE_KEY_PATTERN` regex
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-008, TASK-009
- **Description**: In `src/store/migration.ts`, change `OLD_SAVE_KEY_PATTERN` from `/^sudoku\.(save|stats|settings)\.v[12]$/` to `/^sudoku\.(save|stats|settings)\.v[123]$/`. Refresh the file-level docblock to note that v3 is now considered legacy because iteration 7's tier rename invalidates the persisted slot semantics.
- **Verification**: `npx vitest run src/store/migration.test.ts` passes after TASK-019 updates the v3 cases.

### TASK-011: Retune `DifficultyBadge` swatch ramp
- **Status**: done
- **Type**: style
- **Dependencies**: TASK-001
- **Description**: In `src/components/DifficultyBadge.tsx`, rewrite `TIER_SWATCH` to the six-tier ramp in requirements §10: `easy` green-700, `medium` blue-700, `hard` amber-700, `expert` orange-700, `master` red-900 (deeper than the old `master` red-700 to preserve the visual escalation), `nightmare` near-black indigo. Drop `diabolical` and `demonic` entries. Refresh the docblock to cite the iteration-7 ramp and remove the "eight tiers" language.
- **Verification**: `npx vitest run src/components/DifficultyBadge.test.tsx` passes after TASK-018 updates the test cases.

### TASK-012: Update screen tests for new tier scheme and v3 migration
- **Status**: done
- **Type**: test
- **Dependencies**: TASK-005, TASK-008, TASK-009, TASK-010, TASK-011
- **Description**: Update `src/screens/Home.test.tsx` (classic picker now has six options); `src/screens/Stats.test.tsx` (filter pill rule unchanged but classic now exposes six pills — adjust any hard-coded tier-list assertions); `src/screens/Settings.test.tsx` (storage section gating unchanged but add a case asserting v3 keys trigger the section); `src/App.test.tsx` (add a v3-save case alongside the existing v2-save case for the migration prompt). Existing tests that reference `'diabolical'` or `'demonic'` are updated to use the renamed tiers per requirements §4.1.
- **Verification**: `npx vitest run src/screens/Home.test.tsx src/screens/Stats.test.tsx src/screens/Settings.test.tsx src/App.test.tsx` passes.

### TASK-013: Run iteration-7 corrected baseline profile (n=50)
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-002, TASK-003, TASK-004, TASK-005, TASK-007
- **Description**: Run `npm run profile-tiers -- --all-tiers --n=50` and commit the resulting `scripts/tier-distribution.md` and `scripts/tier-distribution.summary.json` as the iteration-7 corrected baseline. Wall-clock budget: 1–2 hours per requirements §5. Use a long-running Bash invocation (or `run_in_background: true`) since the runtime exceeds the standard 10-minute Bash timeout. The output replaces the iteration-6 baseline files in place. With `--all-tiers` the script iterates `DIFFICULTY_ORDER × variants`, so the summary contains 18 cells (6 tiers × 3 variants), of which 9 are advertised (`advertised: true`).
- **Verification**: `scripts/tier-distribution.summary.json` contains 18 cell entries; the 9 advertised cells (classic Easy/Medium/Hard/Expert/Master/Nightmare, six Easy/Medium, mini Easy) all show `sampleSize: 50` and `solvedRate >= 0.05`. No `Diabolical` or `Demonic` keys remain anywhere in the file.

### TASK-014: Re-pin `TIER_BUDGETS` against iteration-7 baseline
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-013
- **Description**: Read `scripts/tier-distribution.summary.json`. For each `Difficulty`, compute the maximum required `N` across variants advertising that tier using `N = ceil(log(0.002) / log(1 - solvedRate))`. Apply the floor of 50 attempts as the small-sample-variance guard. Compute `timeoutMs = max(60_000, maxAttempts × 2000 × 1.5)`. Update each `TIER_BUDGETS` entry in `generate-for-difficulty.ts` to the formula-derived values. Rewrite the docblock above `TIER_BUDGETS` to cite the iteration-7 baseline by date and, for each non-default budget, the (variant, tier, solvedRate) driver tuple. State explicitly that the timeout rule applies to every advertised tier — closing iteration-6 review G3.
- **Verification**: `npx tsc --noEmit src/engine/generator/generate-for-difficulty.ts` exits 0; the `TIER_BUDGETS` literal in the file is consistent with the formula derived from the baseline JSON (spot-check by re-deriving N for one tier — e.g. `Master` whose `solvedRate` is the smallest). The full per-tier table assertion is pinned in TASK-016.

### TASK-015: Refresh `TIER_FIXTURES` from iteration-7 baseline
- **Status**: done
- **Type**: refactor
- **Dependencies**: TASK-006, TASK-013
- **Description**: For each of the nine advertised cells, replace `seed` and `board` in `TIER_FIXTURES` with the `firstHitSeed` and `firstHitBoard` from the iteration-7 corrected baseline summary JSON. Add new `'six:Easy'` and `'mini:Easy'` entries (closes review G1). The `tierFromKey` helper is unchanged. Update the file-level docblock to cite the iteration-7 baseline by date and remove the iteration-6 lever-2 reference (or keep a one-line note that `six:Medium` was lever-2-restored in iteration 6).
- **Verification**: `npx vitest run src/engine/solver/techniques/tier-fixtures.test.ts` passes — round-trips all nine entries, asserts `result.solved === true` and the rated tier matches the fixture key for each.

### TASK-016: Update `generate-for-difficulty.test.ts` for `TIER_BUDGETS`
- **Status**: done
- **Type**: test
- **Dependencies**: TASK-007, TASK-014
- **Description**: In `src/engine/generator/generate-for-difficulty.test.ts`, replace the iteration-6 per-tier table assertion (which reads `MAX_ATTEMPTS_BY_TIER` keyed by 8-tier names with explicit Medium=122 / Demonic=122 / Nightmare=59) with an assertion that destructures `TIER_BUDGETS` and pins each of the six tiers' `maxAttempts` and `timeoutMs` values to whatever TASK-014 wrote. The "Nightmare defaults to 59 attempts when maxRetries is omitted" wiring test stays — the value updates if TASK-014 changed it. The `solved=false` reject branch tests from iteration 6 are unchanged. Drop any test importing `MAX_ATTEMPTS_BY_TIER` / `TIMEOUT_MS_BY_TIER` / `DEFAULT_MAX_ATTEMPTS` / `DEFAULT_TIMEOUT_MS`.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts` passes.

### TASK-017: Update unit tests across `engine/generator`
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-002, TASK-003, TASK-005
- **Description**: Update `src/engine/generator/rate.test.ts` (assertions on `TECHNIQUE_TIER` keys/values per the new mapping, `DIFFICULTY_ORDER` array shape, `CLUE_BOUNDS` shape per variant). Update `src/engine/generator/variant-tiers.test.ts` (`availableTiers(classicVariant)` returns six tiers; six and mini unchanged). Drop any test importing the removed `'Diabolical'` / `'Demonic'` literals.
- **Verification**: `npx vitest run src/engine/generator/rate.test.ts src/engine/generator/variant-tiers.test.ts` passes.

### TASK-018: Update component tests for new tier scheme
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-001, TASK-011
- **Description**: Two component test files need updating. (a) `src/components/DifficultyBadge.test.tsx` — replace any eight-tier-ramp assertions with explicit cases for each of the six new tiers (`easy`, `medium`, `hard`, `expert`, `master`, `nightmare`); assert each renders with the corresponding swatch (background colour matches `TIER_SWATCH[slug].background`); keep the unknown-tier neutral-fallback case but use a synthetic slug (e.g. `'unknown-tier'`) instead of the removed `'diabolical'` / `'demonic'`. (b) `src/components/GenerationFailedDialog.test.tsx` — every test seeds `makeFailure('Demonic')` and asserts the "Try easier" button reads `'Diabolical'`. Replace with `makeFailure('Master')` and assert the easier label is `'Expert'`. The component itself reads `DIFFICULTY_ORDER` so no source change is needed; only the test fixture values move under the new ladder.
- **Verification**: `npx vitest run src/components/DifficultyBadge.test.tsx src/components/GenerationFailedDialog.test.tsx` passes.

### TASK-019: Update store / migration tests for v4 schemas
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-008, TASK-009, TASK-010
- **Description**: Update `src/store/save.test.ts` (any literal `'sudoku.save.v3'` becomes `'sudoku.save.v4'`; `SAVE_SCHEMA_VERSION === 4`). Update `src/store/stats.test.ts` (the `'sudoku.stats.v3'` and `STATS_SCHEMA_VERSION === 3` literals; `initialStatsEntries` shape now nine entries — six classic + two six + one mini; add a targeted assertion that `entryKey('classic', 'Hard') === 'classic:hard'` covering the lowercase normalisation closing review §5.1). Update `src/store/migration.test.ts` — the iteration-6 "v3 keys not detected" case at lines 28-33 inverts (v3 IS now detected); add a "v4 keys NOT detected" case to pin the new boundary.
- **Verification**: `npx vitest run src/store/save.test.ts src/store/stats.test.ts src/store/migration.test.ts` passes.

### TASK-020: Bump `package.json` to 0.6.0
- **Status**: pending
- **Type**: chore
- **Dependencies**: TASK-001
- **Description**: Bump `package.json` version from `0.5.0` to `0.6.0`. The minor bump reflects the player-visible difficulty-ramp change.
- **Verification**: `node -e "console.log(require('./package.json').version)"` prints `0.6.0`.
- **Breaking**: Players' in-progress saves and stats history at all difficulty tiers are discarded on first launch of v0.6.0. The legacy-cleanup prompt in App and Settings surfaces this once.

### TASK-021: Run iteration-7 final-snapshot profile
- **Status**: pending
- **Type**: chore
- **Dependencies**: TASK-014, TASK-015
- **Description**: Re-run `npm run profile-tiers -- --all-tiers --n=50` after the budget re-pin and fixture refresh land. Commit the resulting `scripts/tier-distribution.md` and `scripts/tier-distribution.summary.json` as the iteration-7 final snapshot. This is the reliability check per requirements §11. Same wall-clock budget as TASK-013 (1–2 hours). If any advertised cell in the final snapshot returns `solvedRate < 0.05`, follow the requirements §11 contingency: revert that tier's advertisement in `VARIANT_TIERS` before shipping.
- **Verification**: `scripts/tier-distribution.summary.json` shows `solvedRate >= 0.05` for every advertised cell; `sampleSize: 50` per cell.

### TASK-022: Full unit-test sweep
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-012, TASK-016, TASK-017, TASK-018, TASK-019
- **Description**: Run the full unit suite to catch any tier-name leak in tests not explicitly enumerated above (e.g. fuzz tests, technique-index tests, hint tests). Resolve any failures by updating the test (most failures will be importing a removed literal).
- **Verification**: `npm test` passes — every suite green.

### TASK-023: Type-check and production build sweep
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011
- **Description**: Run `npx tsc --noEmit` over the whole project and `npm run build` to catch any remaining tier-name compile error or PWA-build regression. The build emits a service-worker bundle that includes the new tier names; verify the bundle compiles cleanly.
- **Verification**: `npx tsc --noEmit` exits 0 and `npm run build` exits 0.

### TASK-024: Update E2E specs and full E2E sweep on Chromium and WebKit
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-021, TASK-022, TASK-023
- **Description**: Two E2E specs reference the old tier names and need updating before the sweep: (a) `tests/e2e/variant-tier-caps.spec.ts` — its hardcoded `DIFFICULTY_ORDER` (8 entries) and `VARIANT_TIERS` per-variant lists must be rewritten to match the iteration-7 ladder (6 entries: `easy/medium/hard/expert/master/nightmare`); the file-level docblock listing the per-variant advertised tiers must be updated. (b) `tests/e2e/difficulty-loading.spec.ts` — uses `Demonic` as the example "slow generate" tier; replace with `Master` (the renamed equivalent). Then run the full Playwright suite. The strict matrix `tests/e2e/difficulty-matrix.spec.ts` iterates `availableTiers(variant)` — for classic this is now six tiers, so the spec exercises Hard/Expert/Master generation end-to-end. Other specs (resume, new-game, notes, hint-learn-more, pwa-update, worker) should be unaffected. If any spec fails because of a v3 → v4 storage-key mismatch, update the spec to seed `'sudoku.save.v4'`.
- **Verification**: `npx playwright test --project=chromium && npx playwright test --project=webkit` exits 0 for both projects.
