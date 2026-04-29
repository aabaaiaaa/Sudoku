# Iteration-5 Final Code Review

Reviewed: 2026-04-29
Branch: master @ 5431915 (chore: Verification fixes)
Version: 0.4.1

This review covers the Sudoku PWA codebase against
`.devloop/requirements.md` and `.devloop/tasks.md` for iteration 5,
which was a small follow-up iteration aimed at validating the
iteration-4 descope decisions with post-fix profiling data and folding
in five small recommendations from the iteration-4 review.

---

## 1. Requirements vs Implementation

### Overall status — all 14 tasks landed

The iteration is **substantially complete**. Every task in
`tasks.md` is marked `done`, and the implementing commits (T1 →
T14, plus a "Verification fixes" follow-up) are present on
`master`. The unit, type-check/build, and E2E sweeps were performed
and recorded as TASK-012 / TASK-013 / TASK-014.

| §           | Requirement                                                             | Status   | Evidence                                                                                                                            |
| ----------- | ----------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| §4.1        | `--all-tiers` flag in `profile-tiers.ts`                                | ✓        | `scripts/profile-tiers.ts:69-71`, `:114`                                                                                            |
| §4.2        | `firstHitBoard` in `SummaryEntry`                                       | ✓        | `scripts/profile-tiers.ts:50-56`, `:144-147`                                                                                        |
| §4.3        | Retire stale `minClues` preamble; rename to `clueFloor`                 | ✓        | `scripts/profile-tiers.ts:138`. **Caveat below.**                                                                                   |
| §5          | Re-validate descopes (post-fix baseline committed)                      | ✓        | `scripts/tier-distribution.summary.json` covers all 17 cells; commit `a99b286`                                                      |
| §6          | Lever-1 widen `MAX_ATTEMPTS_BY_TIER`                                    | ✓        | `src/engine/generator/generate-for-difficulty.ts:25-34` — `Nightmare = 59` only widening; doc-block refreshed                       |
| §7          | Restore tiers in `VARIANT_TIERS`; refresh doc-block                     | ✓ (none) | `src/engine/generator/variant-tiers.ts:29-33` is unchanged from iteration 4; doc-block correctly cites iteration-5 evidence         |
| §8          | Add fixtures for restored tiers                                         | n/a      | No tier restored, so no new fixtures required (per task definition)                                                                 |
| §9          | `expect(result.solved).toBe(true)` in tier-fixtures round-trip          | ✓        | `src/engine/solver/techniques/tier-fixtures.test.ts:50`                                                                             |
| §10         | Re-run profile post-tuning; iteration-5 final snapshot                  | ✓        | Commit `29573a2`                                                                                                                    |
| §11.1       | Gate `__sudokuGameStore` behind `import.meta.env.DEV`                   | ✓        | `src/main.tsx:15-18`                                                                                                                |
| §11.2       | Hide Stats filter pill row when `tiers.length <= 1`                     | ✓        | `src/screens/Stats.tsx:86-115`                                                                                                      |
| §11.3       | Delete `generator-client.real-worker.test.ts`                           | ✓        | File no longer present                                                                                                              |

### Findings — gaps and inconsistencies

**G1. Iteration-5 §3 "no tier restored" outcome is the ground truth,
but `tasks.md` TASK-007's verification language is mildly misleading.**
The iteration-5 baseline summary (`scripts/tier-distribution.summary.json`)
shows that no tier moved across the 5% threshold post-fix. The
iteration-4 `VARIANT_TIERS` list was already optimal under the
corrected methodology. Implementation is correct; only the
post-write narrative ("Restore tiers" suggests tiers were restored)
slightly oversells the result. The version bump to **0.4.1 (patch)**
is consistent with this outcome and matches TASK-011's branch
("If no tier restored, bump 0.4.1").

**G2. (Minor scope creep) `tier-fixtures.ts` Diabolical / Demonic
seeds were hand-rolled forward, not taken from the summary as §8
contemplates.** Requirements §8 says fixtures should be added for
restored tiers using `firstHitSeed` / `firstHitBoard` from the
summary JSON. No tier was restored, so §8 is technically a no-op —
but the verification commit (`5431915`) ended up replacing the
existing **Diabolical (502 → 504)** and **Demonic (600 → 612)**
fixture seeds because the original `firstHitBoard` puzzles rated
correctly but stalled the rater (`solved=false`). The replacement is
correct and well-commented — but it surfaces the methodology gap
covered in §C1 below, and the doc-block at
`tier-fixtures.ts:11-21` ("we reuse the firstHitSeed recorded in
scripts/tier-distribution.summary.json") is now technically
inaccurate for those two entries. The block-level comment at
`:43-47` explains the divergence, so the contradiction is visible
locally rather than buried — acceptable, but worth addressing in a
later cleanup.

**G3. (Stale doc) `scripts/profile-tiers.ts:1-18` header still
references "iteration 3 manual testing" and "requirements §4.2
(rater hardening) and §4.3".** The §4.3 line is the iteration-3 §4.3
budget reference, not iteration-5 §4. The body of the script was
correctly updated in §4 of this iteration, but the file-header
docblock was not refreshed to match. Cosmetic only.

**G4. No scope creep observed.** No new features, no new tiers,
no new variants, no rater changes, no architectural refactors.
The iteration stayed inside §3's non-goals.

---

## 2. Code Quality

### C1. (Significant — methodology gap) `profile-tiers.ts` does not filter `solved===true`

This is the most important finding in the review. The profile script
counts a hit on `result.difficulty === tier` alone
(`scripts/profile-tiers.ts:140-148`). The production code path it
exists to inform (`src/engine/generator/generate-for-difficulty.ts:230-233`)
**explicitly rejects** any rating with `solved=false` before the strict
tier comparison:

```ts
if (!rating.solved) {
  options.onProgress?.({ attempt: attempts, max: maxRetries });
  continue;
}
```

That divergence has three downstream consequences:

1. **`tier-distribution.summary.json` rates are biased upward.** The
   reported `rate` includes stalled-rater puzzles that production
   would reject. The existence of `5431915 chore: Verification fixes`
   — replacing the iteration-5 baseline `firstHitBoard` for both
   Diabolical and Demonic with hand-scanned `solved=true` seeds — is
   direct empirical evidence that this matters. For Diabolical at
   the baseline `firstHitSeed=502`, two of the first three rated-as-
   target puzzles were stalled; only seed 504 produced a solvable
   one. So the *usable* Diabolical rate is materially lower than the
   reported 0.20.

2. **`MAX_ATTEMPTS_BY_TIER` budgets are sized against the inflated
   denominator.** The §6 reliability formula
   `N = ceil(log(0.002) / log(1 - rate))` was applied with `rate`
   from the summary. If the true usable rate for Diabolical/Demonic
   is closer to 0.07 instead of 0.20, the formula yields N≈91, not
   28. The current 50-attempt default would deliver ~97% reliability
   instead of the targeted 99.8%. Nightmare's stand-out 50 → 59
   widening is correct *modulo* the same caveat — at rate=0.10 the
   formula gives 59; at a true rate of 0.05–0.07 it gives 91–122.

3. **The §6 5% threshold is itself non-rigorous post-fix.** The
   threshold compares the unfiltered rate to a constant. A tier
   sitting at 6% rated-as-target but 2% solved-and-rated-as-target
   would be advertised, then would routinely fail the strict-tier
   path under load.

The fixture-level guard (`expect(result.solved).toBe(true)` from §9)
catches this at the *fixture* layer but not at the *budget* layer.
The matrix E2E passing in TASK-014 is a single observation; it does
not prove sustained 99.8% reliability under the corrected denominator.
**Recommendation**: a one-line change in `profile-tiers.ts:142` —
`if (rated === tier && result.solved)` — would close the gap at the
source. An optional richer fix is to record both the rated rate and
the rated-and-solved rate so the comparison can be observed.

### C2. (Minor) `MAX_ATTEMPTS_BY_TIER` docblock asserts "non-default budgets" are exhaustive — but the assertion silently depends on the methodology gap

`src/engine/generator/generate-for-difficulty.ts:11-23` says "Each
tier defaults to 50; lever-1 widens only where the baseline data
shows the formula's required N exceeds the default." Under the
inflated `rate` numbers this is correct (only Nightmare crosses the
50-attempt threshold). Under the corrected
rated-and-solved denominator it likely is *not* correct — Diabolical
and Demonic would also need widening. This is a follow-on consequence
of C1 and would resolve the same way.

### C3. (Pre-existing, deferred) `slotKey` asymmetry between `save.ts` and `stats.ts`

`src/store/save.ts:48` lowercases the difficulty before composing
the slot key; `src/store/stats.ts:37` does not. Both stores happen
to be fed lowercase slugs at all callsites today, so the asymmetry
is dormant. Requirements §3 explicitly defers this; flagging as
still-deferred technical debt.

### C4. (Pre-existing) `gameStore.newGame` casts `string | undefined → Difficulty`

`src/store/game.ts` passes a lowercase slug to `generateForDifficulty`
which then re-Title-Cases internally via `normalizeDifficulty`.
Functionally correct, but the cast surprises a reader. Out of
iteration-5 scope.

### C5. Error handling — adequate

`generateForDifficulty` correctly normalises difficulty input,
caps attempts and timeout, and captures the most recent error
message into `lastError`. The per-attempt try/catch protects the
caller from finder bugs. The worker client is single-flight with a
clear contract documented on `generateInWorker`. Cancellation and
re-entrancy in `gameStore.newGame` use a `handle` token to avoid
overwriting state from a stale generation. No security concerns
were observed (no user-provided data reaches eval/network/storage
in unexpected ways; localStorage save migration uses structural
parsing, not eval).

---

## 3. Testing

### T1. New tests for §11 changes are appropriate

- `src/engine/solver/techniques/tier-fixtures.test.ts:50` adds the
  `result.solved === true` assertion as required (§9). Verified.
- `src/screens/Stats.test.tsx` adds the §11.2 cases asserting
  `stats-filter-row-six` and `stats-filter-row-mini` are not
  rendered (single-tier variants), while `stats-filter-row-classic`
  still is.

### T2. Test gap — `__sudokuGameStore` DEV gating

§11.1's gating was verified by manual `grep -r "__sudokuGameStore"
dist/` per TASK-008's verification field, but no automated test
locks the behaviour in. A future change that accidentally hoisted
the assignment outside the DEV block would not be caught by the
unit suite. Low-priority — the production-bundle audit could be
made a single test against a build artifact, but that is added cost
for a small failure mode.

### T3. Test gap — solved=false reject path in `generateForDifficulty`

The `if (!rating.solved) continue;` branch (added in iteration 4)
is exercised indirectly by the strict-tier tests, but no test
explicitly asserts that a `rate(...)` returning
`{difficulty: target, solved: false}` is rejected. Given the role
this branch played in the iteration-5 verification fix, a small
spy-based test here would harden the contract.

### T4. Profile script behaviour — no regression test

`profile-tiers.ts` is a developer tool. Iteration-5 added a flag
and a field; there is no automated test that the script's output
shape matches `SummaryEntry` (e.g. that `firstHitBoard` is always
`string | null`). The script "tests" via `tsx` runtime checks at
invocation, which catches type errors but not shape regressions.
Acceptable for a developer tool.

### T5. Coverage of advertised `availableTiers` paths is solid

The matrix E2E (`tests/e2e/difficulty-matrix.spec.ts`) iterates
`availableTiers(variant)` and enforces strict-success per
iteration-4 §7. `Home.test.tsx` covers the picker; `Stats.test.tsx`
covers the per-variant table. The catalog and per-finder fixtures
remain untouched.

---

## 4. Recommendations (before production)

In rough priority order:

1. **Fix the methodology gap in `profile-tiers.ts`.** Either filter
   `solved===true` before counting matches and recording first hits,
   or record both the rated rate and the rated-and-solved rate side-
   by-side. Re-run the profile and verify whether
   `MAX_ATTEMPTS_BY_TIER` for Diabolical / Demonic / Nightmare needs
   further widening. Without this, the iteration-5 reliability claim
   is technically unbacked. Estimate: under an hour of work and one
   profile rerun.
2. **Refresh the stale doc-block at `scripts/profile-tiers.ts:1-18`.**
   The header still names iteration-3 §4.2/§4.3 and "manual testing".
3. **Reconcile the tier-fixtures docblock with reality.** Either
   regenerate the Diabolical / Demonic seeds via a `solved`-aware
   profiling pass and revert to a "fixtures from summary" model, or
   amend the file-level docblock to acknowledge the two seeds were
   hand-scanned forward. The block-level comment at lines 43-47 is
   already there; promote it to the file-level docblock.
4. **(Optional)** Add a single regression test for the `solved=false`
   reject branch in `generateForDifficulty`.

None of the above blocks shipping 0.4.1; the matrix E2E is currently
green and the code is functionally correct under the inflated
denominator. The recommendations are about making the budgets
*provably* sized rather than empirically sized.

---

## 5. Future considerations

### 5.1 Architectural debt (deferred — explicitly per requirements §3)

- **Candidate-grid duplication in `rate.ts`.** Carried since iteration 3.
- **`slotKey` asymmetry between `save.ts` and `stats.ts`.** Dormant
  bug; will bite if any future caller passes a Title-Case difficulty.
- **`__APP_VERSION__` ambient typing.**
- **Unifying `availableTiers` with `CLUE_BOUNDS`.** Currently each
  table is hand-maintained.
- **`useUpdate.checkForUpdates` resolution-timing race.** Visible to
  the user (a brief "Up to date" appears while an update is actually
  downloading) but not user-painful enough to warrant priority. The
  proper fix is a small SW-state-machine reshape — out of scope for
  any iteration without a UX rework attached.

### 5.2 Player-facing tier coverage

After iteration 5, **Six** and **Mini** still ship only Easy. The
6×6 and 4×4 rater chains produce overwhelmingly Easy at every legal
clueFloor. The deferred fix ("extend the rater with cheaper-to-hit
tier-discriminators for small grids") remains a multi-iteration
project. A reasonable smaller step in the next iteration would be
to *attempt* lever 2 (lower the clueFloor on Six / Mini below the
current `CLUE_BOUNDS` lower bound) and re-profile. The current
`CLUE_BOUNDS` bounds are themselves heuristic and may not be optimal
for the small grids; a few hours of profile-tiers exploration could
reveal whether lever 2 has any room left at all.

### 5.3 Feature follow-ons (not blockers)

- **Daily puzzle.** A natural extension once tier coverage is
  robust — pin a deterministic seed per day for shareable scores.
- **Hint history / undo discipline.** The current hint surface is
  one-shot.
- **Stat exports.** With the per-variant per-tier table now
  populated, an export-to-CSV button is one screen of work.

### 5.4 Technical debt introduced this iteration

- The methodology gap in `profile-tiers.ts` (§C1 above) is
  introduced-and-not-resolved this iteration. The script existed
  before, but iteration 5 *relied on it* for the reliability claim
  underpinning §6/§7, so the gap is now load-bearing.
- The `tier-fixtures.ts` Diabolical / Demonic seeds drifted from
  their summary-traceable origin (§G2 above) — a small but
  load-bearing reproducibility regression.

---

## 6. Verdict

Iteration 5 delivered every named §11 cleanup correctly, the
`--all-tiers` profile sweep gives the post-fix evidence the
iteration-4 review asked for, and the lever-1 widening was sized
correctly under the data the script produces. **The code that
shipped is functionally correct and the unit / build / E2E sweeps
are green.**

The single material follow-up is the methodology gap in
`profile-tiers.ts` (§C1). Closing it would either confirm the
iteration-5 budgets are correctly sized (likely outcome for Easy /
Medium / Expert / Nightmare) or expose that
Diabolical / Demonic need an additional 50 → ~90 widening — a
five-line change after the diagnosis. Until that is done, the
"every tier reliably hits its target within budget" claim from
requirements §15 is empirically supported (matrix passed once) but
not statistically backed.

Recommended next iteration scope: (a) fix C1, (b) refresh the small
stale docblocks (§G2, §G3), and (c) consider a lever-2 exploration
for Six / Mini on the chance their effective floors can be pushed
below the current `CLUE_BOUNDS` lower bound. Everything else can
wait.
