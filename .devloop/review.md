# Sudoku PWA — Iteration 2 Code Review

Scope: difficulty overhaul (8 tiers, 27 new techniques, strict tiering, Web
Worker generation, loading UX, techniques help section, save versioning).
Reviewed against `.devloop/requirements.md` and `.devloop/tasks.md`.

Overall: the iteration is well-executed and meets nearly all stated
requirements. The architecture is clean (engine ↔ store ↔ worker ↔ UI
boundaries are crisp), test discipline is high (positive *and* negative
fixtures per technique, fake-worker tests for the worker client), and
accessibility/keyboard handling have not regressed. The findings below are
mostly polish, gaps, and one E2E test that ships skipped.

---

## 1. Requirements vs Implementation

### What is fully met

- **Eight-tier `Difficulty` union and `DIFFICULTY_ORDER`** in
  `src/engine/generator/rate.ts` (lines ~39-58).
- **Variant tier caps** — `availableTiers()` returns the correct slices
  (Mini=3, Six=6, Classic=8) and `Home.tsx` falls back to the highest
  available tier on variant change.
- **`CLUE_BOUNDS`** extended to all 8 tiers for Classic; Mini/Six omit
  infeasible upper tiers consistently with their caps.
- **All 34 techniques** present as a `<name>.ts` + `<name>.test.ts` +
  `<name>.fixture.ts` triplet under `src/engine/solver/techniques/`. Each
  test exercises positive + negative fixtures.
- **`TECHNIQUE_TIER` rebuild** — naked-pair/triple → Expert,
  box-line-reduction → Hard, x-wing → Master per spec §5.2.
- **Strict tier matching** — `generate-for-difficulty.ts` accepts only when
  `rate(p).difficulty === target`.
- **Retry policy** — 50 attempts AND 60 s wall-clock timeout enforced;
  `GenerationFailed` includes `closestRating`, `attempts`, `elapsedMs`.
- **Progress callback** — fires only on rejected attempts, matching spec.
- **Web Worker pipeline** — `src/workers/generator.worker.ts` +
  `generator-client.ts` correctly serialise one request at a time, expose
  `cancel()` (via `worker.terminate()`), and surface progress events. The
  client's fake-worker test suite covers happy path, failure, error,
  cancel, post-cancel message ignoring, and post-resolution cancel no-op.
- **Async `newGame`** — `src/store/game.ts` flips `loading`, awaits the
  worker, surfaces `generationFailure`, and exposes `cancelGeneration()`.
- **Loading UX** — `useDebouncedFlag(200)` gates the overlay; the 10 s
  Cancel-button reveal is implemented in `LoadingOverlay.tsx`.
- **Fallback dialog** — `GenerationFailedDialog.tsx` correctly hides the
  *Try [easier]* action when the target is the lowest tier.
- **Help section** — `Techniques.tsx` index, `TechniqueDetail.tsx` 3-step
  walkthrough, Reset, and `catalog.ts` single-source-of-truth all wired.
  `catalog.test.ts` asserts every `TechniqueId` in `TECHNIQUE_TIER` has a
  catalog entry.
- **Bottom-tab Learn entry** in `App.tsx`.
- **Hint Learn-more link** in `Hint.tsx` navigates to the matching detail
  page.
- **Save versioning** — `sudoku.{save,stats,settings}.v2` keys, each
  persisted record stamps `appVersion` from `__APP_VERSION__`; `package.json`
  bumped to `0.2.0`; `vite.config.ts` `define` correctly wires the global
  and `vite-env.d.ts` declares it.

### Gaps and partial implementations

1. **v1 localStorage entries are *ignored*, not *dropped*.** `save.ts`,
   `stats.ts`, and `settings.ts` all read only the new `v2` keys. Old v1
   data sits in localStorage forever. Requirements §9.1 says "v1 entries
   silently dropped on first load" — currently it is the *behaviour* (we
   don't read them) but the bytes remain. If the intent was to free the
   storage, add `localStorage.removeItem('sudoku.<x>.v1')` on first v2 load.

2. **E2E test for the loading overlay is `test.skip`.**
   `tests/e2e/difficulty-loading.spec.ts:29` is skipped because real Demonic
   generation is too non-deterministic to assert spinner → 10 s Cancel →
   Cancel → Home. The unit test in `LoadingOverlay.test.tsx` covers
   rendering, but the integration of worker + store + overlay + cancel +
   navigation is not E2E-verified. Requirements §13 implies this should
   pass; right now it is a coverage gap.

3. **Simple Coloring is narrower than the canonical technique.**
   `simple-coloring.ts:138-254` only implements color-wrap (same-color
   cells in a shared house). The classic technique also includes the
   "color trap" elimination (cells outside the chain that see both
   colors). Tests don't cover the missing case. The rater works because
   it only relies on wrap, but the help page may demonstrate a strictly
   smaller technique than its name suggests.

4. **Nice Loop discontinuous-strong (placement) branch is uncovered.**
   `nice-loop.ts:439-464` (`buildDiscontinuousStrongResult`) is reachable
   from the production code but no fixture/test exercises it. The
   continuous and discontinuous-weak branches *are* covered.

5. **`useDebouncedFlag.ts` has no dedicated unit test.** Its behaviour is
   indirectly exercised via `Game.test.tsx`, but the hook itself is small
   and subtle (must never return `true` before `ms` elapses) — worth a
   focused test.

### Scope creep

None observed. The implementation closely tracks the requirements and
tasks document.

---

## 2. Code Quality

### Bugs and logic concerns

1. **Silent skip when an extended technique fires but produces no
   eliminations.** In `rate.ts` (around lines 672-688), several technique
   branches `continue` only when `applyEliminations(...)` returns `true`.
   If a finder reports eliminations the rate.ts grid has already removed,
   the chain "halts" and the puzzle falls back to Expert. This is the most
   consequential issue: it can mis-classify a Nightmare puzzle whose only
   fireable technique happens to report a no-op as Expert.

2. **`hardestTechnique` else-if branch is dead.** `rate.ts:611-613` checks
   `else if (hardestTechnique == null)` after the strictly-greater branch.
   Since the first call sets `hardestTechnique` non-null, the else-if can
   never run. Cosmetic, but confusing.

3. **`maxRetries: 0` silently coerced to 1.** `generate-for-difficulty.ts`
   uses `Math.max(1, options.maxRetries ?? DEFAULT_MAX_ATTEMPTS)`. A test
   passing `maxRetries: 0` (e.g. for a deterministic "fail immediately"
   path) would silently get one attempt. Minor.

4. **`Difficulty` parameter mutation.** `generate-for-difficulty.ts:142-145`
   reassigns the `difficulty` parameter after `normalizeDifficulty`. Use a
   local `const target` instead.

5. **Expert fallback conflates two failure modes.** When the rater's chain
   stalls, it returns `'Expert'`. This means "couldn't solve with our
   techniques" (probably very hard) and "actually rates Expert" share the
   same label, so `generateForDifficulty('Expert')` will accept either —
   exactly the behaviour iteration 2 set out to fix for the *upper* tiers
   but quietly preserves at the boundary.

6. **`Home.handleNewGame` does not await `newGame`.** `Home.tsx:111-112`
   fires the Promise and immediately calls `onEnterGame()`. This is by
   design (the loading overlay drives the UX) but a synchronous failure
   inside `resolveVariant` would escape as an unhandled promise rejection.
   Same pattern in `Game.tsx:33` and `GenerationFailedDialog.tsx:53,60`.

7. **`GenerationFailure.elapsedMs=0` for the `error` kind.**
   `game.ts:317-322` synthesises empty stats and the dialog shows a
   generic "couldn't find" message — opaque for debugging worker errors.
   Surfacing `result.message` for the `error` kind would help triage.

8. **Cascade vs display ordering divergence.** `index.ts:130-172` has a
   comment claiming the `techniques[]` cascade mirrors `engine/generator/rate.ts`,
   but the cascade has `naked-pair`/`naked-triple` before `pointing`/
   `box-line-reduction`, while `catalog.ts` `TECHNIQUE_ORDER` puts
   `pointing`/`box-line-reduction` first. Verify which is canonical — if
   the rater and `nextStep` disagree, hints can name a different technique
   than the one the rater believes is hardest.

### Performance

1. **`peers()` allocates per call.** `peers.ts:46-53` builds a fresh array
   plus a Set on every call. `computeCandidates` calls it for every empty
   cell, every technique re-computes candidates from scratch, and the
   34-step cascade runs all of this per puzzle. A module-level memoization
   keyed on `(variant, pos)` would be a high-impact, low-risk win.

2. **`forcing-chains` repeats a full O(houses × digits × houseSize) scan
   per propagated placement.** `forcing-chains.ts:227-273` (`findNextSingle`)
   could maintain incremental per-house digit counts. The 50-implication
   cap saves us from runaway behaviour, but this finder is the dominant
   cost on Nightmare-tier rejections.

3. **`death-blossom`'s petal backtracking** can explode (potentially
   100^9) on mid-game boards with hundreds of ALSes. The cells-overlap
   prune is the only safeguard. Practically OK for Nightmare hint latency
   but worth flagging.

4. **`nice-loop` is bounded by `MAX_LEN = 12`.** Cycles longer than 12 are
   silently missed. Acceptable trade-off given the worst-case explosion,
   but document it.

### Code smells / minor issues

- **Fixture-type duplication.** Every `<name>.fixture.ts` redeclares its
  own local `TechniqueFixture` interface (≈34 copies) because catalog.ts
  imports fixtures and a cycle would otherwise form. Extract the schema to
  `fixture-types.ts` and import from both ends.
- **`rate.ts` `iterateHouses`** rebuilds the full house list at every call
  site — a per-variant cache would be a small win.
- **`Candidates = (Set<Digit> | null)[][]`** uses `null` as a "filled cell"
  marker; correct but a bitmask would be much smaller and faster.
- **`stats.ts:148` `merge`** spreads persisted entries over fresh ones, so
  retired tier keys would persist forever. Currently only adding tiers, so
  not yet a problem.

### Security

- No `dangerouslySetInnerHTML`. React text-node escaping is in place
  throughout. No XSS surface found.
- localStorage parsing in `save.ts:55-79` defends against parse errors and
  non-object roots, but does not validate the *interior* shape of
  `SavedGame` entries (no type-check on `cells`, `mistakes`, etc.).
  `deserializeBoardCells` catches dimension mismatches at game-load time,
  but `getSavedGame` is exposed publicly and can return malformed data.
  Same for `stats.ts:143-150`. Consider zod-style validation, especially
  now that an `appVersion` stamp invites future migration code that might
  consume these fields.

### Accessibility

- `LoadingOverlay.tsx` correctly uses `role="status"`, `aria-live="polite"`,
  `aria-busy="true"`.
- `GenerationFailedDialog.tsx:71-74` has `role="dialog"`, `aria-modal`,
  `aria-labelledby` — but **no focus management**. A screen-reader user
  has to hunt for the buttons; a keyboard user has no Escape handler.
  Trapping focus and adding `Escape → Cancel` would be a small
  high-value fix.
- `Home.tsx` `radiogroup`, `Stats.tsx` table semantics, and tab bar are
  good.
- Minor: `TechniqueDetail.tsx:191-198` Back button is just "← Back"; an
  `aria-label="Back to technique list"` would help.

---

## 3. Testing

### Adequacy

- **Unit tests for techniques** — strong. Each technique has positive +
  negative fixtures, an empty-board null case, and ≥1 hand-built negative.
  `catalog.test.ts` enforces parity between `TECHNIQUE_TIER` and the
  catalog so a new technique cannot ship without a fixture.
- **`rate.test.ts`** — solid hand-built fixtures per Classic tier;
  acceptance lists (e.g. `['Master','Expert']`) acknowledge fallback
  non-determinism rather than asserting unrealistic strictness.
- **`generate-for-difficulty.test.ts`** — covers strict tier rule,
  attempts cap, timeout, and `onProgress` semantics with bounded
  per-test timeouts.
- **`generator-client.test.ts`** — excellent FakeWorker coverage of all
  happy/sad paths.
- **Component tests** — `Game.test.tsx` exercises the 199 / 200 / 150 ms
  debounce thresholds precisely with fake timers.

### Untested edge cases / gaps

1. **No E2E for the loading overlay → Cancel flow.** `difficulty-loading.spec.ts`
   ships skipped. Add a test-only escape hatch (e.g. `?slowGenerate=1`
   query param injecting a sleep) so this can be deterministic.
2. **No unit test for `newGame` *failure* paths.** `game.test.ts` covers
   the happy path; no test asserts that `kind:'failed'` or `kind:'error'`
   resolves into the right store state (`loading:false`,
   `generationFailure` populated).
3. **No unit test for cancelling an in-flight `newGame`.**
4. **`Game.test.tsx` does not cover the Cancel button reveal at 10 s** or
   the cancel-callback wiring inside the screen.
5. **No test for `useDebouncedFlag.ts`.**
6. **Nice-loop discontinuous-strong (placement) branch** has no fixture.
7. **`rate.test.ts` CLUE_BOUNDS tests** don't validate the new tiers
   (Master / Diabolical / Demonic / Nightmare for Classic).
8. **No round-trip test** that a fixture-from-catalog X for tier T is
   actually rated T by `rate()`. This would catch fixture drift cheaply.
9. **No "restart on progress" invariant test.** A regression that walked
   the cascade once instead of restarting at Naked Single after each
   step would not fail any current test.
10. **`hint-learn-more.spec.ts`** asserts a specific technique name
    ("Naked Single"). If the hint-ordering implementation ever changes,
    the test breaks silently. Consider asserting only the link's `href`,
    or any non-null technique link.
11. **`vitest.config.ts` has no coverage configuration.** No metric in CI.
12. **`playwright.config.ts` runs only Chromium.** A PWA targeting iOS in
    particular should at minimum smoke-test WebKit.
13. **No retries configured** in `playwright.config.ts` — flaky tests
    fail outright.

---

## 4. Recommendations (before "production ready")

In rough priority order:

1. **Decide whether v1 keys should be removed**, and if so, call
   `removeItem('sudoku.{save,stats,settings}.v1')` once on app startup.
   Without this, every user who upgrades carries dead bytes forever.
2. **Replace the skipped `difficulty-loading.spec.ts`** with a
   deterministic version. Add a query-param or window-flag that makes the
   worker take ≥10 s on demand.
3. **Fix the silent-skip mis-rating in `rate.ts`.** When an extended
   finder fires but `applyEliminations` returns `false`, the chain should
   either retry the finder (after re-computing candidates) or be treated
   as a real "no progress" signal and continue to the next finder — not
   silently terminate the rating loop. At minimum, log a warning.
4. **Reconcile the cascade vs catalog ordering.** Either align `index.ts`
   with `catalog.ts` or update the comment to explain the divergence.
5. **Strengthen save/stats/settings schema validation** with a small
   per-entry validator (zod or hand-rolled). Today a corrupt v2 entry is
   handed to game-load code and only caught by an unrelated dimension
   check.
6. **Add focus management + Escape handling to `GenerationFailedDialog`.**
7. **Memoize `peers(variant, pos)`** at module scope.
8. **Add the missing tests**: `useDebouncedFlag`, async `newGame` failure,
   cancel-in-flight, nice-loop placement, fixture round-trip via `rate()`.
9. **Surface worker error messages** in `GenerationFailedDialog` for the
   `error` kind.
10. **Add Playwright retries on CI** and at least a WebKit smoke project.

---

## 5. Future Considerations

### Features and follow-ups

- **Migrate v1 saves rather than discarding.** Now that `appVersion` is
  stamped, the next iteration can offer real migrations.
- **Per-tier completion times in Stats** — useful once Master+ produces
  enough data.
- **Settings: technique difficulty ceiling / blacklist.** Some players
  want "Diabolical without ALS-XZ"; the catalog + cascade architecture
  makes this trivially supportable.
- **Hint pacing** — surface the *easiest* technique that fires next, not
  necessarily the hardest, so the help system actually teaches in order.
- **Learn-section progress tracking.** The catalog already enumerates 34
  techniques; a "you've seen 12/34" badge on the Learn tab would
  reinforce the iteration's pedagogical goal.
- **Daily puzzle / seeded generation.** With strict tiering, a
  date-seeded generator becomes reliable.

### Architectural decisions to revisit as the project grows

- **Candidate-grid representation.** `Set<Digit>[][]` is clean but
  expensive. As the engine grows (more chain-style techniques), a
  bitmask-per-cell representation will pay back many times.
- **Single-worker assumption.** `generator.worker.ts` handles one request
  at a time. Pre-warming a Nightmare puzzle in the background while the
  user plays Easy would dramatically improve perceived latency.
- **`rate.ts` is the de-facto solver.** It duplicates the cascade in
  `solver/techniques/index.ts`. Long-term, factor a single shared
  cascade-runner that both `rate()` and `nextStep()` consume — the
  current divergence (see ordering issue #4) is the symptom.
- **Catalog ↔ fixture coupling.** The schema is duplicated 34 times to
  avoid an import cycle. Extracting `fixture-types.ts` early avoids drift.
- **Generation budget is per-call constant.** A future iteration may want
  per-tier budgets (Nightmare needs more headroom than Easy). The
  structured `GenerationFailed` already gives the UI enough to express
  per-tier expectations.

### Technical debt introduced this iteration

- **Dead code branch** in `rate.ts:611-613` (`hardestTechnique == null`
  else-if).
- **Duplicated `TechniqueFixture` interface** in 34 fixture files.
- **`Home.handleNewGame` and friends discard a Promise.** Add a
  `.catch()` for unhandled-rejection safety.
- **`stats.ts:148`** has no provision for retired tier keys.
- **`techniques[]` cascade comment** in `index.ts` is potentially stale.
- **`difficulty-loading.spec.ts`** ships skipped — flag for the next
  iteration.
- **No coverage tooling** wired into Vitest; iteration 3's "is it
  tested?" question will be hard to answer objectively without it.

---

## Closing note

The iteration delivers a substantial expansion (27 new techniques, async
generation, full help section) without disturbing the v0.1.0 baseline. The
code is consistent in style, tested with discipline, and readable. The
issues above are the kind of polish that becomes visible once the bigger
picture is right — which is the case here.
