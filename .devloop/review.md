# Sudoku PWA — Iteration 3 Code Review

**Branch:** master · **Version:** 0.3.0 · **Reviewed:** 2026-04-29
**Scope:** Iteration 3 changes against `.devloop/requirements.md`

---

## Summary

Iteration 3 was driven by manually-discovered bugs and a curated subset of
the iteration-2 review. All 52 planned tasks are marked **done**; the build,
unit tests, and E2E suites verify in-tree. The implementation faithfully
follows the requirements document — the structural fix for "Bug A" (uncaught
finder exceptions collapsing the retry budget) is solid, the (variant,
difficulty) save-slot model is well-shaped, the desktop-nav fix is the
trivially-correct one, and the PWA update flow is plumbed end-to-end. The
fuzz harness reports clean (a happy outcome that left TASK-014a/b/c as
no-ops).

There are, however, a few latent concerns: the `maxClues` mitigation for
"Bug B" is plumbed but its semantics are inverted from what the
requirements text seems to want; the strict tier rule still cannot
reliably produce Hard/Master puzzles inside a sane retry budget (these
tiers are `it.skip`-ped in unit tests); and a few small UX seams remain.
Details below.

---

## Requirements vs Implementation

### Met (with confidence)

| § | Requirement | Status | Notes |
|---|---|---|---|
| 4.1 | Per-attempt try/catch in `generateForDifficulty` | Met | `src/engine/generator/generate-for-difficulty.ts:217-274` wraps each attempt; `lastError` is captured and prefixed with `technique` id when present. |
| 4.1 | Worker `console.warn` on caught exceptions | Met | `src/workers/generator.worker.ts:175-186`. |
| 4.1 | `lastError` plumbed worker → client → store → dialog | Met | All four layers carry the field; `GenerationFailedDialog.tsx:124-131` renders it always-visible per the user direction. |
| 4.2 | Fuzz harness | Met | `src/engine/solver/techniques/fuzz.test.ts` — 34 finders × 3 variants × 50 boards. The harness reports clean, so no regression fixtures were needed. |
| 4.4 | Silent-skip warnings in rate.ts | Met | Every extended-chain finder's `else` branch logs `[rate] Technique <id> returned eliminations, but all were already applied.` |
| 4.4 | Remove `'Expert'` fallback; keep `solved: false` | Met | `rate.ts:1004-1012` now sets `difficulty = hardestTier` regardless of solved state; `generate-for-difficulty.ts:244-247` rejects unsolved ratings. |
| 4.4 | Reconcile cascade vs catalog ordering | Met | `techniques/index.ts:139-174` is identical-by-position to `catalog.ts:284-319` `TECHNIQUE_ORDER`. |
| 5.1 | Save schema v3 with per-(variant, difficulty) slots | Met | `save.ts:48-50` `slotKey()`; CRUD helpers + `listSavedGames()` all keyed by slot. |
| 5.1 | Stats / Settings v3 bumps | Met | `stats.ts:6-7`, `settings.ts:6-7`. |
| 5.2 | Game store integration | Met | `game.ts:266-334` `newGame`, `512-535` `resumeSavedGame`, `550-553` `completeGame`. |
| 5.3 | Resume list, sorted, with timestamp | Met | `Home.tsx:111-242`. Timestamp formatted via `formatSavedAt` (`YYYY-MM-DD HH:MM:SS` local). |
| 5.4 | `<ConfirmDialog>` replaces `window.confirm` | Met | `ConfirmDialog.tsx`; `Home.tsx:244-262` wires the replace prompt. |
| 5.5 | Migration detector + first-load prompt + Settings entry | Met | `migration.ts`, `App.tsx:112-126,204-224`, `Settings.tsx:223-235`. Session-only dismiss is in-memory. |
| 6 | Per-variant tier filter pills on Stats | Met | `Stats.tsx:71-156`; defaults to All; resets on each visit. |
| 7 | Tab bar visible on desktop | Met | `App.tsx:154-156` no longer carries `sm:hidden`. |
| 8 | Periodic poll + visibility check + `checkForUpdates` | Met | `useUpdate.ts:25-77`. Settings wires the manual button with the idle/checking/up-to-date/error cycle (`Settings.tsx:127-162`). |
| 9.1–9.5 | E2E suites + WebKit project | Met | `tests/e2e/difficulty-matrix.spec.ts`, `desktop-nav.spec.ts`, `difficulty-loading.spec.ts` (un-skipped), `pwa-update.spec.ts`, `playwright.config.ts` carries both projects + dual webServer. |
| 9.6 | Unit tests for hooks / store / migration / round-trip | Met | `useDebouncedFlag.test.ts`, `game.test.ts` (cancel + failure paths), `App.test.tsx` (3 migration cases), `catalog.test.ts` (round-trip). |
| 9.7 | Fuzz harness in unit budget | Met | Test file exists and runs; total fuzz cells ~5 100 calls. |
| 10 | Dialog focus management | Met | `useFocusTrap.ts` extracted and applied in both dialogs. |

### Partial / Drift from Spec

1. **Catalog round-trip is weaker than TASK-042 specified** —
   `catalog.test.ts:100-126` only asserts each fixture's finder still returns
   non-null on its fixture, not that `rate(fixture.board).difficulty === entry.tier`.
   The comments justify this on grounds that fixtures are mid-game
   one-step demos rather than fully-solvable puzzles, and that's a fair
   technical point. But it is a deviation from the requirement's stated
   intent — fixture drift in the form of "this fixture demonstrates a
   technique whose rated tier doesn't match the catalog's claimed tier"
   would still slip through. Worth a follow-up that either replaces each
   fixture with a fully-solvable puzzle or relaxes the requirement
   explicitly.

2. **`maxClues` plumbing semantics are inverted from intuition** —
   requirements §4.3 says `maxClues` should "[refuse] to remove a clue
   that would push the puzzle below `maxClues`." The implementation in
   `generate.ts:184-189` honours that text: `clueFloor = Math.max(minClues,
   maxClues)`. But for Master classic with bounds `[26, 31]`,
   `clueBoundsLowerForTier` returns 26 (passed as `minClues`) and
   `clueBoundsUpperForTier` returns 31 (passed as `maxClues`), so the
   effective floor becomes **31**. That means generation stops removing
   clues at 31 — leaving puzzles with the *most* clues a Master can have,
   which empirically rates much easier than Master. The strict-tier rule
   then rejects almost every attempt. The comment in `generate-for-difficulty.test.ts:28-37`
   confirms this: "Hard and Master tiers are statistically very rare —
   the random generator almost never produces puzzles whose hardest
   required technique is exactly pointing/box-line-reduction (Hard) or
   x-wing/swordfish/jellyfish (Master). Strict tier matching therefore
   cannot reliably hit these tiers within a sane retry budget. Skip them
   in CI."

   The requirements treat `maxClues` plumbing as "Bug B mitigation" and
   defer verification to the matrix E2E (TASK-049). If TASK-049 / TASK-052
   both reported the matrix green on Chromium and WebKit, that's the
   on-the-ground signal that the current behaviour works. But the
   semantic mismatch — naming a parameter `maxClues` and using it as a
   *floor* — is a foot-gun. Even if Bug B is "not observed" in the smoke
   matrix, this should be cleaned up: rename to e.g. `clueFloor` and pick
   the lower bound (26 for Master) as the floor that actually shapes the
   puzzle distribution.

3. **`generate-for-difficulty.test.ts` skips Hard and Master** — the
   `it.skip` (line 37–40) in CI is a known gap. The matrix E2E covers
   the user-visible flow but the unit-level guarantee ("strict tier rule
   reliably produces tier X for some seed") is missing for these two
   tiers. The matrix E2E runs locally pre-push only, so a regression here
   would only be caught on a developer machine, not in CI.

### Scope Creep

None observed. Every change in the diff lines up with a § in
`requirements.md`. The console-warn calls in rate.ts (one per
extended-chain finder block) are noisy during test runs but the
requirements explicitly accept that ("warning spam during a test run is
acceptable").

---

## Code Quality

### Bugs / Logic Concerns

1. **`maxClues` semantics** — see §1 above. The behaviour is consistent
   with the tests but the parameter name and the way it composes with
   `minClues` are misleading. A reader inspecting `clueFloor =
   Math.max(minClues, maxClues)` is going to do a double-take.

2. **`checkForUpdates` resolution timing** (`useUpdate.ts:64-76`) —
   `checkForUpdates` resolves immediately after `r.update()` and inspects
   `needRefreshFiredRef.current`. `r.update()` typically resolves after
   the *fetch* of the new SW source, but Workbox's `onNeedRefresh`
   callback (which sets the ref) only fires after the new SW reaches the
   `waiting` state. There is no guarantee these two are synchronous.
   In practice the user sees `Up to date` even when an update is
   downloading in the background, and the banner appears a tick later.
   The PWA update E2E only checks the visibility-driven path, not this
   one. Acceptable for v0.3.0; worth a note for the next iteration.

3. **`generationFailure.lastError` falsy-string handling** —
   `GenerationFailedDialog.tsx:124` renders the line when
   `failure.lastError` is truthy. If a finder ever throws an `Error('')`
   (empty message), the line is hidden and the user sees a dialog with
   no diagnostic. Edge case — but the requirements explicitly demand
   the diagnostic line be visible on any failure. Defending with
   `failure.lastError != null` would be safer than the current truthiness
   check.

4. **`worker.busy` defensive guard** — `generator.worker.ts:117-122` posts
   an `error` message when a second `generate` request arrives while one
   is in flight. The client (`generator-client.ts`) doesn't queue or
   coalesce — it's the game store's `newGame` that cancels the old handle
   first (`game.ts:268-272`). This is a reasonable contract but it's
   implicit; if anything ever calls `postMessage` directly without going
   through the store, the busy-rejection would surface as a ghost
   "failed" with `lastError = 'Worker is already processing a generation
   request'`. Worth a comment on `generateInWorker` documenting "callers
   must serialize requests".

5. **`cancelGeneration` clears `loading` but not `generationFailure`** —
   `game.ts:336-342`. If a generation just failed and the user clicks
   the dialog's Cancel (which navigates Home and clears
   `generationFailure` via `GenerationFailedDialog.handleCancel`), this
   is fine. But a player who triggers `cancelGeneration` from the
   loading overlay's Cancel button at exactly the moment the worker
   posts `failed` could end up navigated home with `generationFailure`
   still set on the next visit to Game. Low-probability race, but the
   `cancelGeneration` action could defensively clear it.

6. **`migration.ts` regex strictness** — the pattern
   `/^sudoku\.(save|stats|settings)\.v[12]$/` will not match keys like
   `sudoku.save.v0`, partly-encrypted strings, or future `sudoku.x.v2`
   if a new substore lands. As intended for now, but a casual reader
   would expect a broader sweep. Comment is clear.

7. **`Home.tsx` duplicate `getSavedGameImpl` / `listSavedGamesImpl`
   props** — both default to live save calls. The old per-variant
   `getSavedGameImpl` shape is preserved for tests, but it now returns
   the *(variant, difficulty)* slot, which is fine. The two are
   technically redundant — `listSavedGamesImpl` covers the resume list,
   and `getSavedGameImpl` is only used for the replace-existing check.
   Functional, just a bit of API surface area.

### Error Handling

Generally good. A few specific notes:

- **Worker outer try/catch** — `generator.worker.ts:175-186` posts a
  generic `error` message on any exception that escapes the loop.
  Per-attempt errors are already contained, so this is an unexpected
  fall-through. Logging both message and stack here is the right call.
- **Save / stats parse failures** — `save.ts:69-93` returns an empty
  save file on any failure (parse error, version mismatch, malformed
  shape). The settings store relies on Zustand's persist middleware to
  drop on version mismatch, which is correct given the v2 → v3 bump.
- **`generateForDifficulty` lastError when no attempt threw** — the
  `lastError?: string` field is left undefined, which is correct, and
  the dialog just doesn't render the line. Good.
- **Timeout=0 edge case** — `generate-for-difficulty.test.ts:394-417`
  proves `attempts === 0` and `closestRating === null` when timeout
  fires before any attempt starts. Behaviour is well-defined.

### Security

Nothing concerning. The app has no network ingress beyond static asset
fetches, no auth, no PII, no eval, no `dangerouslySetInnerHTML`, no
`new Function`. The slow-generate hatch (TASK-036) is gated behind
`import.meta.env.DEV` and the worker silently ignores the field if it
ever appears in production. PWA update intercepts in the E2E spec are
test-only.

---

## Testing

### Coverage Strengths

- **34 technique finders + 3 variants** — fuzz harness covers
  ~5 100 finder invocations across grid sizes; the safety net for
  Bug A's root cause is solid.
- **Per-finder unit tests** — every technique has at least one positive
  fixture and one negative test. The catalog test
  (`catalog.test.ts:64-96`) ensures every registered finder has a
  catalog entry and every entry carries a fixture.
- **Hooks** — `useDebouncedFlag.test.ts` is exhaustive (9 cases incl.
  the hop-over-debounce-window edge case).
- **Migration prompt** — `App.test.tsx` covers all four state
  transitions (initial render, dismiss, re-prompt on next mount,
  permanent removal).
- **E2E matrix** — `difficulty-matrix.spec.ts` enumerates every
  (variant × tier) combination as its own `test()` so a regression
  reports the offending slot directly.
- **PWA update spec** — uses `page.route` to bump revision strings in
  the SW manifest and validates the visibility-change → banner →
  reload-click flow against a real preview server. This is a real
  regression guard, not a smoke test.

### Coverage Gaps

1. **Hard / Master tier reliability is `.skip`-ped** — see "Drift" #3
   above. CI cannot catch a regression that breaks Hard or Master
   generation in the rater.

2. **Generator-client tests vs real worker** — `generator-client.test.ts`
   uses a FakeWorker. Real-worker behaviour is not unit-tested but is
   exercised via the matrix E2E. Acceptable, but a real-worker smoke
   test would catch regressions in the URL/import.meta plumbing of
   `defaultCreateWorker`.

3. **`Settings` updates section under all three result states** —
   the test suite covers idle/checking/up-to-date/error per TASK-047,
   but I didn't verify the 2-second auto-revert is covered with fake
   timers. A `vi.advanceTimersByTime(2000)` assertion would lock that
   in.

4. **Concurrent `newGame` race** — `game.ts:268-289` defends against
   superseded handles via the `activeHandle !== handle` identity check,
   but no unit test exercises a stale handle resolving after a fresh
   `newGame`. The cancel-in-flight test (TASK-041) covers `cancel()`
   then `await`, not `newGame() → newGame() → both resolve`.

5. **Stats screen filter pill state reset across visits** — covered by
   the E2E matrix (the filter state is component-local), but no
   explicit unit test verifies that visiting Stats, picking a tier,
   then revisiting from a different route shows All again.

6. **Migration test seeds an empty `'{}'` v2 save** — `App.test.tsx:128`
   stores literal `'{}'`. The detector matches on the *key*, not the
   value, so this works. But if a future change in the schema-load
   path tries to JSON-parse a v2 entry before the detector runs, the
   test would silently still pass. Belt-and-braces would seed a
   structurally valid v2 payload.

7. **Worker "error with empty message"** — covered indirectly by
   the FakeWorker tests; the dialog's empty-string-as-falsy issue
   (Code Quality #3) is not specifically asserted.

---

## Recommendations

### Before declaring this production-ready

1. **Resolve the `maxClues` semantics.** Either rename + flip to use the
   *lower* bound as the floor (probably the intent), or document very
   clearly that `maxClues` is a synonym for "alternate floor, used when
   higher than `minClues`." The current naming is going to cost a future
   maintainer 30 minutes. Verify on a real run that mid-tier
   (Hard/Master) generation produces puzzles at the right rate before
   declaring Bug B descoped.

2. **Run the full matrix E2E on both Chromium and WebKit, then attach
   the run log to TASK-049.** The spec text in
   `difficulty-matrix.spec.ts:29-62` already specifies the decision
   rule, but no findings have been appended yet. If everything is
   green, record that. If anything fails, open the iteration-4 ticket
   the spec references.

3. **Defensive `lastError != null` check** in
   `GenerationFailedDialog.tsx:124`. Cheap fix, removes a sharp edge.

4. **Stop skipping Hard / Master in
   `generate-for-difficulty.test.ts`.** Either provide seeds known to
   hit those tiers, or add a `vi.spyOn` mock that synthesizes a
   matching rating so the strict-tier acceptance path is unit-tested.

### Smaller cleanups

- Add a Test that the 2-second revert timer fires in
  `Settings.test.tsx` for the up-to-date / error states.
- Document the worker's "one-at-a-time" contract on `generateInWorker`'s
  JSDoc.
- Defensively clear `generationFailure` in `cancelGeneration`.
- Make the migration test seed a structurally-valid v2 payload.
- Add a real-worker smoke test that just constructs and immediately
  cancels a generation, to lock in the import URL plumbing.

---

## Future Considerations

### Next-iteration features (high value)

- **Bug B real fix.** If the matrix shows certain (variant, tier)
  combos failing on budget exhaustion, the right fix is to widen the
  per-tier attempt budget *and* carefully tune the clue-bound hints.
  The infrastructure (`MAX_ATTEMPTS_BY_TIER`, `clueBoundsLowerForTier`,
  `clueBoundsUpperForTier`) is in place; the missing piece is empirical
  data. A small generator profiling harness — "for each (variant, tier),
  generate 50 puzzles with a generous budget and record the rate
  distribution" — would tell us where the natural distribution falls
  short.
- **Auto-save indicator.** Players have no visual feedback that their
  in-progress game is being saved. A subtle "Saved 3s ago" pill near the
  timer would build trust in the per-slot save model.
- **Save-slot management UI.** With up to 17 simultaneous slots, the
  Resume list could grow long. Consider per-slot "delete" affordances,
  filter by variant, or a "Clear all" action.
- **`Forcing Chains` and `Death Blossom` performance.** These are the
  two most expensive finders; profiling them on typical Demonic /
  Nightmare boards would close the loop on whether the 60s wall-clock
  is hit due to the rater itself rather than retry exhaustion.
- **PWA install prompt.** v0.3.0 has the SW + manifest but no
  beforeinstallprompt handling. Players on iOS / Android benefit from
  an explicit "Install" affordance.
- **Hint quality on the new techniques.** The Hint panel surfaces a
  technique label and cells; for chain-style techniques (XY-Chain,
  Nice Loop, 3D Medusa, Forcing Chains) this is hard to follow. A
  walkthrough mode that animates the chain link-by-link — reusing
  Techniques help-screen logic — would be a major usability win.

### Architectural decisions to revisit

- **Catalog vs cascade vs rater duplication.** Three separate orderings
  of the same 34 techniques live in
  `solver/techniques/index.ts:139-174`,
  `solver/techniques/catalog.ts:284-319`, and inline in
  `engine/generator/rate.ts:629-998`. The rater's ordering is
  intentionally independent (and its inline cascade re-implements
  finders against its own candidate grid), but this is a lot of
  parallel surface area. A single declarative table — { id, displayName,
  tier, fixture, cascadeFinder, raterFinder, hintCells } — could
  collapse the three.
- **The rater's parallel candidate-grid implementation.** The reason
  for the inline cascade in `rate.ts` (the public `nextStep`
  recomputes candidates per call) is a real constraint, but the
  divergence is now a maintenance cost. Consider extracting a
  shared "candidate-grid solver" that both `rate.ts` and the public
  `nextStep` consume.
- **`gameStore` singletons.** `gameStore`, `settingsStore`, `statsStore`
  are all top-level singletons. With per-(variant, difficulty) save
  slots, the natural mental model is closer to "the active game" plus
  "the saved-games registry." Consider splitting `gameStore` into an
  active-game store and a saved-games registry, so the active game's
  state changes don't trigger a re-render of every Resume card on Home.
- **`__APP_VERSION__` as a global.** Works fine via Vite's `define`
  but the `typeof __APP_VERSION__ === 'string'` defensive check in
  `Settings.tsx:164-165` hints at a discoverability problem — that
  check is only there because the type isn't always trusted at the
  call site. Promoting it to a named import from a generated module
  would centralize.

### Technical debt introduced this iteration

- **Inverted `maxClues` semantics** (described above).
- **`it.skip` on Hard / Master tier coverage.**
- **Catalog round-trip is finder-only, not tier-asserting.**
- **Several `console.warn` calls in `rate.ts`** — intentional, but they
  noise up test output. A small `// eslint-disable-next-line no-console`
  + a future "rate.ts logger that can be muted in tests" would tidy
  this up.
- **`window.location.search` read in `generator-client.ts` is
  DEV-gated** — Vite tree-shakes the branch, but it's brittle to
  refactors that hoist the URL parse outside the gate.

---

## Verdict

**Iteration 3 ships its stated scope cleanly.** Bug A is structurally
contained, the (variant, difficulty) save model is well-shaped, the
desktop-nav fix is correct, and the PWA update flow works end-to-end. The
test infrastructure (fuzz harness, matrix E2E on both browsers, migration
prompt coverage) is materially stronger than v0.2.0 and constitutes real
regression insurance for the next iteration.

The remaining issues are small and well-defined: tighten the `maxClues`
semantics, attach the matrix-E2E findings to TASK-049, and stop skipping
Hard / Master in unit tests. None of them block release; all of them are
easy to fold into iteration 4.
