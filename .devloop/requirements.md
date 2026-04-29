# Sudoku PWA — Iteration 6 Requirements: close the methodology gap, recalibrate budgets, explore lever-2

This iteration is driven entirely by the iteration-5 final code review
(`.devloop/archive/iteration-4/review.md`). It addresses the four
"before production" recommendations from §4 of that review, plus the
exploratory lever-2 follow-up from §5.2.

The headline item is **C1**: `scripts/profile-tiers.ts` does not
require `result.solved === true` when counting a tier hit. The
production code path
(`src/engine/generator/generate-for-difficulty.ts:230-233`) explicitly
rejects unsolved ratings before strict-tier comparison, so the rates
in `scripts/tier-distribution.summary.json` are biased upward and
the `MAX_ATTEMPTS_BY_TIER` budgets the iteration-5 lever-1 sized
against those rates are likely under-budgeted. Direct empirical
evidence: the iteration-5 verification commit (`5431915`) had to
hand-scan forward from the baseline `firstHitSeed` for both Diabolical
(502 → 504) and Demonic (600 → 612) because the originals rated
correctly but stalled the rater. That divergence is the load-bearing
gap the iteration-5 reliability claim rests on.

The v0.4.1 baseline is unchanged except where called out below.
Iteration 5's requirements, tasks, progress, and review are archived
at `.devloop/archive/iteration-4/`.

## 1. Motivation

The iteration-5 review confirmed every named §11 cleanup landed and
that the `--all-tiers` profile sweep produced the post-fix evidence
iteration 4 should have produced. But the review surfaced a
methodology gap underneath the lever-1 widening decisions:

1. **Profile counter biased upward.** `profile-tiers.ts:140-148`
   counts a hit on `result.difficulty === tier` alone. Production
   rejects unsolved ratings. The reported rates in
   `tier-distribution.summary.json` therefore include puzzles
   production would refuse, and the `MAX_ATTEMPTS_BY_TIER` budgets
   sized against those rates are likely too small. The 5% threshold
   that drives the lever-1-vs-lever-3 decision is itself
   non-rigorous under this counter.

2. **Tier-fixtures docblock is empirically inaccurate.** The
   verification commit replaced the iteration-5 baseline `firstHitBoard`
   for Diabolical and Demonic with hand-scanned solved-aware seeds.
   The file-level docblock at `tier-fixtures.ts:11-21` still claims
   "we reuse the firstHitSeed recorded in
   scripts/tier-distribution.summary.json" — this is now technically
   inaccurate for those two entries. A block-level note at
   `tier-fixtures.ts:43-47` makes the divergence visible locally,
   but the file-level docblock contradicts the code.

3. **Profile-tiers.ts file header is stale.** The header docblock
   at `profile-tiers.ts:1-18` still references "iteration 3 manual
   testing" and "requirements §4.2 (rater hardening) and §4.3
   (per-tier attempt budgets)" — those are iteration-3 section
   numbers, not iteration-5 §4. The script body was correctly
   refreshed in iteration 5 but the header was not.

4. **No regression guard for the `solved=false` reject branch.**
   The `if (!rating.solved) continue;` branch added in iteration 4
   (review T3) is exercised indirectly by the strict-tier tests, but
   no test explicitly pins the contract. Given the role this branch
   played in the iteration-5 verification fix, a small spy-based test
   would harden the guarantee.

Beyond the four review recommendations, §5.2 ("Player-facing tier
coverage") observed that Six and Mini still ship only Easy and
suggested an exploratory lever-2 pass — try lowering `clueFloor`
below the current `CLUE_BOUNDS` lower bound and re-profile to see
if any non-Easy tiers become reachable. The current `CLUE_BOUNDS`
bounds for Six and Mini are heuristic and may not be optimal for
small grids. A few hours of profile-tiers exploration at lower
floors is cheap and could rescue real player-facing tier coverage.

## 2. Goals

- Fix the methodology gap in `profile-tiers.ts` so the reliability
  claim in `MAX_ATTEMPTS_BY_TIER`'s docblock is statistically backed.
- Re-calibrate `MAX_ATTEMPTS_BY_TIER` against the corrected
  `solvedRate` data using the §6 reliability formula. Add a
  `TIMEOUT_MS_BY_TIER` table so attempt cap (not wall clock) is the
  limiting factor for hard tiers.
- Re-trace the tier-fixtures docblock back to the
  `tier-distribution.summary.json` source-of-truth model.
- Add a regression test pinning the `solved=false` reject branch.
- Run a single exploratory lever-2 pass at lower clueFloors for Six
  and Mini and act on the result: if `solvedRate ≥ 5%` is found at a
  lowered floor, restore that tier in `VARIANT_TIERS` and lower
  `CLUE_BOUNDS[variant][tier][0]` accordingly. If nothing crosses 5%,
  document the negative result.

## 3. Non-goals

- No new techniques, no new variants, no new tiers. The 34-technique
  catalog is unchanged. The lever-2 exploration may *restore*
  existing-but-descoped tiers in Six/Mini; it does not add tiers
  that don't already appear in `DIFFICULTY_ORDER`.
- No rater changes. The rater chain is untouched.
- No architectural refactors. The candidate-grid duplication in
  `rate.ts`, the `slotKey` asymmetry between `save.ts` and
  `stats.ts`, the `__APP_VERSION__` ambient typing, and unifying
  `availableTiers` / `CLUE_BOUNDS` are all deferred.
- No fix for the `useUpdate.checkForUpdates` resolution-timing race —
  still out of scope (review §5.1 deferral carried forward).
- No CI E2E runs. Local pre-push gate only.
- No save-schema migration changes. v3 is unchanged.
- No upper sanity ceiling on attempt budgets. The user has signed
  off on long generation latencies for hard tiers in exchange for
  retaining the player surface; the existing progress spinner and
  cancel affordance handle the UX.

## 4. Profile script changes

Three independent edits in `scripts/profile-tiers.ts`. They land in
the same iteration but can be split across tasks for cleaner per-task
commits.

### 4.1 Record both `rate` and `solvedRate`

Currently `matchCount` is incremented when `rated === tier`. After
this change `matchCount` becomes `matchCountRated` (rated as target,
regardless of solved) and a new `matchCountSolved` counts only
`rated === tier && result.solved`. The `firstHit*` fields track the
solved-aware hit (so `firstHitSeed`/`firstHitBoard` always point to
a puzzle the production path would accept).

The `SummaryEntry` shape becomes:

```ts
interface SummaryEntry {
  rate: number;          // rated as target, including unsolved (diagnostic)
  solvedRate: number;    // rated AND solved=true (load-bearing)
  advertised: boolean;
  sampleSize: number;
  firstHitSeed: number | null;   // first solved-aware hit
  firstHitBoard: string | null;  // first solved-aware hit
}
```

The pre-fix `rate` is retained alongside `solvedRate` so the
divergence remains visible. If a future iteration drifts back into
the same gap, the JSON will show it directly (e.g. `rate=0.20`
and `solvedRate=0.07` is the divergence the iteration-5 review
predicted).

### 4.2 Add a "Solved" column to the markdown histogram

The current per-cell markdown table is:

```
| Rated tier | Count | %     |
```

After this change:

```
| Rated tier | Count | %     | Solved | Solved % |
```

Where `Solved` is `count of rated-as-tier AND solved=true` and
`Solved %` is `Solved / sampleSize * 100`. Same row order, same
denominator. The solved column makes the methodology gap visible
to a human reader of `tier-distribution.md` without requiring them
to open the JSON.

### 4.3 Refresh the file-level header docblock

`scripts/profile-tiers.ts:1-18` is rewritten to:

- Drop the "iteration 3 manual testing" and "requirements §4.2/§4.3"
  language.
- Cite iteration-5 §4 (the `--all-tiers` and `firstHitBoard`
  additions) and iteration-6 §4 (the `solvedRate` and
  `--clue-floor-override` additions).
- Note that `solvedRate` is the load-bearing rate and `rate`
  is retained for diagnostic comparison.

### 4.4 Add `--clue-floor-override=variant:tier:N` (repeatable)

For lever-2 exploration we need to profile at floors below
`CLUE_BOUNDS[variant][tier][0]` without permanently editing
`CLUE_BOUNDS`, including multiple floors per cell in a single
invocation. The flag is fully repeatable — including with the same
(variant, tier) at different N — and each occurrence adds a
synthetic profile cell at exactly that floor. Synthetic cells do
not require an entry in `CLUE_BOUNDS[variant][tier]` (they bring
their own floor).

When at least one `--clue-floor-override` is present, the script
profiles **only** the overridden cells; the canonical loop driven
by `--all-tiers` / advertised tiers is suppressed for that run.
This keeps lever-2 invocations cleanly separate from canonical
baseline runs.

Example single invocation covering the §9 sweep:

```
npm run profile-tiers -- --n=20 --out=tier-distribution.lever2 \
  --clue-floor-override=six:Medium:14 \
  --clue-floor-override=six:Medium:16 \
  --clue-floor-override=mini:Medium:8
```

Summary JSON keys for synthetic cells include the floor for
disambiguation: `${variant}:${tier}@${floor}` (e.g. `six:Medium@14`,
`six:Medium@16`). The `advertised` field continues to reflect
`availableTiers(variant)` — `false` for any descoped tier whose
floor we're exploring. The markdown emit for synthetic cells uses
the same key shape in its section header.

### 4.5 Add `--out=<basename>` flag

By default the script writes `scripts/tier-distribution.md` and
`scripts/tier-distribution.summary.json`. With `--out=<basename>` it
writes `scripts/<basename>.md` and `scripts/<basename>.summary.json`
instead. This lets lever-2 invocations produce a separate evidence
file (`tier-distribution.lever2.md` /
`tier-distribution.lever2.summary.json`) without clobbering the
canonical baseline.

## 5. Re-run profile (corrected post-fix baseline)

Run `npm run profile-tiers -- --all-tiers --n=20`. With the §4.1 fix,
the resulting summary JSON now reports both `rate` and `solvedRate`
per cell. Commit the resulting `scripts/tier-distribution.md` and
`scripts/tier-distribution.summary.json`. This is the **iteration-6
corrected baseline** — the snapshot iteration 5 should have produced
but didn't.

The corrected baseline is the input for §6 (recalibrate
`MAX_ATTEMPTS_BY_TIER`) and §7 (update tier fixtures).

## 6. Recalibrate `MAX_ATTEMPTS_BY_TIER` and add `TIMEOUT_MS_BY_TIER`

Read the corrected baseline. For each tier with at least one
advertised cell of `solvedRate > 0`:

- Compute required attempts via `N = ceil(log(0.002) / log(1 - solvedRate))`
  for 99.8% reliability.
- Set `MAX_ATTEMPTS_BY_TIER[tier]` to the maximum required N across
  all variants advertising that tier (the per-tier table is
  variant-agnostic; the worst-case cell drives the budget).
- **No upper cap.** If `solvedRate = 0.03` for some tier, N ≈ 200;
  if `0.02`, N ≈ 300; the budget is whatever the formula says.
- For tiers with no advertised cell (e.g. Hard, Master), keep the
  default 50.

If §9 lever-2 restores any (variant, tier) at a lowered floor, the
restored cell's `solvedRate` from the lever-2 summary must also be
included in the formula sweep for that tier — the per-tier budget
must cover the worst-case advertising cell, including the
just-restored ones. This recalibration runs *after* §9 so all
restored cells are visible.

Add a new `TIMEOUT_MS_BY_TIER` table sized so the attempt cap is
the limiting factor. Conservatively: each Nightmare attempt takes
~1–2s on midrange hardware, so `TIMEOUT_MS_BY_TIER[tier] ≈
attemptCap × 2000ms × 1.5 (headroom)`. The exact multipliers should
err generous — a tier should run out of attempts before the wall
clock fires.

`generateForDifficulty` reads `TIMEOUT_MS_BY_TIER[difficulty]` in
place of `DEFAULT_TIMEOUT_MS` when present. `DEFAULT_TIMEOUT_MS`
remains as the fallback for tiers without an explicit entry.

The doc-blocks above both tables are rewritten to:

- Cite the iteration-6 corrected baseline by date (and the lever-2
  summary if any restored cell drove a budget).
- For each non-default entry, cite the (variant, tier, solvedRate)
  tuple that drove the budget.

## 7. Update tier fixtures

The corrected baseline produces solved-aware `firstHitSeed` and
`firstHitBoard` for each advertised tier. For Diabolical and Demonic
the new seeds may differ from the iteration-5 hand-scanned seeds
(504 / 612). For each advertised tier in `TIER_FIXTURES`:

- Read the new `firstHitSeed` and `firstHitBoard` from the corrected
  baseline summary JSON.
- Replace the existing `seed` and `board` values in `TIER_FIXTURES`.
- Verify the fixture round-trips by running `tier-fixtures.test.ts`.

The block-level comment at `tier-fixtures.ts:43-47` (explaining the
hand-scan divergence) is removed — the fixtures are now
summary-traceable again. The file-level docblock at `:11-21` is
restored to its pre-divergence "we reuse the firstHitSeed from
summary.json" form, with a citation update to iteration-6.

If for any reason the new firstHitSeed for a tier is identical to
the iteration-5 value (i.e. the broken counter happened to coincide
with a solved-aware hit), the fixture stays the same; the docblock
update is the only change.

## 8. Regression test for `solved=false` reject branch

Add a test that pins the `if (!rating.solved) continue;` branch in
`generateForDifficulty.ts:230-233`. Approach:

- Use vitest `vi.mock` or `vi.spyOn` to mock `rate` from
  `../rate`.
- Configure the mock to return `{difficulty: 'Easy', solved: false}`
  for the first call, then `{difficulty: 'Easy', solved: true}` for
  the second.
- Call `generateForDifficulty(classicVariant, 'Easy', { seed: 0 })`.
- Assert the result is `kind: 'success'` AND `attempts === 2` (the
  first attempt was rejected for `solved=false`, the second
  accepted).
- Add a second test asserting that if `rate` always returns
  `{solved: false}`, the result is `kind: 'failed'` with
  `attempts === maxRetries`.

Place the test in
`src/engine/generator/generate-for-difficulty.test.ts` (existing
file) or a new sibling if the existing file is dense. The test must
be small and targeted — it pins the `solved=false` contract,
nothing more.

## 9. Lever-2 exploration for Six and Mini

Run a single exploratory profile sweep with `--clue-floor-override`
covering the descoped tiers in Six and Mini at floors below their
current `CLUE_BOUNDS` lower bounds:

**Six** (current `CLUE_BOUNDS` lower bounds: Easy=22, Medium=18,
Hard=15, Expert=12, Master=13, Diabolical=11):

- Medium: floors 14, 16
- Hard: floors 11, 13
- Expert: floors 8, 10
- Master: floors 9, 11
- Diabolical: floors 7, 9

**Mini** (current bounds: Easy=12, Medium=10, Hard=8):

- Medium: floors 6, 8
- Hard: floors 5, 7

Total: 14 cells × N=20 = 280 puzzles. At ~1s each that is roughly
5 minutes (longer for Mini at very low clue counts since unique
solution is harder to construct). The output goes to
`scripts/tier-distribution.lever2.md` and
`scripts/tier-distribution.lever2.summary.json` (via
`--out=tier-distribution.lever2`).

### Restoration rule

For each (variant, tier, floor) cell in the lever-2 summary with
`solvedRate ≥ 0.05`:

1. Lower `CLUE_BOUNDS[variant][tier][0]` to that floor (keep upper
   bound unchanged).
2. Add `tier` to `VARIANT_TIERS[variant]` in `DIFFICULTY_ORDER`
   order.
3. Add a `TIER_FIXTURES` entry from the lever-2
   `firstHitSeed`/`firstHitBoard`.

The `MAX_ATTEMPTS_BY_TIER` recalibration in §6 must include the
restored cells in its formula sweep (since their per-tier budget
needs to cover the lower-floor cell, not the original).

If multiple floors in the lever-2 sweep clear the bar for a single
(variant, tier) cell, pick the **highest** qualifying floor (more
clues = easier puzzle = higher confidence). The lower floors stay
in the historical lever-2 evidence file but don't drive code changes.

### No-rescue outcome

If no (variant, tier, floor) cell clears `solvedRate ≥ 0.05`, no
code changes are made for §9. The `variant-tiers.ts` docblock is
updated to acknowledge the iteration-6 lever-2 sweep with negative
result and cite the lever-2 summary JSON. The descopes stand.

## 10. Refresh `variant-tiers.ts` docblock

Whether or not lever-2 rescues anything, the `variant-tiers.ts`
docblock is rewritten to:

- Cite the iteration-6 corrected baseline by date.
- For any tier still descoped post-iteration-6, cite the (variant,
  tier, solvedRate, sampleSize) tuple from the corrected baseline.
- For any tier restored via lever-2, cite the (variant, tier,
  floor, solvedRate) tuple from the lever-2 summary.
- Note the lever-2 sweep ranges explored (per §9 above) so a future
  iteration knows what was already tried.

## 11. Re-run profile (iteration-6 final snapshot)

After all of §6, §7, §9, §10 land, re-run
`npm run profile-tiers -- --all-tiers --n=20`. Commit the
resulting `scripts/tier-distribution.md` and
`scripts/tier-distribution.summary.json`. This is the **iteration-6
final snapshot** — it reflects the state shipping with this
iteration.

This second profile run also serves as the reliability check: any
restored tier should now hit its target rate within its widened
attempt budget. If a restored tier's final-snapshot `solvedRate`
drops below 5% (e.g. due to seed-range variance), its restoration
must be reverted before the iteration ships. The strict-matrix
E2E (`tests/e2e/difficulty-matrix.spec.ts`) is the canonical guard.

## 12. Existing code to update

Non-exhaustive list of files this iteration touches:

- `scripts/profile-tiers.ts` — both-rate emit, Solved column,
  header docblock refresh, `--clue-floor-override` flag, `--out`
  flag.
- `scripts/tier-distribution.md` — overwritten twice (corrected
  baseline, iteration-6 final). Both go in git history.
- `scripts/tier-distribution.summary.json` — same; gains
  `solvedRate` field.
- `scripts/tier-distribution.lever2.md` — new, lever-2 sweep
  evidence.
- `scripts/tier-distribution.lever2.summary.json` — new, lever-2
  sweep evidence.
- `src/engine/generator/generate-for-difficulty.ts` — recalibrated
  `MAX_ATTEMPTS_BY_TIER`; new `TIMEOUT_MS_BY_TIER` table;
  per-tier timeout plumbing in `generateForDifficulty`;
  doc-block refresh.
- `src/engine/generator/generate-for-difficulty.test.ts` (or
  sibling) — new regression test for `solved=false` reject branch.
- `src/engine/generator/rate.ts` — possibly lower
  `CLUE_BOUNDS[six|mini][tier][0]` if lever-2 rescues anything.
- `src/engine/generator/variant-tiers.ts` — possibly restore tiers
  in `VARIANT_TIERS`; rewrite doc-block to cite iteration-6
  evidence (corrected baseline + lever-2 sweep).
- `src/engine/solver/techniques/tier-fixtures.ts` — update
  Diabolical/Demonic fixture seeds to corrected-baseline values;
  remove block-level note at `:43-47`; restore file-level docblock;
  add fixtures for any tier restored via lever-2.
- `package.json` — version bump to 0.5.0.
- `.devloop/archive/iteration-5/` — created during DevLoop's
  archive step.

## 13. Testing strategy

- **Unit**: existing `tier-fixtures.test.ts` continues to assert
  `result.solved === true` and round-tripped tier label. With
  fixture seeds updated in §7, tests should still pass against the
  new boards. New regression test in §8 pins the `solved=false`
  reject contract.
- **Profile harness smoke**: `npm run profile-tiers -- --all-tiers
  --n=1` exits cleanly. Smoke check, not a regression guard.
  Additionally, `npm run profile-tiers -- --n=1
  --clue-floor-override=six:Medium:14 --out=test-smoke` exits
  cleanly to verify the new flags.
- **E2E (local pre-push, Chromium + WebKit)**: the strict matrix
  iterates `availableTiers(variant)`. If §9 restored any tiers it
  is now wider; otherwise unchanged. If a restored tier fails the
  strict matrix, that tier's restoration must be reverted before
  the iteration ships.
- **Worker / pwa-update / hint-learn-more / new-game / notes /
  resume**: unaffected.

## 14. Edge cases and failure modes

- **A currently-advertised tier drops below `solvedRate ≥ 0.05`
  after the §4.1 fix.** Per the user's preference, the tier stays
  advertised; `MAX_ATTEMPTS_BY_TIER` and `TIMEOUT_MS_BY_TIER` widen
  to whatever the formula demands. The strict matrix is the
  canonical guard — if attempts genuinely run out under the new
  budget, the tier reverts to a §6 lever-3 descope with a
  contingency commit.
- **No lever-2 cell clears 5%.** Iteration 6 is still meaningful:
  the methodology fix, recalibrated budgets, fixture cleanup, and
  test all ship. The `variant-tiers.ts` docblock acknowledges the
  negative result.
- **Lever-2 rescues a tier, but the iteration-6 final snapshot
  shows it under 5%.** Revert the restoration before the iteration
  ships. Same rule iteration 5 applied to its post-tuning profile.
- **A restored tier's strict-matrix E2E fails.** Same as above:
  revert the restoration. The matrix is the canonical guard.
- **Profile runtime overshoots 10 minutes.** Re-run with `--n=10`.
  Histograms remain meaningful; the rates have wider confidence
  intervals — reflect that in the per-tier attempt budget by
  rounding the formula's N upward conservatively.
- **The corrected `solvedRate` for some advertised tier is lower
  than the formula tolerates without truly absurd budgets** (e.g.
  `solvedRate ≈ 0.005` would demand N ≈ 1200 attempts and
  proportionally long timeouts). Treat as a regression-from-data
  rather than a budget question: descope the tier, add a contingency
  commit, file the rater-side fix as iteration-7 scope. The "no
  ceiling" decision presumes rates in the 0.02–0.15 band; below
  that, the data is telling us something different.
- **`vi.mock` for `rate` interferes with other tests in the same
  file.** Use `vi.spyOn(...).mockImplementation(...)` scoped to the
  individual test cases with explicit `mockRestore()` in `afterEach`,
  or place the new tests in a separate file.

## 15. Success criteria

- `scripts/profile-tiers.ts` records `solvedRate` alongside `rate`;
  `firstHitSeed`/`firstHitBoard` track the solved-aware hit.
- `scripts/tier-distribution.summary.json` (corrected baseline) shows
  `solvedRate` for every cell; the file is committed in iteration-6
  history.
- `scripts/tier-distribution.md` (corrected baseline) shows a Solved
  column.
- `MAX_ATTEMPTS_BY_TIER` reflects formula-derived budgets sized
  against the corrected `solvedRate`; its doc-block cites
  iteration-6 evidence.
- `TIMEOUT_MS_BY_TIER` is added; `generateForDifficulty` uses it
  in place of `DEFAULT_TIMEOUT_MS` when an entry is present.
- `TIER_FIXTURES` Diabolical and Demonic seeds match the corrected
  baseline `firstHitSeed`. Block-level note at `tier-fixtures.ts:43-47`
  is removed. File-level docblock cites iteration-6 evidence.
- A regression test pins the `solved=false` reject contract in
  `generateForDifficulty`.
- `scripts/profile-tiers.ts` supports `--clue-floor-override` and
  `--out` flags.
- `scripts/tier-distribution.lever2.md` and
  `scripts/tier-distribution.lever2.summary.json` are committed,
  covering the §9 sweep ranges.
- For each (variant, tier, floor) in lever-2 with `solvedRate ≥ 0.05`,
  `CLUE_BOUNDS[variant][tier][0]` is lowered to that floor,
  `VARIANT_TIERS[variant]` includes the tier, and `TIER_FIXTURES`
  has an entry for the tier.
- `variant-tiers.ts` docblock cites iteration-6 evidence (corrected
  baseline and lever-2 sweep).
- `scripts/tier-distribution.md` and
  `scripts/tier-distribution.summary.json` (iteration-6 final
  snapshot) are committed after all tuning lands.
- `scripts/profile-tiers.ts:1-18` header docblock cites iteration-6.
- The strict matrix E2E passes on Chromium and WebKit for every
  advertised tier in every variant.
- Unit, type-check, and production-build sweeps pass cleanly.
- `package.json` version is bumped to 0.5.0.
- No regressions in v0.4.1 functionality — existing E2E specs and
  unit suites still pass.
