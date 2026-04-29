# Iteration 6 Tasks

See `.devloop/requirements.md` for full context. Tasks are sized for
~10–20 minute automated execution; dependencies run sequentially.

### TASK-001: Add `solvedRate` to profile-tiers.ts and refresh header docblock
- **Status**: done
- **Type**: refactor
- **Dependencies**: none
- **Description**: In `scripts/profile-tiers.ts`, extend `SummaryEntry`
  with a `solvedRate: number` field (rated as target tier AND
  `result.solved === true`). Retain the existing `rate` field
  (rated as target only) for diagnostic comparison. Track
  `firstHitSeed` / `firstHitBoard` against the solved-aware hit
  (the production code path rejects unsolved ratings, so these
  fields must point to puzzles production would accept). Also add a
  `Solved` and `Solved %` column to the per-cell histogram in
  `scripts/tier-distribution.md`. Refresh the file-level header
  docblock at lines 1–18 to cite iteration-6 work and drop the
  iteration-3 §4.2/§4.3 references. See requirements §4.1, §4.2,
  §4.3.
- **Verification**: `npx tsx scripts/profile-tiers.ts --n=1` exits
  cleanly. Open `scripts/tier-distribution.summary.json` and confirm
  every cell has both `rate` and `solvedRate` numeric fields. Open
  `scripts/tier-distribution.md` and confirm the histogram tables
  include `Solved` and `Solved %` columns.

### TASK-002: Add `--out` and `--clue-floor-override` flags to profile-tiers.ts
- **Status**: done
- **Type**: feat
- **Dependencies**: none
- **Description**: In `scripts/profile-tiers.ts`, add two CLI flags.
  (a) `--out=<basename>` — when present, the script writes
  `scripts/<basename>.md` and `scripts/<basename>.summary.json`
  instead of the canonical `tier-distribution` filenames. (b)
  `--clue-floor-override=variant:tier:N` (fully repeatable,
  including the same `variant:tier` at different N values) — each
  occurrence adds a synthetic profile cell at exactly that floor.
  Synthetic cells do not require an entry in
  `CLUE_BOUNDS[variant][tier]`. When at least one
  `--clue-floor-override` is present, the script profiles **only**
  the overridden cells (the canonical loop driven by `--all-tiers` /
  advertised tiers is suppressed). Synthetic cells are keyed in
  the summary JSON as `${variant}:${tier}@${floor}` (e.g.
  `six:Medium@14`); the markdown emit uses the same key in section
  headers. The `advertised` field still reflects
  `availableTiers(variant)`. See requirements §4.4, §4.5.
- **Verification**: `npx tsx scripts/profile-tiers.ts --n=1
  --out=smoke-test --clue-floor-override=six:Medium:14
  --clue-floor-override=six:Medium:16` exits cleanly and produces
  `scripts/smoke-test.summary.json` containing both
  `six:Medium@14` and `six:Medium@16` keys with numeric
  `solvedRate`. Delete the smoke output files after verifying.

### TASK-003: Add TIMEOUT_MS_BY_TIER infrastructure
- **Status**: done
- **Type**: refactor
- **Dependencies**: none
- **Description**: In `src/engine/generator/generate-for-difficulty.ts`,
  add a `TIMEOUT_MS_BY_TIER: Record<Difficulty, number>` table
  alongside `MAX_ATTEMPTS_BY_TIER`. Initial values: every tier set
  to `DEFAULT_TIMEOUT_MS` (60_000). In the `generateForDifficulty`
  body, replace the timeout source so it reads
  `TIMEOUT_MS_BY_TIER[difficulty] ?? DEFAULT_TIMEOUT_MS` instead of
  the bare `DEFAULT_TIMEOUT_MS` (when `options.timeoutMs` is not
  set). Add a doc-block above `TIMEOUT_MS_BY_TIER` describing its
  role. This task only adds the plumbing — TASK-006 sets the
  recalibrated values. See requirements §6.
- **Verification**: `npx vitest run
  src/engine/generator/generate-for-difficulty` passes.

### TASK-004: Add regression test for `solved=false` reject branch
- **Status**: done
- **Type**: test
- **Dependencies**: none
- **Description**: Add a vitest test (in
  `src/engine/generator/generate-for-difficulty.test.ts` or a sibling
  if that file is dense) that pins the `if (!rating.solved) continue;`
  branch in `generateForDifficulty`. Approach: use `vi.spyOn` on
  `rate` from `../rate` to return
  `{difficulty: 'Easy', solved: false}` for the first call and
  `{difficulty: 'Easy', solved: true}` for the second. Call
  `generateForDifficulty(classicVariant, 'Easy', { seed: 0 })` and
  assert the result is `kind: 'success'` AND `attempts === 2`. Add a
  second case where `rate` always returns `{solved: false}` and
  assert `kind: 'failed'` with `attempts === maxRetries`. See
  requirements §8.
- **Verification**: `npx vitest run
  src/engine/generator/generate-for-difficulty` passes including the
  two new cases.

### TASK-005: Re-run profile and commit corrected baseline
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-001
- **Description**: Run `npm run profile-tiers -- --all-tiers --n=20`.
  Commit the resulting `scripts/tier-distribution.md` and
  `scripts/tier-distribution.summary.json` as the iteration-6
  corrected post-fix baseline. This snapshot is the input for
  TASK-006 (budget recalibration) and TASK-007 (fixture updates).
  See requirements §5.
- **Verification**: `scripts/tier-distribution.summary.json` exists
  and every cell has both `rate` and `solvedRate` fields. `git diff
  scripts/tier-distribution.summary.json` shows the new `solvedRate`
  values vs the iteration-5 file.

### TASK-006: Recalibrate MAX_ATTEMPTS_BY_TIER and TIMEOUT_MS_BY_TIER
- **Status**: done
- **Type**: feat
- **Dependencies**: TASK-003, TASK-005, TASK-009
- **Description**: Read `scripts/tier-distribution.summary.json`
  (corrected baseline) **and**
  `scripts/tier-distribution.lever2.summary.json` (lever-2 sweep,
  for any cell restored in TASK-009). For each tier with at least
  one advertising cell of `solvedRate > 0`, compute required
  attempts via `N = ceil(log(0.002) / log(1 - solvedRate))` and
  take the maximum N across all advertising cells (worst-case cell
  drives the budget — including any cell restored via lever-2 at a
  lowered floor). Set `MAX_ATTEMPTS_BY_TIER[tier]` to that N.
  **No upper cap.** For `TIMEOUT_MS_BY_TIER[tier]`, set to roughly
  `attemptCap × 2000ms × 1.5` (per-attempt headroom). Round both up
  conservatively. Refresh both doc-blocks to cite iteration-6
  evidence: list non-default entries with the (variant, tier,
  solvedRate) tuple that drove them; if the driver is a lever-2
  cell, cite the (variant, tier, floor, solvedRate). Tiers with no
  advertised cell keep the default 50 / 60_000. See requirements §6.
- **Verification**: `npx vitest run
  src/engine/generator/generate-for-difficulty` passes. The
  doc-blocks above `MAX_ATTEMPTS_BY_TIER` and `TIMEOUT_MS_BY_TIER`
  cite iteration-6 by date and list the driving (variant, tier,
  solvedRate) tuples for each non-default entry.

### TASK-007: Update Diabolical/Demonic fixtures and refresh tier-fixtures docblock
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-005
- **Description**: Read `scripts/tier-distribution.summary.json`
  (corrected baseline). For each existing entry in `TIER_FIXTURES`
  (in `src/engine/solver/techniques/tier-fixtures.ts`), replace the
  `seed` and `board` values with the new `firstHitSeed` /
  `firstHitBoard` from the corrected baseline keyed by the
  fixture's variant and tier. Diabolical and Demonic in particular
  should pick up new seeds (they were hand-scanned in iteration-5).
  Tiers that don't have an existing entry (Hard, Master) stay
  omitted; lever-2 restorations get new entries via TASK-009.
  Remove the block-level comment at `tier-fixtures.ts:43-47` (the
  iteration-5 hand-scan explanation) — it's no longer applicable.
  Restore the file-level docblock at `:11-21` to its
  summary-traceable model ("we reuse the firstHitSeed recorded in
  scripts/tier-distribution.summary.json after iteration-6
  tuning"). See requirements §7.
- **Verification**: `npx vitest run
  src/engine/solver/techniques/tier-fixtures` passes. `git diff
  src/engine/solver/techniques/tier-fixtures.ts` shows the seed and
  board values for advertised tiers updated and the block-level
  comment removed.

### TASK-008: Run lever-2 exploration sweep for Six and Mini
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-001, TASK-002
- **Description**: Run a single invocation of
  `npm run profile-tiers -- --n=20
  --out=tier-distribution.lever2` with one
  `--clue-floor-override=variant:tier:N` flag for each cell in the
  §9 search space (14 cells total):

  - `--clue-floor-override=six:Medium:14`,
    `--clue-floor-override=six:Medium:16`
  - `--clue-floor-override=six:Hard:11`,
    `--clue-floor-override=six:Hard:13`
  - `--clue-floor-override=six:Expert:8`,
    `--clue-floor-override=six:Expert:10`
  - `--clue-floor-override=six:Master:9`,
    `--clue-floor-override=six:Master:11`
  - `--clue-floor-override=six:Diabolical:7`,
    `--clue-floor-override=six:Diabolical:9`
  - `--clue-floor-override=mini:Medium:6`,
    `--clue-floor-override=mini:Medium:8`
  - `--clue-floor-override=mini:Hard:5`,
    `--clue-floor-override=mini:Hard:7`

  Per TASK-002, the override flag suppresses the canonical loop, so
  only these 14 cells are profiled. Approximate runtime: ~5–10
  minutes. Commit the resulting
  `scripts/tier-distribution.lever2.md` and
  `scripts/tier-distribution.lever2.summary.json`. See requirements
  §9.
- **Verification**: `scripts/tier-distribution.lever2.summary.json`
  exists and contains all 14 keys
  (`six:Medium@14`, `six:Medium@16`, … `mini:Hard@7`) with numeric
  `solvedRate` and `sampleSize === 20` for each.

### TASK-009: Apply lever-2 restorations
- **Status**: done
- **Type**: feat
- **Dependencies**: TASK-008
- **Description**: Read
  `scripts/tier-distribution.lever2.summary.json`. For each
  (variant, tier) cell where some floor produced `solvedRate ≥ 0.05`,
  pick the **highest** qualifying floor. (1) Lower
  `CLUE_BOUNDS[variant][tier][0]` in `src/engine/generator/rate.ts`
  to that floor, keeping the upper bound unchanged. (2) Add `tier`
  to `VARIANT_TIERS[variant]` in
  `src/engine/generator/variant-tiers.ts`, in `DIFFICULTY_ORDER`
  order. (3) Add a `TIER_FIXTURES` entry in
  `src/engine/solver/techniques/tier-fixtures.ts` using the lever-2
  `firstHitSeed` / `firstHitBoard`. If no cell qualifies, this task
  is a no-op (but document the negative result in the verification
  output for TASK-010). See requirements §9.
- **Verification**: `npx vitest run src/engine/solver/techniques`
  passes. `npx vitest run src/engine/generator` passes. If any
  restoration was applied, `git diff` shows changes in `rate.ts`,
  `variant-tiers.ts`, and `tier-fixtures.ts`. If no restoration was
  applied, `git status` is clean for these three files.

### TASK-010: Refresh variant-tiers.ts docblock
- **Status**: done
- **Type**: docs
- **Dependencies**: TASK-005, TASK-008, TASK-009
- **Description**: Rewrite the doc-block above `VARIANT_TIERS` in
  `src/engine/generator/variant-tiers.ts`. Cite the iteration-6
  corrected baseline by date. For each tier still descoped, cite
  the (variant, tier, solvedRate, sampleSize) from the corrected
  baseline. For each tier restored via lever-2, cite the (variant,
  tier, floor, solvedRate) from the lever-2 summary. List the
  lever-2 sweep ranges that were explored (so future iterations
  know what was already tried) — even if no restoration occurred,
  this records the negative result. See requirements §10.
- **Verification**: `npx vitest run
  src/engine/generator/variant-tiers` passes (no behavior change in
  this task, just documentation). `git diff
  src/engine/generator/variant-tiers.ts` shows the doc-block
  updated to cite iteration-6 evidence.

### TASK-011: Re-run final profile and commit iteration-6 final snapshot
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-006, TASK-007, TASK-009
- **Description**: Run `npm run profile-tiers -- --all-tiers --n=20`
  to capture the final state shipping with iteration 6 (post budget
  recalibration, post fixture update, post any lever-2
  restorations). Commit the resulting
  `scripts/tier-distribution.md` and
  `scripts/tier-distribution.summary.json` as the iteration-6 final
  snapshot. If any restored tier's final-snapshot `solvedRate` is
  below 0.05, revert that tier's restoration (in `rate.ts`,
  `variant-tiers.ts`, and `tier-fixtures.ts`) before committing
  this snapshot. See requirements §11.
- **Verification**: `scripts/tier-distribution.summary.json` exists
  and reflects the post-tuning state. Every advertised tier in
  `availableTiers` has `solvedRate ≥ 0.05` in the snapshot.

### TASK-012: Bump package.json to 0.5.0
- **Status**: done
- **Type**: chore
- **Dependencies**: TASK-011
- **Description**: Bump the version field in `package.json` from
  `0.4.1` to `0.5.0`. Minor bump signals the player-visible
  reliability/latency change from the recalibrated budgets and any
  lever-2 tier restorations.
- **Verification**: `node -p "require('./package.json').version"`
  prints `0.5.0`.

### TASK-013: Full unit-test sweep
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-012
- **Description**: Run the full vitest unit-test suite to confirm no
  regressions in v0.4.1 functionality. See requirements §13.
- **Verification**: `npx vitest run` passes with zero failures.

### TASK-014: Type-check and production build sweep
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-012
- **Description**: Run TypeScript type-check across the project and
  produce a clean production build. See requirements §13.
- **Verification**: `npx tsc --noEmit` exits 0 and `npm run build`
  exits 0.

### TASK-015: Full E2E sweep on Chromium and WebKit
- **Status**: pending
- **Type**: test
- **Dependencies**: TASK-012
- **Description**: Run the Playwright E2E suite on both Chromium and
  WebKit. The strict matrix
  (`tests/e2e/difficulty-matrix.spec.ts`) iterates the new
  `availableTiers(variant)` so any tiers restored via lever-2 are
  exercised here. If a restored tier fails the strict matrix, that
  tier's restoration must be reverted (treat as a regression
  signal — it indicates the lever-2 budget sizing was insufficient
  in practice). See requirements §13.
- **Verification**: `npx playwright test --project=chromium` exits 0
  and `npx playwright test --project=webkit` exits 0.
