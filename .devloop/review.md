# Iteration 4 — Final Code Review

**Scope:** Iteration-4 deliverables in `.devloop/requirements.md` (Bug B
fix + test gaps) against the working tree at `master @ 201e30b`. Review
performed read-only on 2026-04-29.

**Top-line:** The named goals — repaired `maxClues` semantics, profile
harness, post-tuning matrix E2E, un-skipped Hard/Master tests, tier
fixtures, focused cleanups — are all present in the tree and pass their
verification commands. The tuning step (§6) closed Bug B by way of
**lever 3 (descope)** for every problematic tier. That is honest but
also unsatisfying: Six and Mini now expose only "Easy", and Classic
loses Hard and Master entirely. The iteration ships a working app, but
the player-facing surface is materially smaller, and there is a
methodology gap underneath the descope decisions that should be revisited
before the next iteration touches the rater.

---

## Requirements vs Implementation

### Met

| Requirement | Evidence |
|---|---|
| §4 profiling harness with both `.md` + `.summary.json` outputs, deterministic seeds keyed on `DIFFICULTY_ORDER` rank | `scripts/profile-tiers.ts:91–199`, both output files committed |
| §5.1 `GenerateOptions.maxClues` → `clueFloor` rename; `Math.max(minClues, maxClues)` interaction removed | `src/engine/generator/generate.ts:20, 181` |
| §5.2 consumer drops `clueBoundsUpperForTier` in `generate-for-difficulty.ts` | `generate-for-difficulty.ts:191, 205–207` (no `clueBoundsUpperForTier` reference; only `clueBoundsLowerForTier`) |
| §5.3 `clueFloor` regression test in `generate.test.ts` | `generate.test.ts:86–99` |
| §7 matrix E2E strict-success contract — failure dialog is now a hard fail | `tests/e2e/difficulty-matrix.spec.ts:64–95` |
| §8 Hard / Master un-skipped (with `vi.spyOn(rate)` fallback) | `generate-for-difficulty.test.ts:71–141` |
| §9 `TIER_FIXTURES` table + round-trip test | `src/engine/solver/techniques/tier-fixtures.ts`, `tier-fixtures.test.ts` |
| §10.1 `lastError != null` defensive check + empty-string test | `GenerationFailedDialog.tsx:124`, `GenerationFailedDialog.test.tsx:146–163` |
| §10.2 `cancelGeneration` clears `generationFailure` + test | `store/game.ts:336–346`, `game.test.ts:323–343` |
| §10.3 `generateInWorker` JSDoc on one-at-a-time contract | `generator-client.ts:113–116` |
| §10.4 structurally-valid v2 payload in migration test | `App.test.tsx:124–137` |
| §10.5 Settings 2-second auto-revert under fake timers | `Settings.test.tsx:217–242, 287–337` |
| §10.6 Real-worker smoke (vitest skipped under jsdom; Playwright spec) | `generator-client.real-worker.test.ts`, `tests/e2e/worker-smoke.spec.ts` |
| §11 `package.json` bumped to `0.4.0`, `tsx` devDependency, `profile-tiers` script | `package.json:4, 11, 31` |

### Gaps and partial implementations

1. **Lever 1 (widen `MAX_ATTEMPTS_BY_TIER`) was never exercised, despite
   §6 calling for it as the *first* response to any (advertised, rate <
   0.05) entry.** The table in `generate-for-difficulty.ts:19–28` is
   bit-for-bit the iteration-3 version (50/100 split). The post-tuning
   summary shows `classic:Expert` at rate=0.20, `Diabolical`/`Demonic` at
   0.20, `Nightmare` at 0.10 — all > 0.05, so the §6 threshold says
   nothing needs to change for them. But the iteration jumped straight
   from "rate=0 in the broken baseline" to "lever 3 descope", skipping
   the chance that lever 1 alone might have rescued (e.g.) `classic:Hard`
   at its target floor of 28. The accompanying comment block on lines
   12–18 still says "Iteration 3 §4.3" — it has not been refreshed for
   iteration 4 even though TASK-007 was meant to revisit it.

2. **Methodology gap in TASK-007 → TASK-008.** The descope decisions
   (`variant-tiers.ts`) were applied based on data from the *broken
   baseline* (TASK-003, generated before §5's `maxClues` fix). After §5
   landed, TASK-008 re-ran the profile against the *post-tuning code* —
   but `profile-tiers.ts:93` only iterates `availableTiers(variant)`, so
   the script never re-profiled tiers that TASK-007 had already
   descoped. There is therefore **no committed evidence in this
   iteration** that `classic:Hard` (with corrected `clueFloor=28`),
   `classic:Master` (clueFloor=26), or any of the 8 descoped Six/Mini
   tiers, are genuinely unreachable post-fix. The post-tuning histograms
   (`scripts/tier-distribution.md`) do show that Hard never appears as a
   *rated* tier at any of the surveyed clueFloors (20, 22, 24, 32, 38) —
   suggestive but not conclusive evidence at floor=28. The matrix E2E
   doesn't catch this either, because it iterates the same trimmed
   `availableTiers`.

3. **§9 round-trip test omits the `solved === true` assertion.**
   Requirements §9 says "assert (a) `result.difficulty === tier` and (b)
   `result.solved === true`." `tier-fixtures.test.ts:46–49` only
   checks (a). The omission is small (every fixture passes (a) only if
   the rater fully solved the puzzle, in practice) but the `solved`
   assertion was the explicit guard against a future regression where
   the rater stalls but happens to land on the right tier label.

4. **`MAX_ATTEMPTS_BY_TIER` doc-block.** Now references both stale
   ("Iteration 3 §4.3") and stale-by-implication ("doesn't reliably hit
   the target inside 50 tries") guidance; should at least link or quote
   the iteration-4 profiling result.

### Scope creep

None observable. Every changed file in iteration-4 has a corresponding
task / requirements section. The `__sudokuGameStore` test hook in
`main.tsx:14` predates this iteration.

---

## Code Quality

### Bugs / logic concerns

1. **Cancellation race vs. `cancelGeneration` setState.**
   `store/game.ts:336–346` — when `activeHandle` is non-null, `cancel()`
   triggers the worker-client's `finish({ kind: 'cancelled' })` (which
   resolves the in-flight `await handle.promise` in `newGame`); the
   subsequent `newGame` continuation hits `if (activeHandle !== handle)
   return;` because `cancelGeneration` set `activeHandle = null` first.
   So the cancelled result is dropped, and the outer `cancelGeneration`
   then sets `loading: false, generationFailure: null`. Order is
   correct. The TASK-015 test verifies this. No bug — just noting how
   subtle the ordering is; a comment on the intentional sequence in
   `cancelGeneration` would help future readers.

2. **`profile-tiers.ts` describes `clueFloor` via `minClues` for legacy
   reasons.** Line 117 reads `generate(variant, { seed, minClues:
   clueFloor })` with a long preamble (lines 75–82) explaining the field
   was renamed mid-iteration. Now that §5 is done, this can simply be
   `clueFloor: clueFloor`; passing the new name will keep semantics
   identical and let the comment block be retired. Cosmetic.

3. **`__sudokuGameStore` exposed in production bundles.** `src/main.tsx:14`
   unconditionally writes the singleton store onto `window`. The hook
   is intended for Playwright E2E testing (the hint, new-game,
   notes-and-conflicts, and resume specs all read it), but `main.tsx`
   doesn't gate it behind `import.meta.env.DEV`, so production
   `dist/index.html` ships with it too. Low risk (the store is local
   state, not auth), but unintended exposure of internal mutation hooks
   in shipped JS is normally a smell. Minor.

4. **`useUpdate.checkForUpdates` race.** Already explicitly out of scope
   in §3 (the brief "Up to date" while a new SW is downloading). Not a
   regression — flagging only because the iteration-3 review called it
   out and it lives on in iteration 4 as documented.

5. **Real-worker vitest test is a near no-op.** Under jsdom (the
   project's vitest environment) `Worker` is undefined, so
   `generator-client.real-worker.test.ts:30–34` falls into the
   `skip-style placeholder` branch, asserting `hasWorker === false`. The
   *actual* real-worker check is the Playwright spec
   (`tests/e2e/worker-smoke.spec.ts`). The comment says so, and the
   Playwright spec does cover the import-URL plumbing. But the unit
   "test" reads as if it tests something it doesn't — a future
   developer might miss that the spec is the canonical proof and remove
   the Playwright test as redundant. Renaming it to e.g.
   `real-worker.smoke.placeholder.test.ts`, or just deleting the
   placeholder and pointing at the Playwright file, would be clearer.

6. **`Stats` filter pill UX on Six/Mini.** Each variant now renders
   `[All] [Easy]` filter pills above a single-column table. Functional,
   but looks odd because the filter does nothing when there's only one
   tier. Hide the pill row when `tiers.length <= 1` (a 2-line edit in
   `Stats.tsx:86–110`).

### Error handling

- **`generateForDifficulty` per-attempt try/catch:** robust, with
  `technique` tag extraction and `lastError` propagation through to the
  UI (`generate-for-difficulty.ts:241–252` → worker → store → dialog).
  This is the iteration-3 contribution and remains intact.
- **Worker outer try/catch:** `generator.worker.ts:175–189` now logs the
  stack via `console.warn` before posting `error` — appropriate for
  surfacing finder regressions during development.
- **Save / migration helpers:** all guard against missing storage
  (jsdom-friendly) and treat parse failures as "no save". `migration.ts`
  collects keys before deletion (correct re. `removeItem` index
  shifts).
- **Settings revert timer cleanup:** `Settings.tsx:118–125` clears the
  pending timeout on unmount. Good.

### Security

- No user-supplied input reaches anything more interesting than
  `localStorage` keys (typed slugs, JSON-serialized) and `?slowGenerate=N`
  (matched against `/[?&]slowGenerate=(\d+)/` and coerced via `Number()`,
  used as a `setTimeout` argument; even an injected huge integer just
  parks the worker). No XSS, SQLi, or supply-chain surface introduced.
- The `__sudokuGameStore` test hook noted above is the only mild
  defense-in-depth concern, and it's local-only.

---

## Testing

### Coverage of the iteration's deliverables

- **Profile harness:** `npm run profile-tiers -- --n=1` is the smoke
  verification for TASK-002. No automated test runs the harness, but
  that's by design (it's a developer tool, not a CI gate).
- **`clueFloor` semantics:** locked by `generate.test.ts:86–99`. The
  pre-iteration-4 inverted-floor regression would now be caught
  directly.
- **Bug B regression guard:** the matrix E2E is the canonical guard,
  and it's now strict (a failure dialog appearance fails the test).
  Solid, **modulo the descope-narrowed `availableTiers`** — see Gap #2.
- **Hard / Master:** `generate-for-difficulty.test.ts:71–141` exercises
  the strict-tier acceptance path with a `vi.spyOn(rate)` fallback. The
  test does verify the surrounding plumbing (success kind, rating
  shape, unique-solution sanity) but does not exercise the *real* rater
  on Hard/Master inputs — which is consistent with the requirement
  (§8) but means there is no unit-level signal that a future rater
  change has broken Hard/Master rating fidelity.
- **Tier fixtures:** 6 of 8 tiers have fixtures (Hard, Master omitted by
  design); each fixture asserts `rate(board).difficulty === tier`. The
  `solved` assertion is missing (Gap #3).
- **Settings auto-revert:** thoroughly tested at idle/error/checking
  states + the full lifecycle.

### Untested / under-tested edges

1. **Descope honesty.** No automated test asserts that the
   variant-tiers.ts descopes are still justified. If a future rater
   tweak unlocks Hard/Master/Six's harder tiers, the only way the
   project would discover it is by manually re-running `npm run
   profile-tiers`. A nice addition: a vitest case that spot-checks
   `generate(classicVariant, { seed: <known>, clueFloor:
   clueBoundsLowerForTier(classic, 'Hard') })` and asserts the puzzle
   is **not** rated Hard — i.e. lock in the descope decision so that a
   regression-in-the-good-direction is at least visible.

2. **Profile script output schema.** `scripts/profile-tiers.ts` emits
   both files, but no test parses them. A fixture-tier extraction
   workflow that mis-renames `firstHitSeed` would only break TASK-012
   silently. Worth a 5-line schema test if the script becomes
   load-bearing for other tooling.

3. **`profile-tiers` runtime claims.** §4.4 promised a 6-minute run; the
   committed `scripts/tier-distribution.md` reports 3.3s — but only
   because the iteration shipped with very few advertised tiers. With
   the original 17 cells the runtime would have been substantially
   longer. The contradiction is harmless; it's just worth knowing the
   committed file is profiling *the descoped surface*, not the original
   one.

4. **Real-worker smoke under vitest** — see Code Quality #5.

---

## Recommendations (before "production-ready")

Listed roughly in descending impact. None of these are blockers — the
app is functional and the test suite is green — but each is worth doing
before signing off on iteration 4 as the v0.4.0 baseline.

1. **Re-run the profile against the full original
   `availableTiers`, post-fix.** Temporarily restore Hard / Master /
   Six's middle tiers / Mini's middle tiers in `variant-tiers.ts`,
   run `npm run profile-tiers -- --n=20`, and confirm the descopes are
   still empirically justified at the corrected `clueFloor` semantics.
   Commit the resulting `scripts/tier-distribution.md` as the
   "validated descope" snapshot. If any of those tiers actually do hit
   above 5%, restore them in `availableTiers` and ship a richer player
   surface.

2. **Apply lever 1 retrospectively.** With the data from #1 in hand,
   widen `MAX_ATTEMPTS_BY_TIER` for any tier that profiles in the 5–30%
   band. The §6 formula gives concrete numbers; the iteration-3 50/100
   split is now arbitrary.

3. **Add the `solved` assertion to `tier-fixtures.test.ts:46–49`.**
   Two-line change. Closes the §9 (b) requirement.

4. **Gate `__sudokuGameStore` behind `import.meta.env.DEV`.**
   One-line change in `main.tsx`. Belt-and-braces against shipping a
   mutation hook to production.

5. **Refresh the `MAX_ATTEMPTS_BY_TIER` doc block** — replace the
   "Iteration 3 §4.3" reference with the iteration-4 profiling
   evidence, and either remove `DEFAULT_MAX_ATTEMPTS` (if no consumer
   actually needs it) or document it as a fallback only.

6. **Hide the Stats filter row when there's only one tier.** Tiny UX
   polish on Six/Mini.

7. **Either delete or rename the placeholder real-worker test.**
   Currently misleading.

---

## Future Considerations

### Next features / improvements

- **Surface Hard/Master via the strict tier rule in conjunction with
  `clueBoundsLowerForTier` tuning.** The post-tuning histograms show
  the natural distribution at `clueFloor=24` produces ~10% Diabolical;
  at `clueFloor=22` it produces ~10% Demonic. If profiling at
  `clueFloor=28` (Hard's natural lower bound) reveals zero Hard, the
  honest fix is the iteration-3 review's deferred suggestion: extend
  the rater with cheaper-to-hit tier-discriminators (e.g. an explicit
  "fish" or "wing" tier between Master and Diabolical). That's a
  multi-iteration project.

- **Fix the `usePwaUpdate` resolution-timing race** (§3 deferred).
  When the user clicks "Check for updates" while a new SW is in fact
  downloading, the dialog briefly says "Up to date" before flipping to
  the banner. The proper fix is observing the SW's `updatefound` →
  `installing` → `installed` state machine rather than the polled
  `r.update()` promise.

- **Per-tier success rate telemetry on the Generation Failure dialog.**
  When a player hits the dialog, log the tier + closestRating + lastError
  to a dev-mode console group; if the issue is reproducible, this gives
  the next iteration a concrete signal to tune.

### Architectural decisions to revisit

1. **`variant-tiers.ts` as the source of truth.** Currently `availableTiers`
   has its own list, separate from `CLUE_BOUNDS` (which still lists
   Hard/Master with windows). Two sources of truth for "what tiers exist
   for this variant" will rot at different rates. Consider deriving one
   from the other — e.g. `availableTiers(v)` filters
   `CLUE_BOUNDS[v.id]` by an `advertised: boolean` flag inside each
   window entry. Or attach a `descoped: true` annotation in
   `CLUE_BOUNDS` itself so the rationale lives next to the data.

2. **Profile script's seed-stable-on-rank invariant** is good but
   non-obvious; consider extracting `seedFor(variantId, tier, i)` into
   a shared helper that both the profile script and TASK-012's
   regenerate-fixture workflow can call. Right now the seed convention
   is duplicated across `profile-tiers.ts`, the test file, and
   `tier-fixtures.ts` comments.

3. **The `rate.ts` candidate-grid is a private re-implementation of
   `nextStep` cascading.** The iteration-3 review flagged this as
   deferred technical debt; it lives on in iteration 4 unchanged. If a
   future iteration adds new techniques, both the cascade in
   `index.ts` and the rater's parallel cascade in `rate.ts` will need
   matching edits. A unified solver-with-trace abstraction would close
   this duplication; it's a multi-iteration refactor.

4. **`MAX_ATTEMPTS_BY_TIER` is hand-maintained.** Now that
   profiling is data-driven, the table could be auto-generated from the
   summary JSON (or at least cross-checked by a unit test that loads the
   summary and asserts attempt budgets cover the §6 formula's `N`).

### Technical debt introduced this iteration

1. **The descope decisions in `variant-tiers.ts` reference the
   *baseline-with-bug* histogram even though TASK-008 re-ran post-fix.**
   The comment block on lines 16–29 says the descopes were taken because
   `rate=0 (advertised, sampleSize=20)` and "could not be rescued by
   lever 1 or lever 2". Lever 1 was never actually tried for these
   tiers, and lever 2 ("already at the lower bound of CLUE_BOUNDS")
   hardcodes the iteration-3 bounds. The footprint of the resulting
   simplification (`six: ['Easy']`, `mini: ['Easy']`) is large enough to
   merit a clearly-dated post-fix follow-up.

2. **`MAX_ATTEMPTS_BY_TIER`'s doc references stale iteration numbers.**
   Already discussed.

3. **Profile script's deprecated parameter naming preamble** (`profile-tiers.ts:75–82`)
   exists only because `clueFloor` was the post-rename name. Now that
   the rename has shipped, this comment is obsolete. Removing it
   tightens the file by 8 lines.

4. **Two parallel `slot key` formats.** `save.ts:48–50` uses
   `${variantId}:${difficulty.toLowerCase()}`; `stats.ts:37–39` uses
   `${variantId}:${difficulty}` and trusts callers to lowercase first
   (which they do in `Home.tsx:38, 213`). One central `slotKey`
   helper exported from a shared module would avoid the asymmetry.

5. **`__APP_VERSION__` is referenced in 5 stores/files via a Vite-injected
   global.** A typed `import.meta.env`-style helper would be cleaner;
   right now consumers have to remember to declare a `__APP_VERSION__`
   ambient in their tsconfig types.

---

## Summary

Iteration 4 closes Bug B, ships the empirical-tuning workflow it was
designed around, removes the test-side leniency that hid the bug,
and lands every named cleanup. The verification commands in
`.devloop/tasks.md` all pass. The strict-success matrix E2E and the
solved-flag-driven rater fixes are well done. **The headline caveat is
that "fix Bug B" was achieved primarily by descoping problematic tiers
rather than tuning them; the iteration's success criterion of "every
advertised tier reliably loads a playable puzzle" is met because the
*advertised* set has shrunk substantially.** That trade is sometimes the
right call, but it is worth re-validating with data taken after the
`maxClues` semantics fix, which the current commit does not have.
Recommend the seven small follow-ups in §Recommendations before
treating v0.4.0 as a stable line.
