# Sudoku PWA — Iteration 5 Tasks

Tasks reference `.devloop/requirements.md` for full context. Section
numbers (§N) below refer to that document.

### TASK-001: Add `--all-tiers` flag and `firstHitBoard` emission to profile-tiers.ts
- **Status**: done
- **Type**: chore
- **Dependencies**: none
- **Description**: Implement requirements §4 in `scripts/profile-tiers.ts`. Three changes in the same edit window: (1) extend the argv parser to recognize `--all-tiers`; when present, iterate `DIFFICULTY_ORDER` for every variant whose `CLUE_BOUNDS[variant.id]` defines a window for that tier (skip cells with no defined window). The summary JSON's `advertised: boolean` field is set as `availableTiers(variant).includes(tier)`. (2) Add a `firstHitBoard: string | null` field to each per-cell `SummaryEntry` — the dotted-digit row-major givens string of the first puzzle that rated as the target tier (or `null`). Use the existing `puzzle` returned from `generate(...)` and convert via the same row-major dotted-digit convention used by `parseBoardString`. (3) Retire the obsolete iteration-3 `minClues` preamble (lines ~75-82) and rename the call site `{ seed, minClues: clueFloor }` → `{ seed, clueFloor }`.
- **Verification**: `npm run profile-tiers -- --all-tiers --n=1` runs to completion and writes both `scripts/tier-distribution.md` and `scripts/tier-distribution.summary.json`. The summary JSON contains entries for every tier in `DIFFICULTY_ORDER` for each variant where a `CLUE_BOUNDS` window is defined (17 cells: classic 8 + six 6 + mini 3), and each entry has a `firstHitBoard` field (string or null). `tsx` runtime-checks the script — type errors surface as the script fails to start.

### TASK-002: Capture iteration-5 post-fix baseline profile
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-001
- **Description**: Run `npm run profile-tiers -- --all-tiers --n=20` and commit the resulting `scripts/tier-distribution.md` and `scripts/tier-distribution.summary.json`. This is the *validated post-fix baseline* — the first iteration-5 snapshot, against which §6/§7 decisions are made. The run takes ~6 minutes per the iteration-4 §4.4 estimate.
- **Verification**: Both files exist on disk and reflect the new run (check `Generated:` header date in the markdown, and that `tier-distribution.summary.json` has 17 entries — every tier × variant cell with a defined `CLUE_BOUNDS` window). `git diff scripts/tier-distribution.summary.json` shows the new entries with non-null `firstHitBoard` for tiers that hit. No code changes in this task.

### TASK-003: Apply lever 1 — update `MAX_ATTEMPTS_BY_TIER` per the iteration-5 baseline
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-002
- **Description**: Implement requirements §6. Read `scripts/tier-distribution.summary.json` (the iteration-5 baseline). For each (variant, tier) cell with `rate ≥ 0.05`, compute `N = ceil(log(0.002) / log(1 - rate))` (cap at 200). For each tier (across variants), set `MAX_ATTEMPTS_BY_TIER[tier]` to the maximum `N` among that tier's cells. Update the table in `src/engine/generator/generate-for-difficulty.ts` (lines ~19-28). Also refresh the doc-block above the table (lines ~11-18) to: drop the "Iteration 3 §4.3" reference; cite the iteration-5 baseline by date; for any non-default budget, cite the (variant, tier, rate) tuple that justified it. Cells with `rate < 0.05` keep the default `50` budget — they will be handled by descope/restore in TASK-004, not by lever 1.
- **Verification**: `npm test -- src/engine/generator/generate-for-difficulty.test.ts` passes. The `MAX_ATTEMPTS_BY_TIER` table values are explainable by the iteration-5 baseline data (each non-default entry traces to a specific cell). The doc-block does not reference "Iteration 3 §4.3" anywhere.

### TASK-004: Restore tiers in `VARIANT_TIERS` and refresh its doc-block
- **Status**: done
- **Type**: feat
- **Dependencies**: TASK-003
- **Description**: Implement requirements §7. For each (variant, tier) cell in the iteration-5 baseline `scripts/tier-distribution.summary.json` with `rate ≥ 0.05`, ensure `tier` is included in `VARIANT_TIERS[variant.id]` in `src/engine/generator/variant-tiers.ts`. Keep each per-variant tier list in `DIFFICULTY_ORDER` order. Rewrite the doc-block at the top of the file: cite the iteration-5 baseline by date; for any tier that **remains** descoped, list the (variant, tier, rate, sampleSize) tuple from the iteration-5 baseline as the rationale; for tiers that **were** descoped in iteration 4 but are restored now, do not enumerate them in the doc-block (the `VARIANT_TIERS` change itself is the evidence). If no tier is restored, this task is a no-op for `VARIANT_TIERS` itself but still rewrites the doc-block to cite iteration-5 evidence. **Breaking** field is intentionally omitted: `availableTiers` is internal API; the player surface change is forward-compatible (existing saves continue to load on tiers that were always advertised).
- **Verification**: `npm test -- src/engine/generator/variant-tiers` passes (existing tests). `npm test -- src/screens/Home.test.tsx` passes — restored tiers should now appear in the difficulty picker without breaking existing assertions. The `VARIANT_TIERS` doc-block does not reference "TASK-003" of iteration-4 anywhere.

### TASK-005: Add fixtures for any restored tiers
- **Status**: done
- **Type**: test
- **Dependencies**: TASK-004
- **Description**: Implement requirements §8. For each tier added to `VARIANT_TIERS` in TASK-004 that does not already have a `TIER_FIXTURES` entry: read `firstHitSeed` and `firstHitBoard` from the iteration-5 baseline `scripts/tier-distribution.summary.json` and add a `TierFixture` entry to `src/engine/solver/techniques/tier-fixtures.ts`. Use the variant whose cell first hit the target tier (typically `classic` if that's where the rate is highest). Keep the file's existing comment style. If no tier was restored in TASK-004, this task is a no-op.
- **Verification**: `npm test -- src/engine/solver/techniques/tier-fixtures.test.ts` passes. Every entry in `VARIANT_TIERS[v.id]` for any v has a corresponding key in `TIER_FIXTURES` (or, if a tier remains descoped in every variant, is omitted with a comment — same pattern as iteration 4).

### TASK-006: Add `solved === true` assertion to tier-fixtures round-trip
- **Status**: done
- **Type**: test
- **Dependencies**: TASK-005
- **Description**: Implement requirements §9. In `src/engine/solver/techniques/tier-fixtures.test.ts:46-49`, add `expect(result.solved).toBe(true)` alongside the existing `expect(result.difficulty).toBe(tier)` assertion. Two-line change. Closes review §Gap 3.
- **Verification**: `npm test -- src/engine/solver/techniques/tier-fixtures.test.ts` passes. Inspecting the test source shows both `difficulty` and `solved` are asserted in the round-trip loop.

### TASK-007: Re-run profile post-tuning and commit iteration-5 final snapshot
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-006
- **Description**: Implement requirements §10. Run `npm run profile-tiers -- --all-tiers --n=20` and commit the resulting `scripts/tier-distribution.md` and `scripts/tier-distribution.summary.json` (overwriting the TASK-002 baseline). This is the iteration-5 **final** snapshot, reflecting the state shipping with this iteration (post lever-1 widening, post any tier restorations). Verify that every cell now in `availableTiers(variant)` has `rate ≥ 0.05` in the new summary; if any restored tier dropped below 5% due to seed-range variance, revert that tier's restoration in `VARIANT_TIERS` and re-run.
- **Verification**: For every `(v, t)` such that `availableTiers(v).includes(t)`, the iteration-5 final `tier-distribution.summary.json` has `summary[`${v.id}:${t}`].rate >= 0.05`. The two iteration-5 commits of `scripts/tier-distribution.md` are visible in `git log scripts/tier-distribution.md`.

### TASK-008: Gate `__sudokuGameStore` behind `import.meta.env.DEV`
- **Status**: done
- **Type**: fix
- **Dependencies**: none
- **Description**: Implement requirements §11.1. In `src/main.tsx:14`, wrap the `(window as any).__sudokuGameStore = useGameStore` assignment in `if (import.meta.env.DEV) { … }`. The four E2E specs that read the hook (`hint-learn-more`, `new-game`, `notes-and-conflicts`, `resume`) all run against `vite dev`, where `DEV === true`, so they are unaffected. The `pwa-update` spec runs against `vite preview` (production build) and does not read the hook.
- **Verification**: `npm run build` succeeds, then `grep -r "__sudokuGameStore" dist/` returns no matches (the hook does not appear in production bundles). Run `npm test -- src/App.test.tsx` to confirm no regression in app initialization (the store assignment happens at module load and is exercised by the App test).

### TASK-009: Hide Stats filter pill row when `tiers.length <= 1`
- **Status**: done
- **Type**: fix
- **Dependencies**: none
- **Description**: Implement requirements §11.2. In `src/screens/Stats.tsx` (around lines 86-110, where the `[All] [Easy]` filter pill row is rendered per variant), wrap the pill-row JSX in a conditional that returns `null` (or omits the element) when the variant's `tiers.length <= 1`. The single-tier table renders without a useless filter row above it. Update or add a Vitest case in `src/screens/Stats.test.tsx` that asserts the pill row is *not* rendered for a variant with one tier, and *is* rendered for a variant with multiple tiers.
- **Verification**: `npm test -- src/screens/Stats.test.tsx` passes including the new case.

### TASK-010: Delete the placeholder real-worker vitest test
- **Status**: done
- **Type**: chore
- **Dependencies**: none
- **Description**: Implement requirements §11.3. Delete `src/workers/generator-client.real-worker.test.ts`. The actual real-worker smoke check is `tests/e2e/worker-smoke.spec.ts`, which remains. The placeholder test file currently asserts only that `Worker` is undefined under jsdom — misleading by appearance.
- **Verification**: The file no longer exists. `npm test` runs to completion (the deleted file was a placeholder; the unit test count drops by exactly one). `tests/e2e/worker-smoke.spec.ts` is still present (`ls tests/e2e/worker-smoke.spec.ts` succeeds).

### TASK-011: Bump package.json version
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-007, TASK-008, TASK-009, TASK-010
- **Description**: Bump `package.json` version. If TASK-004 restored any tier (i.e. `git diff master -- src/engine/generator/variant-tiers.ts` shows a change to `VARIANT_TIERS`'s tier lists, not just the doc-block), bump to `0.5.0` (minor — player-facing surface change). Otherwise bump to `0.4.1` (patch — methodology-fix + cleanups, no advertised surface change).
- **Verification**: `cat package.json | grep '"version"'` shows the new version. `npm run build` succeeds with the new version (Vite injects `__APP_VERSION__` at build time).

### TASK-012: Full unit-test sweep
- **Status**: done
- **Type**: test
- **Dependencies**: TASK-011
- **Description**: Run the full unit-test suite to confirm no regressions across the iteration's changes.
- **Verification**: `npm test` passes with zero failures.

### TASK-013: Type-check and production build sweep
- **Status**: done
- **Type**: test
- **Dependencies**: TASK-012
- **Description**: Run a clean type-check and production build to confirm no type-level regressions or build breaks.
- **Verification**: `npm run build` succeeds (the script runs `tsc -b && vite build`). The `dist/` directory contains a built `index.html` and asset bundles.

### TASK-014: Full E2E sweep on Chromium and WebKit
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-013
- **Description**: Run the full Playwright suite on both Chromium and WebKit to confirm the strict difficulty matrix passes for the (possibly larger) `availableTiers` set, and that the `__sudokuGameStore`-consuming specs still pass against `vite dev`.
- **Verification**: `npx playwright test --project=chromium && npx playwright test --project=webkit` both succeed with zero failures.
