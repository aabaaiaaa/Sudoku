# Sudoku PWA — Iteration 4 Requirements: Bug B fix + test gaps

This iteration is driven entirely by findings from the iteration 3 code
review (`.devloop/archive/iteration-3/review.md`). It is intentionally
tight: no new features, no UX changes the player will see, no
architectural refactors. The goal is to actually close out Bug B (which
iteration 3 declared mitigated but in fact left broken), to remove the
test loopholes that hid the breakage, and to fold in the small cleanups
the review explicitly recommended.

The v0.3.0 baseline is unchanged except where called out below. The
previous iteration's requirements, tasks, progress, and review are
archived at `.devloop/archive/iteration-3/`.

## 1. Motivation

The iteration 3 review identified one structural defect and a coupled
pair of test-coverage gaps that together meant the iteration shipped
with a known-broken generator path that automated tests could not catch:

1. **`maxClues` is plumbed with inverted semantics.** In
   `src/engine/generator/generate.ts:184-189`,
   `clueFloor = options.maxClues != null ? Math.max(minClues, maxClues)
   : minClues`. The consumer in `generateForDifficulty` passes
   `clueBoundsUpperForTier(tier)` as `maxClues` — so for Master classic
   with `CLUE_BOUNDS = [26, 31]`, the effective floor becomes **31**.
   The generator stops removing clues at 31 — leaving puzzles with the
   *most* clues a Master can have, which empirically rate much easier
   than Master. The strict-tier rule then rejects nearly every attempt.
   The parameter named `maxClues` is, by construction, used as a floor.
2. **Hard / Master generation has no automated coverage.** Two reinforcing
   gaps:
   - `generate-for-difficulty.test.ts:37-40` `it.skip`s the Hard and
     Master cases ("strict tier matching … cannot reliably hit these
     tiers within a sane retry budget").
   - `tests/e2e/difficulty-matrix.spec.ts:88-149` accepts a failure
     dialog with a populated `closestRating` and `lastError` as a
     passing outcome. So even if Master *never* generates, the matrix
     suite is green.
   Combined effect: iteration 3 reported the matrix as passing, which
   was true under the suite's contract — but the contract was lenient
   enough to mask a tier that simply does not generate.
3. **The catalog round-trip test is weaker than its TASK-042 spec
   intended.** `catalog.test.ts:100-126` only checks that each catalog
   entry's finder still returns non-null on its fixture, not that
   `rate(fixture.board).difficulty === entry.tier`. Fixture-tier drift
   slips through.

Beyond these three headline items, the review listed a small set of
cleanups that are individually small but worth bundling in this
iteration so the next one starts clean.

## 2. Goals

- Make every advertised (variant × difficulty) combination reliably
  load a playable puzzle within its budget — verified by both the unit
  suite and the matrix E2E, with no test-side leniency that could mask
  a tier that does not generate.
- Replace the inverted `maxClues` parameter with one that does what its
  name says.
- Use empirical profiling data — not guesswork — to tune the per-tier
  attempt budgets and clue-floor hints; commit the data so future
  iterations can diff against it.
- Strengthen the catalog round-trip so fixture-tier drift surfaces
  automatically.
- Apply the review's "smaller cleanups" so they stop being technical
  debt.

## 3. Non-goals

- No new techniques, no new variants, no new tiers. The 34-technique
  catalog and the Mini / Six / Classic variant set remain unchanged.
- No new player-facing UX. The Resume list, ConfirmDialog,
  GenerationFailedDialog, Stats filter pills, Settings sections, and
  desktop tab bar are all unchanged in shape.
- No architectural refactors. The catalog/cascade/rater triplication,
  the rater's parallel candidate-grid, the store-singleton split, and
  the `__APP_VERSION__` import are deferred to a later iteration.
- No fix for the `checkForUpdates` resolution-timing race
  (review Code Quality #2). The user-visible symptom is small (a brief
  "Up to date" while an update is downloading) and the proper fix
  needs a separate discussion of the SW state-machine timing — out of
  scope here.
- No CI E2E runs. The matrix suite remains a local pre-push gate; CI
  continues to run unit tests only.
- No automated migration of v3 save data. The save schema does not
  change.

## 4. Generator profiling harness

This is the foundational piece. Without empirical distribution data
the Bug B tuning in §6 reduces to guess-and-check against the matrix
E2E, which is slow and gives no insight into *why* a tweak helped.

### 4.1 Script location and invocation

- New file: `scripts/profile-tiers.ts`.
- New `package.json` script: `"profile-tiers": "tsx
  scripts/profile-tiers.ts"`. Add `tsx` as a `devDependency` if it is
  not already present.
- The script is intended to be run on demand by a developer. It is
  **not** wired into CI, vitest, or the Playwright suite.

### 4.2 What the harness does

For each variant in `['classic', 'six', 'mini']`:

- For each tier in `availableTiers(variant)`:
  - Compute `clueFloor = clueBoundsLowerForTier(variant, tier)`.
  - Generate **N puzzles** (default `N = 20`, accept a `--n=N`
    override on the command line) by calling `generate()` with that
    `clueFloor`, *without* the strict-tier filter (i.e. do not call
    `generateForDifficulty`). Each puzzle is rated via `rate()` and
    the resulting tier is recorded.
  - Seeds are derived from a fixed base (`seed = (variantIndex *
    1000) + (tierIndex * 100) + i`) so the run is reproducible.
  - For each (variant, target tier), the script also records the
    seed of the first puzzle whose rated tier matches the target —
    used by §9 as the source seed for tier fixtures.
- For each (variant, clueFloor), output the tier histogram: counts and
  percentages for each rated tier.

### 4.3 Output format

The script writes `scripts/tier-distribution.md`, overwriting any prior
content. The two iteration-4 commits of this file (baseline before §5,
post-tuning after §6) both live at the same path; the iteration's
empirical evidence is preserved in git history rather than as parallel
files. The file format is a header (variant, generator version, date,
total runtime) followed by one table per (variant, clueFloor):

```markdown
## classic — clueFloor=26 (Master.lower)

| Rated tier | Count | %     |
|------------|-------|-------|
| Easy       | 0     | 0.0%  |
| Medium     | 0     | 0.0%  |
| Hard       | 0     | 0.0%  |
| Expert     | 1     | 2.0%  |
| Master     | 4     | 8.0%  |
| Diabolical | 22    | 44.0% |
| Demonic    | 15    | 30.0% |
| Nightmare  | 8     | 16.0% |
```

The file is **checked in** so iteration-to-iteration changes show up
in git diffs. Alongside the markdown the script also writes
`scripts/tier-distribution.summary.json` — a flat object keyed
`${variantId}:${tierName}` with `{ rate: number, advertised: boolean,
sampleSize: number, firstHitSeed: number | null }`. `firstHitSeed`
is the seed of the first puzzle in the run that rated as the keyed
tier, or `null` if no run matched. The summary is the machine-readable
companion the §6 tuning task, §8 unskip task, and §9 fixture
extraction all consume.

### 4.4 Runtime budget

20 puzzles × 17 (variant, tier) cells ≈ 340 generations. At ~1 s
each on a typical developer machine this is ~6 minutes — fast enough
for an automated DevLoop task to invoke. The script must print
incremental progress so a developer running it does not think it has
hung. A human-driven thorough run (`npm run profile-tiers -- --n=50`)
remains available when more confident sample sizes are needed; this
is not the default.

## 5. Fix `maxClues` semantics

### 5.1 Rename the parameter

In `src/engine/generator/generate.ts`:

- Rename `GenerateOptions.maxClues` → `GenerateOptions.clueFloor`.
- The body computes `clueFloor = options.clueFloor ?? minClues`. The
  `Math.max(minClues, maxClues)` interaction goes away — there is now
  one floor, picked by the caller.
- `minClues` continues to default from `defaultMinClues(variant)` and
  serves as the variant's hard lower bound. Callers that want to
  override the variant default still set it.

### 5.2 Update the consumer

In `src/engine/generator/generate-for-difficulty.ts`:

- Replace the current `minClues` + `maxClues` plumbing with a single
  `clueFloor = clueBoundsLowerForTier(variant, targetTier)`.
- Drop `clueBoundsUpperForTier` calls in this file. The function is
  retained — it is used elsewhere in the catalog/UI surface — but the
  generator no longer asks for it.

### 5.3 Tests

- Update `generate-for-difficulty.test.ts` to expect the new option
  name on calls it makes.
- Update any direct `generate()` callers in the test suite.
- Add one tiny regression test in `generate.test.ts` that asserts
  `generate(variant, { clueFloor: N }).clueCount >= N` for a chosen
  N (e.g. classic with `clueFloor: 30`). This is a five-line guard
  that locks in the parameter's *semantics* — without it, a future
  refactor that re-inverts the floor would only be caught
  transitively via the §6 tuning, which depends on data and is
  noisier.

## 6. Tune Bug B from profiling output

After §4 and §5 land, the developer runs `npm run profile-tiers` and
inspects `scripts/tier-distribution.md`. For each (variant × tier)
where the histogram shows the rated tier appears in <5% of natural
attempts at the chosen `clueFloor`:

- **First lever — widen the per-tier attempt budget.** Update
  `MAX_ATTEMPTS_BY_TIER[tier]` to a value the histogram justifies. As
  a rule of thumb, if tier T is `p` percent of natural attempts at the
  current `clueFloor`, the budget needed for ~99.8% reliability is
  `N = ceil(log(0.002) / log(1 - p))`. Worked points: 5% → ~122
  attempts, 3% → ~205, 1% → ~620. Cap at 200 in practice — beyond
  that, fall to the second lever rather than spending huge attempt
  budgets on a too-rare tier.
- **Second lever — adjust `clueBoundsLowerForTier`.** If a tier is
  rare or absent at its current `clueFloor`, lower the floor (push
  the puzzle to fewer clues, which generally pushes the rated tier
  up) and re-profile. The bounds in `CLUE_BOUNDS` define the legal
  range; this lever stays inside that range.
- **Third lever — descope the tier from the variant.** If profiling
  shows that no `clueFloor` inside `CLUE_BOUNDS[tier]` produces the
  tier at usable rate, the tier is genuinely unobtainable for that
  variant. In that case, remove the tier from
  `availableTiers(variant)` so it is not advertised to the player.
  This is the documented escape hatch — it ships a smaller but
  honest set of options rather than a tier that does not work.
- After tuning, re-run `npm run profile-tiers` and commit the
  updated `tier-distribution.md`.

The tuning is data-driven: the changes to `MAX_ATTEMPTS_BY_TIER` and
`clueBoundsLowerForTier` should each cite the histogram entry that
justified them in their commit message or comment.

## 7. Tighten the matrix E2E

`tests/e2e/difficulty-matrix.spec.ts`:

- The "either board renders or failure-dialog-with-diagnostic" race
  becomes "board must render". Failure-with-diagnostic is now a hard
  failure.
- Concretely: the `expect.poll` waits for `[data-testid=sudoku-board]`
  to be visible and asserts at least one given cell renders, exactly
  as the success path does today. Any failure dialog is treated as
  test failure (assert it is **not** visible at the end).
- The TASK-049 narrative comment in the file header is rewritten to
  reflect the new contract. The "decision rule when failures appear"
  block becomes "if failures appear, profile and tune per §6 of
  iteration-4 requirements."
- Per-tier timeout stays at 75 s.

If §6 has been done correctly, this stricter matrix passes on both
Chromium and WebKit. If a tier was descoped via the §6 third lever,
the matrix iterates over the new (smaller) `availableTiers` and the
descoped slot does not appear.

## 8. Un-skip Hard / Master in unit tests

`src/engine/generator/generate-for-difficulty.test.ts:37-40` gates
skipped tiers via a `SKIPPED_TIERS = new Set<Difficulty>(['Hard',
'Master'])` followed by `const runner = SKIPPED_TIERS.has(tier) ?
it.skip : it`.

- Empty the set: `SKIPPED_TIERS = new Set<Difficulty>([])`.
- After §6 tuning, the strict tier rule should hit Hard and Master
  inside their (possibly widened) per-tier budget. Update the
  `TIER_SEEDS` table with the `firstHitSeed` values recorded by
  profiling for `classic:Hard` and `classic:Master` so the test is
  deterministic.
- If, after tuning, a specific (variant, tier) is still flaky inside
  the test's `maxRetries: 80` budget, fall back to a `vi.spyOn`
  mock that returns a matching `RateResult` so the strict-tier
  acceptance path is still exercised, and add a comment explaining
  why the seed-based approach was insufficient.

## 9. Catalog round-trip — tier fixtures

The existing per-finder fixtures are inlined into `catalog.ts` as
`entry.fixture.board` strings (parsed via `parseBoardString(variant,
boardString)` at test time). They are mid-game one-step demos used by
per-finder unit tests, and rewriting all 34 to fully-solvable puzzles
is out of scope.

Instead:

- New file: `src/engine/solver/techniques/tier-fixtures.ts`. Exports a
  `TIER_FIXTURES: Record<Difficulty, { variant: VariantId; board:
  string; seed: number }>` table — one entry per tier. The `board`
  string follows the same dot-and-digit convention as the catalog
  fixtures so it parses through `parseBoardString`. Keeping the
  fixtures in TypeScript (not JSON) means no JSON-loading dance in
  vitest and the table is comprehensible at a glance.
- Each entry is a fully-solvable puzzle whose hardest required
  technique is exactly the named tier. Construction is data-driven:
  pick a seed that profiling shows produces the desired tier (the
  seed is recorded in `scripts/tier-distribution.summary.json`'s
  per-(variant, tier) `firstHitSeed` field), regenerate the puzzle
  locally with that seed and `clueFloor`, and capture its givens
  string.
- New test file: `src/engine/solver/techniques/tier-fixtures.test.ts`.
  For each entry, parse the board and assert `rate(board).difficulty
  === tier` and `rate(board).solved === true`.
- **Tier unobtainable in any variant.** If profiling shows that a
  tier is unreachable in every variant after §6 tuning (no
  `firstHitSeed` recorded), omit the fixture and add a brief comment
  in `tier-fixtures.ts` explaining the omission. The round-trip test
  iterates `Object.entries(TIER_FIXTURES)` so missing tiers are
  silently skipped — but the omission is visible at code-review time.
- The existing finder-fixture round-trip stays as it is.

## 10. Smaller cleanups

These are small, independent items pulled directly from the
review's "Smaller cleanups" list and from coverage gaps that have
single-task fixes:

### 10.1 `lastError != null` defensive check

`src/components/GenerationFailedDialog.tsx:124` currently renders the
diagnostic line on `failure.lastError` truthy. Switch to
`failure.lastError != null` so an `Error('')` (empty message) still
renders the line. The user-direction in iteration 3 was "always
visible when present" — the truthy check inadvertently swallows
empty-string errors.

### 10.2 `cancelGeneration` clears `generationFailure`

`src/store/game.ts` `cancelGeneration` action: defensively clear
`generationFailure` alongside the existing `loading: false` reset.
Closes the low-probability race where a player cancels from the
loading overlay at the exact moment the worker posts `failed`,
leaving a stale `generationFailure` in the store after navigation.

### 10.3 Worker one-at-a-time JSDoc

`src/workers/generator-client.ts` — add JSDoc on `generateInWorker`
documenting that callers must serialize requests; the worker rejects
overlapping `generate` messages with a `'Worker is already
processing a generation request'` error. The `gameStore.newGame` flow
already serializes; the docstring exists to flag the contract for
any future direct caller.

### 10.4 Migration test seeds structurally-valid v2

`src/App.test.tsx:128` currently seeds
`localStorage['sudoku.save.v2'] = '{}'`. Replace with
a structurally valid v2 payload (matching the v2 schema shape). The
detector matches on key, not value, so the test passes either way —
but a future change in the schema-load path that JSON-parses v2
entries before the detector runs would silently still pass with `{}`.

### 10.5 Settings 2-second auto-revert assertion

`Settings.test.tsx` for the "Updates" section: after the button
shows "Up to date" or "Couldn't check — try again", advance fake
timers by 2 seconds (`vi.useFakeTimers` + `vi.advanceTimersByTime`)
and assert the label reverts to "Check for updates". Locks in the
revert behaviour so a regression there cannot slip past the suite.

### 10.6 Real-worker smoke test

New `src/workers/generator-client.real-worker.test.ts` (or similar):
construct the real `Worker` via `defaultCreateWorker`, fire a
`generate` request for a small board, immediately `cancel()`, and
assert the call resolves cleanly. The intent is to lock in the
`new Worker(new URL('./generator.worker.ts', import.meta.url),
{ type: 'module' })` plumbing in `defaultCreateWorker` — the
existing `generator-client.test.ts` uses a FakeWorker so a regression
in the import URL would only surface via the matrix E2E. Vitest's
`environment: 'jsdom'` may need a per-file override to allow real
worker construction; if jsdom cannot host it, fall back to a
Playwright smoke check that loads the app and listens for a
generate-progress event.

## 11. Existing code to update

Non-exhaustive list of files this iteration touches beyond the new
ones:

- `src/engine/generator/generate.ts` — rename `maxClues` →
  `clueFloor`; remove `Math.max(minClues, maxClues)` interaction.
- `src/engine/generator/generate-for-difficulty.ts` — pass
  `clueFloor` only; drop `clueBoundsUpperForTier` call; possibly
  widen `MAX_ATTEMPTS_BY_TIER` per profiling.
- `src/engine/generator/variant-tiers.ts` (or wherever
  `clueBoundsLowerForTier` / `availableTiers` live) — possibly
  adjust per profiling; possibly remove a tier from a variant's
  `availableTiers` list (third lever).
- `src/components/GenerationFailedDialog.tsx` — `lastError != null`.
- `src/store/game.ts` — `cancelGeneration` clears
  `generationFailure`.
- `src/workers/generator-client.ts` — JSDoc.
- `tests/e2e/difficulty-matrix.spec.ts` — strict-success contract;
  rewrite header narrative.
- `src/engine/generator/generate-for-difficulty.test.ts` — un-skip
  Hard/Master; embed seeds.
- `src/engine/solver/techniques/tier-fixtures.ts` — new file holding
  the `TIER_FIXTURES` table.
- `src/engine/solver/techniques/tier-fixtures.test.ts` — new file
  for the tier-fixture round-trip.
- `src/screens/Settings.test.tsx` — 2-second auto-revert assertion.
- `src/App.test.tsx` — structurally-valid v2 payload seed.
- `package.json` — `profile-tiers` script; `tsx` devDependency if
  not present; bump version to 0.4.0.
- `.devloop/archive/iteration-3/` — created during DevLoop's
  archive step.

## 12. Testing strategy

- **Unit**: rename test of `clueFloor`; un-skipped Hard/Master cases
  in `generate-for-difficulty.test.ts`; new `tier-fixtures` round-trip;
  Settings 2-second auto-revert; structurally-valid v2 migration
  seed; real-worker smoke test.
- **E2E (local pre-push, Chromium + WebKit)**: tightened matrix
  asserts board-only success; existing desktop-nav, slow-generate,
  and PWA-update specs unchanged. The matrix becomes the canonical
  Bug B regression guard.
- **Profiling**: `npm run profile-tiers` is run twice — once before
  §5–§6 to capture the baseline, once after §6 tuning to capture the
  state shipping with v0.4.0. Both runs commit `tier-distribution.md`
  so the iteration's empirical evidence is in the repo.

## 13. Edge cases and failure modes

- **Profiling reveals an unobtainable tier.** Mitigation is the §6
  third lever: drop the tier from `availableTiers(variant)`. Document
  the descope in the commit and in `tier-distribution.md` notes.
- **Profiling runtime overshoots 10 minutes.** Re-run with `--n=10`.
  Histograms remain meaningful at smaller N — the rates simply have
  wider confidence intervals.
- **Hard/Master remain flaky in unit tests after §6.** Fall back to
  the `vi.spyOn` mock approach in §8 — the strict-tier acceptance
  path still gets exercised, just without exercising the rater's
  real distribution at unit scope. Note this explicitly in the test
  file's comment.
- **Tier fixture construction is too painful by hand.** This is the
  intended path: profiling already records `firstHitSeed` per
  (variant, tier) in `tier-distribution.summary.json`; the §9
  extraction reads that file, regenerates the puzzle, and writes
  the entry into `tier-fixtures.ts`. Hand-authoring is only needed
  if profiling produces no hit anywhere — which is the §9
  unobtainable-tier escape.
- **Real-worker smoke test fails under jsdom.** Use the Playwright
  fallback path described in §10.6.
- **`maxClues` rename touches generated TypeScript types.** No
  external callers exist — `GenerateOptions` is internal — so the
  rename is a single-pass `replace_all` plus tests.

## 14. Success criteria

- `scripts/tier-distribution.md` is checked in with two snapshots
  visible in the iteration's commit history: the baseline (before
  §5/§6 changes) and the post-tuning state.
- `GenerateOptions` no longer carries a `maxClues` field; `clueFloor`
  is the single floor parameter and its semantics match its name.
- The matrix E2E passes on Chromium and WebKit with the strict
  "board must render" contract for every advertised tier in every
  variant.
- `generate-for-difficulty.test.ts` no longer `it.skip`s Hard or
  Master.
- Tier-fixture round-trip asserts `rate(fixture.board).difficulty
  === tier` for every tier in `TIER_FIXTURES` and passes. If §6
  third-lever escape was used to descope a tier from every variant,
  that tier is omitted from `TIER_FIXTURES` (with a comment) and
  the round-trip simply does not iterate it.
- The `GenerationFailedDialog` diagnostic line renders when
  `lastError` is any defined value, including the empty string.
- `cancelGeneration` clears `generationFailure`.
- `generateInWorker`'s JSDoc documents the one-at-a-time contract.
- The migration test seeds a v2 payload that would parse under the
  v2 schema.
- The Settings 2-second auto-revert is asserted under fake timers.
- The real-worker smoke test runs as part of the unit suite (or, if
  unavoidable, as a single Playwright test).
- No regressions in v0.3.0 functionality — existing E2E (desktop nav,
  slow-generate, PWA update) and unit suites still pass.
- `package.json` version is bumped to 0.4.0.
