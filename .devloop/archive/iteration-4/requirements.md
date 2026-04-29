# Sudoku PWA — Iteration 5 Requirements: validate descopes + iteration-4 review cleanups

This iteration is driven entirely by the iteration-4 final code review
(`.devloop/archive/iteration-3/review.md`). It is a small,
focused follow-up: no new features, no UX changes beyond a
one-line Stats polish, no architectural refactors.

The purpose is to close out the headline caveat the review left on
iteration 4 — that "fix Bug B" was achieved primarily by **descoping**
problematic difficulty tiers rather than tuning them, using data taken
from the broken-baseline run *before* the `maxClues` semantics fix
landed. Iteration 5 re-validates each descope with post-fix data, applies
**lever 1** (widen `MAX_ATTEMPTS_BY_TIER`) where the data justifies it,
restores any tier whose post-fix rate clears the §6 5% threshold, and
folds in the seven small recommendations from §Recommendations.

The v0.4.0 baseline is unchanged except where called out below. Iteration
4's requirements, tasks, progress, and review are archived at
`.devloop/archive/iteration-3/`.

## 1. Motivation

The iteration-4 review confirmed every named deliverable shipped, but
flagged a methodology gap underneath the descope decisions in
`src/engine/generator/variant-tiers.ts`. Two reinforcing problems:

1. **Descopes are based on broken-baseline data.** The
   `VARIANT_TIERS` doc-block cites the iteration-4 baseline summary
   (`scripts/tier-distribution.summary.json` as committed in TASK-003),
   which was generated *before* the §5 `maxClues` → `clueFloor`
   semantics fix landed. The post-tuning rerun in TASK-008 only
   iterated `availableTiers(variant)` — i.e. the *already-narrowed*
   set — so there is no committed evidence that
   `classic:Hard`/`classic:Master` or any of the eight Six/Mini
   descopes are unreachable post-fix.

2. **Lever 1 was never tried.** Iteration-4 §6 lists three levers
   (widen `MAX_ATTEMPTS_BY_TIER`, lower `clueBoundsLowerForTier`,
   descope) and explicitly puts widening attempts as the *first*
   response to a low natural rate. Iteration 4 jumped straight to
   lever 3. The current `MAX_ATTEMPTS_BY_TIER` table is bit-for-bit
   the iteration-3 50/100 split. For tiers whose post-fix profile lands
   in the 5–30% band, widening the attempt budget per the §6 reliability
   formula is exactly the cheap fix we owe the player surface.

Beyond the headline caveat, the review listed seven small recommendations
(§Recommendations 1–7), of which #1 and #2 are the headline fixes
above. The remaining five (solved-flag assertion, DEV-gate the test
hook, doc-block refresh, Stats UX, real-worker placeholder) are
individually small but worth bundling so the next iteration starts
clean.

## 2. Goals

- Re-profile every (variant × tier) cell in the **full** difficulty
  matrix (`DIFFICULTY_ORDER × {classic, six, mini}`), not just the
  descoped surface, using post-fix code.
- Apply lever 1 to `MAX_ATTEMPTS_BY_TIER` for any tier whose post-fix
  natural rate lands in the 5–30% band, sized via the §6 reliability
  formula.
- Restore each tier whose post-fix rate ≥ 5% to `availableTiers`. For
  any tier that remains descoped, replace the iteration-4 baseline
  citations with iteration-5 post-fix evidence, so the doc-block
  doesn't lie about which run the descope rests on.
- Land the five smaller cleanups from §Recommendations 3–7.

## 3. Non-goals

- No new techniques, no new variants, no new tiers. The 34-technique
  catalog and the variant set are unchanged.
- No rater changes. If the data shows that `classic:Hard` is genuinely
  unreachable at the corrected `clueFloor` even with widened attempts,
  the iteration-4 review's deferred suggestion ("extend the rater with
  cheaper-to-hit tier-discriminators") remains deferred — it's a
  multi-iteration project.
- No architectural refactors. The candidate-grid duplication in
  `rate.ts`, the `slotKey` asymmetry between `save.ts` and `stats.ts`,
  the `__APP_VERSION__` ambient typing, and unifying `availableTiers` /
  `CLUE_BOUNDS` are all deferred.
- No fix for the `useUpdate.checkForUpdates` resolution-timing race —
  still out of scope (review §3 deferral carried forward).
- No CI E2E runs. Local pre-push gate only.
- No save-schema migration changes. v3 is unchanged.

## 4. Profile script enhancements

Three small, contained changes in `scripts/profile-tiers.ts`:

### 4.1 `--all-tiers` flag

The script currently iterates `availableTiers(variant)` (line 93),
which means it cannot profile a tier that has been descoped without a
manual revert. Iteration 5 needs to do exactly that for the
re-validation step.

- Extend the argv parser to recognize `--all-tiers`. The flag is
  default-off so existing default `npm run profile-tiers` behavior is
  unchanged.
- When `--all-tiers` is set, iterate `DIFFICULTY_ORDER` for every
  variant whose `CLUE_BOUNDS[variant.id]` defines a window for that
  tier. Tiers without a defined window are skipped (current behavior).
- The summary JSON's `advertised: boolean` field is set honestly:
  `true` if `availableTiers(variant).includes(tier)`, `false`
  otherwise. The matrix E2E and other tooling that reads
  `advertised` continue to work, and the consumer of the JSON can
  tell at a glance which entries reflect the current player surface
  vs. which are diagnostic-only.

### 4.2 Emit `firstHitBoard`

Per-tier fixture extraction in iteration 4 was a manual
regenerate-from-seed dance. Iteration 5 collapses that to a copy-paste
by extending the per-cell summary with a `firstHitBoard: string | null`
field — the dotted-digit row-major string of the first puzzle that
rated as the target tier (or `null` if none did). Test-time
reproducibility is unchanged: the seed is still authoritative; the
board string is a convenience.

The schema extension is additive. The TypeScript shape becomes:

```ts
interface SummaryEntry {
  rate: number;
  advertised: boolean;
  sampleSize: number;
  firstHitSeed: number | null;
  firstHitBoard: string | null;
}
```

### 4.3 Retire the obsolete `minClues` preamble

`profile-tiers.ts:75-82` carries a long iteration-3 explanation of why
the script passes the floor as `minClues` rather than `maxClues`. Now
that the §5 rename has shipped (and `clueFloor` is the canonical name),
the preamble is wrong-by-implication and the call site
(`generate(variant, { seed, minClues: clueFloor })`, line 117) reads
oddly. Replace with `generate(variant, { seed, clueFloor })` and delete
the stale comment block. Cosmetic cleanup, but fits the same edit
window as §4.1 and §4.2.

## 5. Re-validate descopes (post-fix profile)

Run `npm run profile-tiers -- --all-tiers --n=20` against the current
working tree. The full 17-cell sweep should complete in ~6 minutes per
the iteration-4 §4.4 estimate. Commit the resulting
`scripts/tier-distribution.md` and
`scripts/tier-distribution.summary.json`. This is the *validated post-fix
baseline* — the snapshot iteration 4 should have produced but didn't.

The summary JSON is the input the next sections read mechanically.

## 6. Apply lever 1: widen `MAX_ATTEMPTS_BY_TIER`

Read the iteration-5 baseline summary. For each (variant, tier) cell:

- If `rate ≥ 0.05` (the §6 threshold) **and** the tier is currently
  descoped from that variant: it is a restoration candidate (see §7).
- If `rate ≥ 0.05` and the tier is currently advertised: confirm the
  current per-tier attempt budget gives ≥ 99.8% reliability via the
  iteration-4 §6 formula (`N = ceil(log(0.002) / log(1 - rate))`). If
  the existing budget is below `N`, widen it.
- If `rate < 0.05` and the tier is currently descoped: the descope
  stands; cite the iteration-5 evidence in the §7 doc-block update.
- If `rate < 0.05` and the tier is currently advertised: this is a
  regression-since-iteration-4 — surface in the post-write review.

Update `MAX_ATTEMPTS_BY_TIER` in
`src/engine/generator/generate-for-difficulty.ts`. The doc-block above
the table (`generate-for-difficulty.ts:11-18`) currently references
"Iteration 3 §4.3" and a "doesn't reliably hit the target inside 50
tries" rationale that predates the iteration-5 data. Refresh it to:

- Reference the iteration-5 profile evidence by date.
- For any non-default entry, cite the (variant, tier, rate) tuple that
  justified the widened budget.

The §6 formula caps practical budgets at 200. Beyond that, fall to
§7 (descope) rather than spending huge attempt budgets on a too-rare
tier — same rule as iteration 4.

## 7. Restore tiers in `VARIANT_TIERS`

For each (variant, tier) restoration candidate identified in §6,
restore the tier in `VARIANT_TIERS` in
`src/engine/generator/variant-tiers.ts`. Keep the per-variant tier list
in `DIFFICULTY_ORDER` order.

The `VARIANT_TIERS` doc-block currently cites the iteration-4 baseline
(`Source: scripts/tier-distribution.summary.json baseline (committed in
TASK-003, generated 2026-04-29)`) and lists each descoped tier with the
broken-baseline histogram. Rewrite the doc-block to:

- Cite the iteration-5 post-fix profile by date.
- For any tier that **remains** descoped in the new
  `VARIANT_TIERS`, cite the iteration-5 (variant, tier, rate, sampleSize)
  tuple as the rationale.
- For any tier that **was** descoped in iteration 4 but is restored in
  iteration 5, the `VARIANT_TIERS` change itself is the evidence —
  the doc-block need only note in summary that lever 1 was applied
  per the iteration-5 baseline.

## 8. Add fixtures for restored tiers

For each tier restored in §7:

- Look up its `firstHitSeed` and `firstHitBoard` in the iteration-5
  baseline summary JSON.
- Add a `TierFixture` entry to `TIER_FIXTURES` in
  `src/engine/solver/techniques/tier-fixtures.ts` using those values.
- The `Partial<Record<Difficulty, TierFixture>>` shape and
  `tier-fixtures.test.ts` iteration over `Object.entries(TIER_FIXTURES)`
  mean no schema changes are needed.

If no tier is restored, this section is a no-op.

## 9. Strengthen `tier-fixtures.test.ts`

The iteration-4 review §Gap 3 calls out that the round-trip test only
asserts `rate(board).difficulty === tier`. Requirements §9 (b) of
iteration 4 explicitly demanded `rate(board).solved === true` as well —
the explicit guard against a future regression where the rater stalls
but happens to land on the right tier label.

Two-line edit in `tier-fixtures.test.ts:46-49`: add `expect(result.solved).toBe(true)`.

## 10. Re-run profile post-tuning

Re-run `npm run profile-tiers -- --all-tiers --n=20`. Commit the
resulting `scripts/tier-distribution.md` and
`scripts/tier-distribution.summary.json`. This is the iteration-5
**final** snapshot — it reflects the state shipping with this iteration
(post lever-1 widening, post any tier restorations).

This second profile run also serves as the reliability check for §6:
restored tiers should now hit their target rate within their widened
attempt budgets in subsequent strict-tier runs. If a restored tier's
post-tuning rate dropped below 5% (e.g. due to seed-range variance)
its restoration must be reverted before the iteration ships.

## 11. Smaller cleanups

These are pulled directly from the review's §Recommendations 4, 5, 6, 7
and from the bundled doc-block refresh discussed above.

### 11.1 Gate `__sudokuGameStore` behind `import.meta.env.DEV`

`src/main.tsx:14` unconditionally writes `window.__sudokuGameStore`.
The hook is intended for Playwright E2E tests
(`hint-learn-more`, `new-game`, `notes-and-conflicts`,
`resume`) — all of which run against the `vite dev` server (port
5179, where `import.meta.env.DEV` is `true`). The `pwa-update.spec.ts`
spec runs against `vite preview` (port 5180, `DEV` false) but does not
read the hook. Gating is safe.

One-line change: wrap the assignment in `if (import.meta.env.DEV) { … }`.

### 11.2 Hide Stats filter pill row when `tiers.length <= 1`

`src/screens/Stats.tsx` (lines ~86–110) renders an `[All] [Easy]`
filter pill row above each variant's table. With Six and Mini
currently advertising only `Easy`, the row is functional but visually
useless. Hide the pill row when the variant exposes only a single
tier (so the player just sees the table).

This change pre-supposes Six/Mini still ship with one tier after §6/§7
— which is the most likely outcome given their post-tuning histograms
in iteration-4. If §6 restores additional tiers for Six or Mini, the
fix still applies (it's a `tiers.length <= 1` guard, not a per-variant
hard-code).

### 11.3 Resolve the placeholder real-worker vitest test

`src/workers/generator-client.real-worker.test.ts` exists only because
iteration-4 `§10.6` originally hoped vitest could host a real `Worker`.
Under the project's jsdom environment `Worker` is undefined, so the
file falls into a skip-style `expect(hasWorker).toBe(false)` placeholder.
The actual real-worker check lives in
`tests/e2e/worker-smoke.spec.ts` — Playwright is the canonical proof.

The placeholder is misleading. Delete the file. The e2e spec is
already a documented part of the suite, and removing the placeholder
prevents a future developer from believing it's load-bearing and (for
example) deleting the e2e spec in its place.

### 11.4 (Doc-block refreshes — covered inline)

The §6 refresh of `MAX_ATTEMPTS_BY_TIER`'s doc-block and the §7 refresh
of `VARIANT_TIERS`'s doc-block together close review §Recommendation 5.

## 12. Existing code to update

Non-exhaustive list of files this iteration touches:

- `scripts/profile-tiers.ts` — `--all-tiers` flag; emit
  `firstHitBoard`; retire stale `minClues` preamble; rename the
  call-site to `clueFloor: clueFloor`.
- `scripts/tier-distribution.md` — overwritten twice (post-fix
  baseline, post-tuning final). Both go in git history.
- `scripts/tier-distribution.summary.json` — same; gains
  `firstHitBoard` field.
- `src/engine/generator/generate-for-difficulty.ts` — possibly widen
  `MAX_ATTEMPTS_BY_TIER` per the iteration-5 formula; refresh
  doc-block.
- `src/engine/generator/variant-tiers.ts` — possibly restore tiers in
  `VARIANT_TIERS`; rewrite doc-block to cite iteration-5 evidence.
- `src/engine/solver/techniques/tier-fixtures.ts` — add fixtures for
  any restored tiers.
- `src/engine/solver/techniques/tier-fixtures.test.ts` — add
  `solved === true` assertion.
- `src/main.tsx` — gate `__sudokuGameStore` behind
  `import.meta.env.DEV`.
- `src/screens/Stats.tsx` — hide filter pill row when `tiers.length <= 1`.
- `src/workers/generator-client.real-worker.test.ts` — deleted.
- `package.json` — version bump.
- `.devloop/archive/iteration-4/` — created during DevLoop's archive
  step.

## 13. Testing strategy

- **Unit**: `tier-fixtures.test.ts` gains the `solved` assertion; if
  fixtures are added for restored tiers they are auto-included by the
  existing `Object.entries(TIER_FIXTURES)` iteration. No other new
  unit tests required.
- **Profile harness smoke**: `npm run profile-tiers -- --all-tiers
  --n=1` exits cleanly. Smoke check, not a regression guard.
- **E2E (local pre-push, Chromium + WebKit)**: the strict matrix
  (`tests/e2e/difficulty-matrix.spec.ts`) iterates the new
  `availableTiers(variant)` (which, if §7 restored tiers, is now
  larger). It should pass on every advertised tier. If a restored tier
  fails the strict matrix, that tier's restoration must be reverted
  before the iteration ships — the matrix is the canonical guard.
- **Playwright `__sudokuGameStore` consumers**: `hint-learn-more`,
  `new-game`, `notes-and-conflicts`, and `resume` continue to pass
  (they run against `vite dev` where `DEV` is true).
- **Playwright `worker-smoke` and `pwa-update`**: unaffected.

## 14. Edge cases and failure modes

- **Profile reveals a tier is regression-since-iteration-4 (advertised
  but rate < 5%)**. Treat as a restoration-in-reverse: descope the
  tier, cite the iteration-5 evidence. This is unlikely given the
  iteration-4 post-tuning rates were 10–90% for advertised tiers,
  but the data is data.
- **Restored tier passes profile but fails strict matrix.** Indicates
  the §6 attempt-budget formula's confidence interval was too narrow
  for that cell. Either widen further (cap 200) or revert the
  restoration. Per §10 final-profile gate.
- **Profile runtime overshoots 10 minutes.** Re-run with `--n=10`.
  Histograms remain meaningful; the rates have wider confidence
  intervals — reflect that in the per-tier attempt budget.
- **No tier ends up restored.** Iteration 5 is still meaningful —
  the post-fix evidence replaces the broken-baseline citations, lever
  1 is still applied where rates are 5–30%, and the smaller cleanups
  ship. The version bump becomes patch (0.4.1) rather than minor.
- **A restored tier breaks an existing fixture-tier round-trip.**
  Shouldn't happen — fixtures are tier-specific, not cross-tier — but
  the post-write review pass would catch it.

## 15. Success criteria

- `scripts/tier-distribution.md` is committed twice in iteration-5
  history: a post-fix baseline (after §4 changes, before §6) and an
  iteration-5 final (after §10).
- The iteration-5 baseline `tier-distribution.summary.json` covers
  every cell in `DIFFICULTY_ORDER × {classic, six, mini}` with a
  defined `CLUE_BOUNDS` window.
- `MAX_ATTEMPTS_BY_TIER` reflects lever-1 widening for any tier whose
  post-fix rate lands in the 5–30% band; its doc-block cites
  iteration-5 evidence.
- `VARIANT_TIERS` includes every tier whose post-fix rate ≥ 5%; its
  doc-block cites iteration-5 evidence for any remaining descopes.
- `TIER_FIXTURES` has an entry for every advertised tier in the new
  `VARIANT_TIERS`; the fixtures are reproducible from `firstHitSeed`
  in the iteration-5 baseline summary.
- `tier-fixtures.test.ts` asserts `result.solved === true` for every
  fixture.
- `__sudokuGameStore` is no longer exposed in production builds.
- `Stats.tsx` does not render a filter pill row for variants advertising
  a single tier.
- `generator-client.real-worker.test.ts` is deleted; the canonical
  real-worker smoke remains
  `tests/e2e/worker-smoke.spec.ts`.
- The strict matrix E2E passes on Chromium and WebKit for every
  advertised tier in every variant.
- Unit, type-check, and production-build sweeps pass cleanly.
- `package.json` version is bumped to 0.4.1 (patch) if no tier was
  restored, or 0.5.0 (minor) if any tier was restored.
- No regressions in v0.4.0 functionality — existing E2E specs and
  unit suites still pass.
