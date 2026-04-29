# Iteration-6 Final Code Review

Reviewed: 2026-04-29
Branch: master @ 94568c0 (chore: Verification fixes)
Version: 0.5.0

This review covers the Sudoku PWA codebase against
`.devloop/requirements.md` and `.devloop/tasks.md` for iteration 6.
The iteration was specifically driven by the four "before production"
recommendations from the iteration-5 review (`.devloop/archive/iteration-4/review.md`)
plus the exploratory lever-2 follow-up.

---

## 1. Requirements vs Implementation

### Overall status — all 15 tasks landed

The iteration is **substantially complete**. Every task in
`tasks.md` is marked `done`, and the implementing commits are present
on `master` (T1–T15 plus a "Verification fixes" follow-up). Targeted
unit and type-check sweeps pass cleanly under the review (35/35 tests
across the three iteration-6-touched suites; `tsc --noEmit` exits 0).

| §          | Requirement                                                                | Status | Evidence                                                                                                     |
| ---------- | -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| §4.1       | `solvedRate` field tracking solved-aware hits in profile output            | ✓      | `scripts/profile-tiers.ts:60-85` (CellResult/SummaryEntry); `:294-307` (counter logic)                       |
| §4.2       | "Solved" / "Solved %" columns in markdown histogram                        | ✓      | `scripts/profile-tiers.ts:357-372`; `scripts/tier-distribution.md` shows the new columns                     |
| §4.3       | File-header docblock cites iteration-6 §4 and drops iteration-3 references | ✓      | `scripts/profile-tiers.ts:1-40`                                                                              |
| §4.4       | `--clue-floor-override=variant:tier:N` (repeatable, suppresses canonical)  | ✓      | `scripts/profile-tiers.ts:119-155`, `:209-258`                                                               |
| §4.5       | `--out=<basename>` flag                                                    | ✓      | `scripts/profile-tiers.ts:108-117`, `:377-407`                                                               |
| §5         | Corrected post-fix baseline committed                                      | ✓      | `scripts/tier-distribution.summary.json` shows both `rate` and `solvedRate` for every cell                   |
| §6 / §6′   | Recalibrated `MAX_ATTEMPTS_BY_TIER`                                        | ✓      | `src/engine/generator/generate-for-difficulty.ts:11-46` (Medium=122, Demonic=122, Nightmare=59)              |
| §6         | New `TIMEOUT_MS_BY_TIER` table + plumbing                                  | ✓      | `src/engine/generator/generate-for-difficulty.ts:56-91`, `:247-250`                                          |
| §7         | Tier fixtures regenerated from corrected baseline; docblock restored       | ✓      | `src/engine/solver/techniques/tier-fixtures.ts:10-25`, `:46-71`                                              |
| §8         | Regression test for `solved=false` reject branch                           | ✓      | `src/engine/generator/generate-for-difficulty.test.ts:532-611` (two cases)                                   |
| §9         | Lever-2 sweep (14 cells) executed                                          | ✓      | `scripts/tier-distribution.lever2.summary.json` covers all 14 keys                                           |
| §9 (rule)  | Restoration applied where `solvedRate ≥ 0.05`                              | ✓      | `six:Medium` restored at clueFloor=14 — `rate.ts:131-141`, `variant-tiers.ts:57-61`, `tier-fixtures.ts:67-72` |
| §10        | `variant-tiers.ts` docblock cites iteration-6 evidence                     | ✓      | `src/engine/generator/variant-tiers.ts:4-56`                                                                 |
| §11        | Iteration-6 final snapshot committed                                       | ✓      | Commit `3d1adf8`; current `tier-distribution.summary.json` reflects post-tuning state                        |
| §12        | Version bumped to 0.5.0                                                    | ✓      | `package.json:4`                                                                                             |
| §13        | Test sweeps                                                                | ✓      | TASK-013 (`fc80778`), TASK-014 (`f416e83`), TASK-015 (`fc80778`) commits                                     |

### Reliability-formula spot check

The N values cited in the recalibrated `MAX_ATTEMPTS_BY_TIER` are
arithmetically correct for the cited (variant, tier, solvedRate)
drivers (verified by re-deriving `ceil(log(0.002)/log(1−p))` from
the corrected baseline):

| Driver                                | solvedRate | Formula N | Budget set |
| ------------------------------------- | ---------- | --------- | ---------- |
| classic:Easy                          | 0.90       | 3         | 50 (floor) |
| classic:Expert                        | 0.20       | 28        | 50 (floor) |
| classic:Diabolical                    | 0.15       | 39        | 50 (floor) |
| six:Medium@14 (lever-2)               | 0.05       | 122       | **122**    |
| classic:Demonic                       | 0.05       | 122       | **122**    |
| classic:Nightmare                     | 0.10       | 59        | **59**     |

The "default 50 floor" rule is applied consistently for tiers whose
formula N is below 50. `TIMEOUT_MS_BY_TIER` cleanly mirrors the
attempt cap × 2000 ms × 1.5 sizing rule the requirements §6 cites.

### Lever-2 outcome

Of the 14 explored cells, **only `six:Medium@14`** crossed
`solvedRate ≥ 0.05`. The remaining 13 cells all returned
`solvedRate=0`, including every Mini cell. The "no rescue" outcome is
faithfully reflected in `variant-tiers.ts:44-55`'s descope citations
and the documented sweep ranges (lines 30-37). Restoration was
applied correctly at the highest qualifying floor (the only one that
qualified, in this case).

### Findings — gaps and inconsistencies

**G1. `TIER_FIXTURES` docblock claims "one fixture per advertised
(variant, tier) cell" but `six:Easy` and `mini:Easy` are absent.**
`src/engine/solver/techniques/tier-fixtures.ts:10-12` says "One
fixture per advertised (variant, tier) cell." After iteration 6's
restoration pass, the advertised set is:
`{classic:Easy/Medium/Expert/Diabolical/Demonic/Nightmare,
six:Easy, six:Medium, mini:Easy}` — 9 cells. Only 7 are present in
`TIER_FIXTURES`; `six:Easy` and `mini:Easy` are missing despite
having complete `firstHitSeed` / `firstHitBoard` data in
`scripts/tier-distribution.summary.json` (seed=1000 board="2.5631…",
seed=2000 board="..41.1321.242413"). This is a **pre-existing gap**
from before iteration 6 (the original commit `1425547` only
populated classic), but iteration 6 had a natural opportunity to
close it via TASK-007 (regenerate fixtures from the corrected
baseline) and didn't. The round-trip test
(`tier-fixtures.test.ts`) iterates `Object.entries(TIER_FIXTURES)`
so it does not flag the omission. Cosmetic-but-mildly-misleading;
worth either adding the two missing fixtures or narrowing the
docblock language.

**G2. `MAX_ATTEMPTS_BY_TIER` docblock has a copy-paste typo.**
`src/engine/generator/generate-for-difficulty.ts:20` says "if
`solvedRate = 0.05` the budget grows to 122 attempts" — the actual
example value should match the formula (`solvedRate = 0.05` →
N=122 is correct). However the next sentence "if `solvedRate = 0.03`
some tier, N ≈ 200; if `0.02`, N ≈ 300" is illustrative only and
correct. Not a defect — flagged here only because I re-derived the
formula and the docblock language was tight.

**G3. (Minor — non-blocking) `TIMEOUT_MS_BY_TIER` uses non-default
values for tiers whose attempt cap is the default 50.** The docblock
explicitly says "Sizing rule … `timeout ≈ attemptCap × 2000ms × 1.5`",
which gives `50 × 2000 × 1.5 = 150_000` for Easy/Expert/Diabolical
even though their attempt caps stayed at the default. This is internally
consistent with the docblock's stated rule but produces values that
diverge from `DEFAULT_TIMEOUT_MS=60_000` — a reader scanning the
table might wonder why Easy needs 150 s. The reasoning ("conservative
per-attempt headroom for any tier whose cap × per-attempt cost
exceeds the default") is sound but not stated explicitly above the
table; the docblock at lines 56-81 implies "Tiers with no advertised
cell keep the default" — which is correctly applied to Hard/Master,
but a reader could come away thinking the others should also be
default-equal. Tightening the docblock to explain the per-tier
headroom rule would help.

**G4. No scope creep observed.** No new features, no new tiers, no
new variants, no rater changes, no architectural refactors. The
iteration stayed inside §3's non-goals.

---

## 2. Code Quality

### C1. (Resolved — primary iteration-6 target) Methodology gap closed

The iteration-5 review's headline finding was that
`profile-tiers.ts` did not require `result.solved === true` when
counting tier hits, biasing reported rates upward and under-budgeting
`MAX_ATTEMPTS_BY_TIER`. Iteration 6 closes this end-to-end:

- `profile-tiers.ts:286-307` now counts both `matchCount` (any rated
  hit) and `matchCountSolved` (rated and solved). `firstHitSeed` /
  `firstHitBoard` advance to the first solved hit (lines 302-305).
- The summary JSON exposes both `rate` and `solvedRate` per cell
  (verified in `scripts/tier-distribution.summary.json`).
- The MD output gains a Solved column (verified in
  `scripts/tier-distribution.md`).
- `MAX_ATTEMPTS_BY_TIER` is recalibrated against `solvedRate` — the
  load-bearing rate. Demonic widens 50 → 122, Nightmare 50 → 59,
  Medium widens 50 → 122 (driven by the lever-2 cell).

The corrected baseline shows the predicted divergence in
`classic:Diabolical` (rate=0.20, solvedRate=0.15) and
`classic:Demonic` (rate=0.20, solvedRate=0.05). The
iteration-5 prediction that Demonic's true rate was closer to 0.05
than 0.20 is empirically confirmed.

### C2. (Resolved — primary iteration-6 target) Tier-fixtures docblock now consistent

`tier-fixtures.ts:10-25` is restored to the summary-traceable model
("we reuse the firstHitSeed recorded in
scripts/tier-distribution.summary.json after iteration-6 tuning").
The block-level note explaining the iteration-5 hand-scan
divergence was removed; in its place, a small comment at lines
64-66 explains the lever-2 origin of `six:Medium`. The Diabolical
seed (504) and Demonic seed (612) match the corrected baseline.

### C3. (Resolved) Profile-tiers header docblock refreshed

`scripts/profile-tiers.ts:1-40` cites iteration-5 §4 and iteration-6
§4 explicitly and drops the obsolete iteration-3 references.

### C4. (Resolved) Regression test pinning the `solved=false` reject branch

Two cases at `generate-for-difficulty.test.ts:532-611`. The first
(`rejects an attempt with solved=false; the next solved attempt is
accepted`) asserts spy callCount === 2, proving the first attempt
was rejected and the second accepted. The second
(`fails with attempts === maxRetries and closestRating === null
when every attempt is solved=false`) asserts the failure-path
contract including the "closestRating must remain null when every
attempt is rejected for solved=false" subtlety captured in the
source comment at `generate-for-difficulty.ts:282-287`.

### C5. Error handling — adequate (carried from iteration 5)

No regressions. `generateForDifficulty` continues to:
- normalise difficulty input via `normalizeDifficulty`,
- cap attempts and timeout (now using the new per-tier values),
- contain finder bugs in a per-attempt try/catch and surface
  `lastError` in the failure result,
- expose `onProgress` for incremental UI updates.

The worker client/worker remain single-flight with clear cancellation
semantics. No security concerns observed (no eval/network/storage
paths handle untrusted data; localStorage migration parses
structurally).

### C6. (Pre-existing — explicitly deferred) `slotKey` asymmetry between `save.ts` and `stats.ts`

`src/store/save.ts:48` lowercases the difficulty before composing
the slot key; `src/store/stats.ts:37` does not. Today both stores
are fed lowercase slugs at all callsites (e.g.
`stats.ts:62` lowercases tier names when initializing the store),
so the asymmetry is dormant. Requirements §3 explicitly defers
this; the iteration-5 review flagged it; iteration 6 inherits the
deferral.

### C7. (Pre-existing) Candidate-grid duplication in `rate.ts`

Carried since iteration 3. Explicitly deferred in §3.

### C8. (Pre-existing) Minor `closestRating` invariant nuance

`generate-for-difficulty.ts:284-287`: the `solved=false` branch
correctly does **not** update `closestRating`, because the rated
tier on an unsolved puzzle is not trustworthy. The new regression
test in §C4 above pins this contract. Worth highlighting because the
behaviour is subtle and easy to "fix" in the wrong direction by an
unwary refactor.

---

## 3. Testing

### T1. New tests for §6 / §8 are appropriate

- `generate-for-difficulty.test.ts:185-203` (per-tier table matches
  iteration-6 baseline tuning) explicitly pins each non-default
  budget value (Medium=122, Demonic=122, Nightmare=59) plus the
  default-50 floors. A future regression that drifts any of these
  numbers would surface immediately.
- `generate-for-difficulty.test.ts:205-238` (`Nightmare defaults to
  59 attempts when maxRetries is omitted`) is a wiring test that
  proves the per-tier budget is read end-to-end through
  `generateForDifficulty`. This is a nice complement to the
  unit-level table assertion.
- `generate-for-difficulty.test.ts:532-611` covers the
  `solved=false` reject branch — both the "first rejected, second
  accepted" path and the "every attempt rejected → kind:failed,
  closestRating:null" path. Closes T3 from the iteration-5 review.

### T2. Test gap — `TIMEOUT_MS_BY_TIER` is not exercised end-to-end

There is a unit-level table assertion for `MAX_ATTEMPTS_BY_TIER`
(line 185), but no equivalent for `TIMEOUT_MS_BY_TIER`. There is no
end-to-end test that proves
`generateForDifficulty(...,'Nightmare')` actually picks up the
`180_000`ms timeout from the table when `options.timeoutMs` is
omitted. The plumbing is a single line
(`generate-for-difficulty.ts:247-250`) and the type-check enforces
the shape, but a regression that, say, swapped the
`TIMEOUT_MS_BY_TIER[difficulty]` lookup back to bare
`DEFAULT_TIMEOUT_MS` would not be caught. Low-priority; the
Nightmare-by-default test for attempts already exercises the same
code path.

### T3. Test gap — `--out` and `--clue-floor-override` flags have no automated test

The flags were verified by manual smoke (`TASK-002`'s verification
field) but no automated test asserts the round-trip behaviour
(parse → profile cell → keyed correctly in `summary.json`). Same
posture as the iteration-5 review's T4: acceptable for a developer
tool.

### T4. Test gap — `__sudokuGameStore` DEV gating still has no automated test

Iteration 5 carried this; iteration 6 inherits it. A regression
that hoisted the assignment out of the DEV block would not be
caught by the unit suite. Same low-priority-as-before posture.

### T5. Coverage of the iteration-6 surface looks solid

- `tier-fixtures.test.ts` round-trips every entry in `TIER_FIXTURES`
  including the lever-2-restored `six:Medium`. The
  `expect(result.solved).toBe(true)` assertion (added in iteration 5)
  is preserved at line 49 — the fixture-layer guard is intact.
- `variant-tiers.test.ts` was updated for the iteration-6
  restorations (line 19-23 asserts `availableTiers(sixVariant)`
  includes Medium).
- `Stats.test.tsx` continues to exercise the `tiers.length <= 1`
  filter-pill hide rule from iteration 5.
- The strict matrix E2E (`tests/e2e/difficulty-matrix.spec.ts`)
  iterates `availableTiers(variant)` — the iteration-6-restored
  `six:Medium` is exercised via the cap-on-success contract.

---

## 4. Recommendations (before production)

In rough priority order:

1. **(Optional, cosmetic)** Add `TIER_FIXTURES` entries for
   `six:Easy` and `mini:Easy` from the corrected baseline summary,
   or narrow the docblock language. The current "one fixture per
   advertised cell" claim is mildly inaccurate. Two-line addition
   to `tier-fixtures.ts`; data already exists in
   `scripts/tier-distribution.summary.json`.
2. **(Optional)** Add an end-to-end test that
   `generateForDifficulty` picks up `TIMEOUT_MS_BY_TIER[difficulty]`
   from the table. Mirrors the existing Nightmare-attempts test —
   force a long synthetic per-attempt cost and assert that
   `result.elapsedMs` lands near the expected per-tier timeout
   rather than near `DEFAULT_TIMEOUT_MS`. Low priority — the type
   system already constrains the shape.
3. **(Optional)** Tighten the docblock above `TIMEOUT_MS_BY_TIER`
   to state explicitly that the rule is "every advertised tier
   gets `attemptCap × 2000 × 1.5` headroom regardless of whether
   the attempt cap was widened above the default." The current
   docblock implies "default if not advertised" but is silent on
   why advertised-with-default-cap tiers (Easy, Expert,
   Diabolical) get widened timeouts.

None of these block shipping 0.5.0. The iteration-6 deliverables
are functionally correct, statistically backed, and the
type-check + targeted tests are green.

---

## 5. Future Considerations

### 5.1 Architectural debt (deferred — explicitly per requirements §3)

Carried unchanged from iteration 5; none addressed in iteration 6:

- **Candidate-grid duplication in `rate.ts`** — multi-iteration project.
- **`slotKey` asymmetry between `save.ts` and `stats.ts`** — dormant
  but will bite if any future caller passes a Title-Case difficulty
  to either store. A small targeted lowercase normalisation in
  `entryKey` would close it in two lines.
- **`__APP_VERSION__` ambient typing** — minor.
- **Unifying `availableTiers` with `CLUE_BOUNDS`** — currently each
  table is hand-maintained. The iteration-6 lever-2 restoration of
  `six:Medium` required edits to *both* tables; consolidating would
  make this kind of follow-up a one-line change.
- **`useUpdate.checkForUpdates` resolution-timing race** — UX-visible
  but not user-painful. Out of scope for any iteration without a UX
  rework attached.

### 5.2 Player-facing tier coverage (informed by iteration 6 evidence)

The iteration-6 lever-2 sweep produced a strong negative result for
**Mini** (every tested clueFloor 5–12 returns 100% Easy on the 4×4
grid) and for non-Medium tiers in **Six** (every tested floor
returns solvedRate=0). The 6×6 and 4×4 rater chains genuinely do
not produce harder patterns at any reasonable floor. Two paths
forward:

1. **Accept the small-grid coverage as final.** Iteration 6 has
   given us strong evidence that Six tops out at Medium and Mini
   tops out at Easy; documented in
   `variant-tiers.ts:44-55`. Stop fighting the data.
2. **Extend the rater for small grids.** Add cheaper-to-hit
   tier-discriminators specifically tuned for the 4×4/6×6 case (e.g.
   "uses naked pair" alone is rare enough on 4×4 that it could
   reasonably define a Medium tier without requiring the 9×9
   technique chain). This is a multi-iteration project that the
   iteration-5 review previously deferred; nothing in iteration-6
   evidence changes that calculus.

### 5.3 Feature follow-ons (not blockers)

- **Daily puzzle.** A natural extension once tier coverage is
  robust — pin a deterministic seed per day for shareable scores.
  The iteration-6 budgets are now provably reliable, removing the
  "could a daily seed unluckily fail" concern at advertised tiers.
- **Hint history / undo discipline.** Carried.
- **Stat exports.** Carried.

### 5.4 Technical debt introduced this iteration

- **`G1` above** — `TIER_FIXTURES` is missing two advertised-cell
  entries (`six:Easy`, `mini:Easy`). Pre-existing, not introduced
  by iteration 6, but iteration 6 had a natural close opportunity
  via TASK-007 and didn't take it.
- The `MAX_ATTEMPTS_BY_TIER`/`TIMEOUT_MS_BY_TIER` tables are now
  **two parallel structures** that must be kept in sync — every
  future tier rebalance requires editing both. Worth noting as a
  tiny consolidation opportunity (e.g. a single
  `Record<Difficulty, { maxAttempts: number; timeoutMs: number }>`
  table) the next time either is touched. Not urgent.

### 5.5 Process observations

The iteration-6 plan was unusually well-scoped: every gap from the
iteration-5 review maps to a numbered task, the methodology fix
landed before any data-driven tasks consumed the corrected baseline,
and the lever-2 sweep was a single self-contained command. The
subagent-driven pattern of "land the script change → re-profile →
recalibrate against the new evidence → re-profile to verify" is
exactly the right shape for tuning loops like this and should be
the template for any future calibration work.

---

## 6. Verdict

Iteration 6 closed every iteration-5 review recommendation cleanly,
applied the corrected reliability formula end-to-end, and produced
the small lever-2 win (`six:Medium` restored at clueFloor=14) along
with definitive negative evidence for the rest of the explored
space. The version bump to 0.5.0 (minor) is consistent with the
player-visible reliability/latency change.

The remaining items (G1, T2, T3, T4 from §1/§3) are all
cosmetic-or-low-priority. **The code is production-ready at this
revision.**

Recommended next iteration scope:
- Decide whether to invest in extending the rater for small grids
  (§5.2 path 2) or accept the current coverage (§5.2 path 1) and
  stop revisiting Six/Mini tier expansion.
- Address the `slotKey` asymmetry while it is still dormant (§5.1).
- Consider consolidating the parallel `MAX_ATTEMPTS_BY_TIER` /
  `TIMEOUT_MS_BY_TIER` tables next time either is tuned (§5.4).
