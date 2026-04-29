# Iteration 4 — Tasks

This task list implements the plan in `.devloop/requirements.md`.
Tasks are ordered so empirical profiling data is available before any
data-driven tuning, and so the matrix E2E is tightened only after Bug B
is actually fixed.

---

### TASK-001: Bump app version to 0.4.0 + add tsx + profile-tiers npm script
- **Status**: done
- **Dependencies**: none
- **Description**: Update `package.json`: bump `version` from `0.3.0` to `0.4.0`; add `tsx` to `devDependencies` (latest stable, e.g. `"tsx": "^4.x"`); add `"profile-tiers": "tsx scripts/profile-tiers.ts"` under `scripts`. Run `npm install` so `package-lock.json` updates. See requirements §4.1.
- **Verification**: `node --input-type=commonjs -e "const p=JSON.parse(require('fs').readFileSync('./package.json','utf8')); if(p.version!=='0.4.0')throw 1; if(!p.devDependencies.tsx)throw 2; if(!p.scripts['profile-tiers'])throw 3;"`

### TASK-002: Implement `scripts/profile-tiers.ts`
- **Status**: done
- **Dependencies**: TASK-001
- **Description**: Create `scripts/profile-tiers.ts` per requirements §4.2–4.3. The script: (a) iterates each variant in `['classic','six','mini']`; (b) for each tier in `availableTiers(variant)` computes `clueFloor = clueBoundsLowerForTier(variant, tier)`; (c) generates N puzzles (default `N=20`, accept `--n=N` override) via `generate({ seed, clueFloor })` — **without** the strict-tier filter — using deterministic seeds derived from `(variantIndex*1000 + tierIndex*100 + i)`; (d) calls `rate()` on each result and records the rated tier; (e) prints incremental progress to stdout (`classic Master 12/20...`); (f) writes a histogram-table-per-(variant, clueFloor) markdown to `scripts/tier-distribution.md`, overwriting any prior content; (g) **also** writes `scripts/tier-distribution.summary.json` — a flat object keyed `${variantId}:${tierName}` with `{ rate: number, advertised: boolean, sampleSize: number, firstHitSeed: number | null }`. `firstHitSeed` is the seed of the first puzzle in the run whose rated tier matches the keyed tier (null if none hit). The summary feeds TASK-008's verification and TASK-012's fixture extraction. The script must be runnable as `npm run profile-tiers` and complete a smoke run (`-- --n=1`) in under 60 seconds.
- **Verification**: `npm run profile-tiers -- --n=1 && test -f scripts/tier-distribution.md && test -f scripts/tier-distribution.summary.json`

### TASK-003: Run baseline profile and commit `scripts/tier-distribution.md`
- **Status**: done
- **Dependencies**: TASK-002
- **Description**: Run `npm run profile-tiers -- --n=20` against the **current code (with the inverted `maxClues` semantics still in place)**. The output is the iteration's empirical baseline — it documents the bug on disk. Commit `scripts/tier-distribution.md` and `scripts/tier-distribution.summary.json`. Do NOT make any code changes besides running the script. The histogram should show that Hard / Master / etc. are rare-or-absent at their advertised clue floors with current behaviour — that is the expected baseline (TASK-003 does not enforce any threshold; threshold enforcement happens in TASK-008 after tuning).
- **Verification**: `node --input-type=commonjs -e "const s=JSON.parse(require('fs').readFileSync('./scripts/tier-distribution.summary.json','utf8')); if(Object.keys(s).length<10)throw new Error('summary missing entries');"`

### TASK-004: Rename `maxClues` → `clueFloor` in `generate.ts` + clueFloor regression test
- **Status**: done
- **Dependencies**: TASK-003
- **Description**: In `src/engine/generator/generate.ts`: rename `GenerateOptions.maxClues` → `GenerateOptions.clueFloor`; replace the `Math.max(minClues, maxClues)` floor computation with `clueFloor = options.clueFloor ?? minClues`. Remove the now-stale block comment about "secondary floor". `minClues` keeps its current role as the variant-level hard floor (defaulting from `defaultMinClues(variant)`). Add a short regression test in `generate.test.ts`: with `generate(classicVariant, { clueFloor: 30 })`, assert `result.clueCount >= 30`. This locks in the parameter's semantics so a future re-inversion is caught directly. See requirements §5.1 and §5.3.
- **Verification**: `npx vitest run src/engine/generator/generate.test.ts`

### TASK-005: Update `generate-for-difficulty.ts` to pass `clueFloor` only
- **Status**: done
- **Dependencies**: TASK-004
- **Description**: In `src/engine/generator/generate-for-difficulty.ts`: replace the dual `minClues` + `maxClues` plumbing with a single `clueFloor: clueBoundsLowerForTier(variant, targetTier)` on the `generate()` call. Remove the `clueBoundsUpperForTier` import/call from this file; the helper itself is retained for any other consumers. See requirements §5.2.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts` (Hard/Master remain skipped via `SKIPPED_TIERS` until TASK-011; this run exercises every other test in the file)

### TASK-006: Update remaining `generate()` / `generate-for-difficulty()` callers + tests
- **Status**: done
- **Dependencies**: TASK-005
- **Description**: Search for any remaining `maxClues` references in `src/` and `tests/` (`grep -rn "maxClues" src tests`). Update each call site to use `clueFloor` (with appropriate value — the lower bound, not the upper). Update any test fixtures or unit tests that referenced the old name. The rename is purely mechanical at this stage; semantic tuning happens in TASK-007.
- **Verification**: `! grep -rn "maxClues" src tests && npx vitest run src/engine/generator/`

### TASK-007: Apply data-driven tuning per baseline `tier-distribution.summary.json`
- **Status**: pending
- **Dependencies**: TASK-006
- **Description**: Read `scripts/tier-distribution.summary.json` (committed in TASK-003). For each entry where `advertised: true` and `rate < 0.05`, apply tuning per requirements §6: (a) **first lever** — compute `N = ceil(log(0.002) / log(1 - rate))`. If `N ≤ 200`, set `MAX_ATTEMPTS_BY_TIER[tier] = N`. If `N > 200`, fall to lever 2 (the practical breakpoint is approximately rate=0.031). (b) **second lever** — lower `clueBoundsLowerForTier(variant, tier)` toward the inner edge of `CLUE_BOUNDS[tier]`. (c) **third lever** — if neither lever helps, remove the tier from `availableTiers(variant)` (in `variant-tiers.ts`). Each change must reference the summary entry that justified it (in code comment OR commit message). This task makes the changes; TASK-008 verifies them by re-profiling.
- **Verification**: `npx vitest run src/engine/generator/` (sanity check unit suite still compiles and existing non-skipped cases pass)

### TASK-008: Re-run profile and verify all advertised tiers meet threshold
- **Status**: pending
- **Dependencies**: TASK-007
- **Description**: Run `npm run profile-tiers -- --n=20` against the post-tuning code (this overwrites `scripts/tier-distribution.md` and `scripts/tier-distribution.summary.json` in the working tree). Commit both files. The verification command then inspects the committed JSON without re-running the 6-min profile. If any advertised entry's `rate` is still below 0.05, treat as a re-open of TASK-007 rather than continuing.
- **Verification**: `node --input-type=commonjs -e "const s=JSON.parse(require('fs').readFileSync('./scripts/tier-distribution.summary.json','utf8')); for(const k in s){const e=s[k]; if(e.advertised && e.rate<0.05){console.error('Below threshold:',k,e); process.exit(1);}}"`

### TASK-009: Tighten `difficulty-matrix.spec.ts` to strict-success contract
- **Status**: pending
- **Dependencies**: TASK-008
- **Description**: In `tests/e2e/difficulty-matrix.spec.ts`: change the `expect.poll` race so success requires `[data-testid=sudoku-board]` visible. The failure-dialog branch becomes a hard test failure: assert that `[data-testid=generation-failed-dialog]` is **not** visible at the end of the per-tier flow. Remove the `lastErrorText` checks and the dialog title `tier` check (those existed only because the failure branch was acceptable). The success-cell-count assertion (top-left 3×3 region) stays. See requirements §7.
- **Verification**: `npx playwright test tests/e2e/difficulty-matrix.spec.ts --project=chromium -g "classic.*Easy"` (smoke a single Easy combo to confirm the new contract still admits the obvious success case)

### TASK-010: Rewrite the matrix E2E header narrative for the new contract
- **Status**: pending
- **Dependencies**: TASK-009
- **Description**: Replace the TASK-049 / Bug B "decision rule" comment block at the top of `tests/e2e/difficulty-matrix.spec.ts` (currently lines 29-62) with a short narrative describing the iteration-4 contract: every advertised tier must produce a board; if a tier cannot, fix the generator or descope it from `availableTiers` per `.devloop/requirements.md` §6. Remove the obsolete "Decision rule when TASK-052 reports failures here" block. No code changes — header comment only.
- **Verification**: `! grep -q "Decision rule when TASK-052" tests/e2e/difficulty-matrix.spec.ts && npx tsc --noEmit -p tsconfig.app.json`

### TASK-011: Un-skip Hard and Master in `generate-for-difficulty.test.ts`
- **Status**: pending
- **Dependencies**: TASK-008
- **Description**: In `src/engine/generator/generate-for-difficulty.test.ts`, the skip mechanism is `const SKIPPED_TIERS = new Set<Difficulty>(['Hard', 'Master'])` followed by `const runner = SKIPPED_TIERS.has(tier) ? it.skip : it;` (around lines 37-40). Empty the set: `const SKIPPED_TIERS = new Set<Difficulty>([])`. Update `TIER_SEEDS` for Hard and Master with the seeds recorded in `scripts/tier-distribution.summary.json` under `classic:Hard.firstHitSeed` and `classic:Master.firstHitSeed` (these seeds are the ones profiling proved hit those tiers). If after TASK-007 tuning either tier still cannot reliably hit inside the test's 80-attempt `maxRetries`, fall back for that tier to a `vi.spyOn(rateModule, 'rate')` mock returning a `RateResult` with `difficulty: 'Hard'` (or 'Master'), `solved: true` so the strict-tier acceptance path is still exercised. Comment any fallback explicitly.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts -t "Hard|Master"`

### TASK-012: Create `tier-fixtures.ts` with one fixture per advertised tier
- **Status**: pending
- **Dependencies**: TASK-008
- **Description**: Create `src/engine/solver/techniques/tier-fixtures.ts` exporting `TIER_FIXTURES: Partial<Record<Difficulty, { variant: VariantId; board: string; seed: number }>>`. For each tier in `['Easy','Medium','Hard','Expert','Master','Diabolical','Demonic','Nightmare']`: read `firstHitSeed` for the classic variant from `scripts/tier-distribution.summary.json`. Regenerate the puzzle locally via `generate(classicVariant, { seed: firstHitSeed, clueFloor: clueBoundsLowerForTier(classicVariant, tier) })` and capture its givens grid as a dotted-digit string (same convention as catalog fixtures, e.g. `"..3.5...8..."`). Add the entry. **If `firstHitSeed` is null for classic, source the seed from another variant** (`six` or `mini`) where the tier was hit — match the variant in the entry. **If no variant has a `firstHitSeed` for tier T**, omit the entry entirely (`Partial<Record>` allows this) and add a `// <Tier>: omitted — unobtainable in any variant after iteration-4 tuning` comment in the file. See requirements §9.
- **Verification**: `test -f src/engine/solver/techniques/tier-fixtures.ts && npx tsc --noEmit -p tsconfig.app.json && grep -q "TIER_FIXTURES" src/engine/solver/techniques/tier-fixtures.ts`

### TASK-013: Implement the tier-fixture round-trip test
- **Status**: pending
- **Dependencies**: TASK-012
- **Description**: Create `src/engine/solver/techniques/tier-fixtures.test.ts`. Import `TIER_FIXTURES` and `parseBoardString` (the same helper that `catalog.test.ts:117` uses to parse fixture strings). For each `[tier, fixture]` in `Object.entries(TIER_FIXTURES)`, call `parseBoardString(fixture.variant, fixture.board)` to get a `Board`, then call `rate(board)` and assert (a) `result.difficulty === tier` and (b) `result.solved === true`. Use `it.each(Object.entries(TIER_FIXTURES))` so each tier is its own test case for clean failure reporting. See requirements §9.
- **Verification**: `npx vitest run src/engine/solver/techniques/tier-fixtures.test.ts`

### TASK-014: `lastError != null` defensive check in `GenerationFailedDialog`
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/components/GenerationFailedDialog.tsx` (around line 124 per the iteration-3 review), change the conditional rendering of the diagnostic line from a truthy check on `failure.lastError` to `failure.lastError != null`. This keeps the line visible for empty-string errors. Add a unit test in the existing `src/components/GenerationFailedDialog.test.tsx` covering an empty-string `lastError`; name the new test so it includes the substring "empty" so the verification grep can target it specifically. See requirements §10.1.
- **Verification**: `npx vitest run src/components/GenerationFailedDialog.test.tsx -t "empty"`

### TASK-015: `cancelGeneration` clears `generationFailure`
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/store/game.ts`, `cancelGeneration` action: set `generationFailure: null` alongside the existing `loading: false`. Add a unit test in `game.test.ts` that sets a `generationFailure`, calls `cancelGeneration`, and asserts both fields are cleared. See requirements §10.2.
- **Verification**: `npx vitest run src/store/game.test.ts -t "cancel"`

### TASK-016: JSDoc on `generateInWorker` documenting the one-at-a-time contract
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/workers/generator-client.ts`, add a JSDoc block above `generateInWorker` (or whichever function exposes the worker entry point) stating: "Callers must serialize requests — the worker rejects an overlapping `generate` message with a `'Worker is already processing a generation request'` error. The `gameStore.newGame` flow already serializes; direct callers must do the same." No behaviour change. See requirements §10.3.
- **Verification**: `grep -q "serialize" src/workers/generator-client.ts`

### TASK-017: Migration test seeds a structurally-valid v2 payload
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/App.test.tsx` (around line 128), the migration test currently does `localStorage.setItem('sudoku.save.v2', '{}')`. Replace `'{}'` with a structurally-valid v2 payload — i.e. the JSON shape that the v2 save schema actually emits. The v2 shape is recoverable from `.devloop/archive/iteration-2/` source (or from the v3 schema in `src/store/save.ts` minus the per-(variant, difficulty) slot key). The detector matches on key, not value, so the assertion still passes; this is belt-and-braces against a future change in the schema-load path that JSON-parses v2 entries before the detector runs. See requirements §10.4.
- **Verification**: `npx vitest run src/App.test.tsx -t "migration"`

### TASK-018: Settings test asserts 2-second auto-revert with fake timers
- **Status**: done
- **Dependencies**: none
- **Description**: In `src/screens/Settings.test.tsx` (the test file covering the Updates section), use `vi.useFakeTimers()` to drive the up-to-date and error-state revert paths. After the button transitions to "Up to date" (and separately to "Couldn't check — try again"), call `vi.advanceTimersByTime(2000)` and assert the label reverts to "Check for updates". Name the new test(s) so they include the word "revert" (used by the verification grep below). See requirements §10.5.
- **Verification**: `npx vitest run src/screens/Settings.test.tsx -t "revert"`

### TASK-019: Real-worker smoke test
- **Status**: done
- **Dependencies**: none
- **Description**: New file `src/workers/generator-client.real-worker.test.ts`. Construct the real worker via `defaultCreateWorker` (or the equivalent factory in `generator-client.ts`), fire a `generate` request for a Mini puzzle (smallest variant), immediately call `cancel()`, assert the call resolves cleanly without an unhandled rejection or unexpected error message. The intent is to lock in the `new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' })` import-URL plumbing. If vitest's jsdom environment cannot host a real worker, document the limitation in a `// @vitest-environment node` (or comparable) override at the top of the file; if that still doesn't work, fall back to a Playwright smoke spec at `tests/e2e/worker-smoke.spec.ts` that loads the app and listens for a generate-progress event. See requirements §10.6.
- **Verification**: `npx vitest run src/workers/generator-client.real-worker.test.ts` (OR `npx playwright test tests/e2e/worker-smoke.spec.ts --project=chromium` if the Playwright fallback was used)

### TASK-020: Full unit-test sweep
- **Status**: pending
- **Dependencies**: TASK-008, TASK-010, TASK-011, TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019
- **Description**: Run the full vitest suite and confirm every test passes — including the un-skipped Hard/Master cases, the new tier-fixture round-trip, the new real-worker smoke test, and all existing iteration-3 tests. Investigate any failures.
- **Verification**: `npm test`

### TASK-021: Type check + production build
- **Status**: pending
- **Dependencies**: TASK-020
- **Description**: Confirm the codebase still type-checks cleanly and the production build succeeds. Catches any TypeScript regressions from the rename and any unused-import warnings introduced by removing `clueBoundsUpperForTier` calls.
- **Verification**: `npm run build`

### TASK-022: Full E2E sweep on Chromium and WebKit
- **Status**: pending
- **Dependencies**: TASK-021
- **Description**: Run the **full** Playwright suite on both projects — not just the tightened matrix. The matrix is the canonical Bug B regression check, but iteration 4 also touches generator/store/dialog code that the slow-generate, desktop-nav, and PWA-update specs exercise; without a full sweep we cannot honour the §14 success criterion "No regressions in v0.3.0 functionality." If any case fails: matrix failures route back to TASK-007 (re-open tuning); other-spec failures route to whichever iteration-4 task touched the relevant code.
- **Verification**: `npx playwright test --project=chromium && npx playwright test --project=webkit`
