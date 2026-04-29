# Sudoku PWA — Iteration 3 Requirements: Resilience, Save Slots, and Coverage

This iteration is driven primarily by manual testing of the iteration 2 build,
which surfaced multiple difficulty tiers failing instantly, missing desktop
navigation, undetected app updates, and a save model that overwrote in-progress
games on variant collision. The scope folds in a curated subset of the
iteration 2 review's recommendations where they are adjacent to the
manually-reported bugs.

The v0.2.0 baseline is unchanged except where called out. The previous
iteration's requirements, tasks, progress, and review are archived at
`.devloop/archive/iteration-1/`.

## 1. Motivation

Manual testing of the iteration 2 build (post-merge, run on desktop)
surfaced these defects in production code paths the iteration was supposed
to harden:

1. **Several difficulty tiers fail instantly with the §7.3 fallback dialog**,
   well before the 50-attempt or 60-second budget could plausibly be hit:
   - Classic: Hard, Master fail straight away.
   - Mini: Medium, Hard fail straight away.
   - Six: Medium, Hard, Expert, Master fail straight away (Easy and
     Diabolical work).
2. **The bottom tab bar does not render at desktop viewports**, leaving
   Stats / Learn / Settings unreachable except by typing URL hashes.
3. **The PWA never surfaces "a new version is available"** during local
   build/redeploy cycles. The user had to load the app in an incognito
   window to pick up the new build.
4. **Starting a new game silently overwrites the in-progress game for the
   *variant*** (modulo a `window.confirm`), even when the new game uses a
   different difficulty. Players cannot have a Classic Easy and a Classic
   Hard in flight at the same time.
5. **No E2E test catches any of the above.** Iteration 2's E2E suite
   covers feature flows (Learn tab, Hint navigation, picker visibility) but
   does not assert that every advertised (variant × difficulty) combo
   actually loads a playable board, that desktop nav is reachable, or that
   the update banner appears.

The iteration 2 code review (`.devloop/archive/iteration-1/review.md`)
identifies several adjacent issues that share root cause with the bugs
above — most importantly a silent-skip in the rater that can mis-classify
puzzles as `Expert`, and the conflation of "rated Expert" with "the
cascade gave up". Both are folded in here because they interact with the
strict tier rule that produces the user-visible failures.

## 2. Goals

- Make every advertised (variant × difficulty) combination reliably load a
  playable puzzle within the existing 50-attempt / 60-second budget,
  failing only when the budget is genuinely exhausted.
- Allow a player to keep multiple games in flight simultaneously — one per
  unique (variant, difficulty) combination.
- Restore navigation on desktop viewports.
- Make PWA updates discoverable without requiring an incognito reload.
- Give the player visibility and control over old, incompatible saves.
- Add E2E coverage proportionate to the surface area users actually
  exercise — including a (variant × difficulty) smoke matrix and a
  desktop-nav reachability check — runnable locally pre-push because CI
  has no E2E budget.

## 3. Non-goals

- No new techniques, no new variants. The 34-technique catalog and the
  Mini / Six / Classic variant set remain unchanged.
- No changes to the iteration 2 difficulty taxonomy or `TECHNIQUE_TIER`
  mapping. The eight tiers and their assignments stand.
- No automated migration of old save data into the new schema. Old data
  is offered for removal; the player can decline and the data is left as
  inert bytes in localStorage until they revisit the option in Settings.
- No CI E2E runs. The E2E suite is intended to be run locally before push;
  CI continues to run unit tests only.
- No desktop-specific layout. The mobile UX is the canonical layout; the
  fix on desktop is to make the existing UI usable, not to reskin it.
- No focus management or accessibility refactor outside the dialogs
  explicitly named here.

## 4. Generation resilience

### 4.1 Bug A — exception in the rater chain kills all retries

`generateForDifficulty` (in `src/engine/generator/generate-for-difficulty.ts`)
runs up to 50 attempts, each calling `generate()` then `rate()`. Neither
the function nor the worker (`src/workers/generator.worker.ts`) wraps an
individual attempt in `try/catch`. The worker's outer `try/catch` therefore
turns *any* exception thrown by *any* technique finder during *any*
attempt into a terminal `error` message — surfacing as the §7.3 fallback
dialog within milliseconds.

The fix is structural:

- **Per-attempt error containment.** In `generateForDifficulty`, wrap each
  `generate()` + `rate()` pair in `try/catch`. On exception, count the
  attempt against the retry budget, capture the error in a structured
  per-attempt diagnostic, optionally invoke `onProgress` with an
  `error` field, and continue to the next attempt. The function never
  throws as a result of finder bugs.
- **Diagnostic capture in the worker.** When `generateForDifficulty`
  returns `failed`, the worker's `failed` message gains an optional
  `lastError?: string` field carrying the most recent caught error
  message (and technique id if identifiable). The worker also
  `console.warn`s every caught exception so a developer running the app
  locally can identify the offending finder.
- **Surface error messages in the failure dialog.** `GenerationFailure`
  in `src/store/game.ts` gains a `lastError?: string` field. The dialog
  in `src/components/GenerationFailedDialog.tsx` always renders a small
  technical-details line below the existing buttons when the failure
  carries a message. This is intentionally always-visible (not behind a
  toggle) — the user explicitly asked for it.

Once Bug A is contained at the boundary, the underlying finder bugs can
be fixed at leisure.

### 4.2 Finder hardening and fuzz harness

The likely cause of Bug A is one or more of the 27 new technique finders
throwing on grid states they were not designed for — most plausibly
non-9×9 grids (Mini at 4×4, Six at 6×6) or grids with already-eliminated
candidates that violate the finder's assumptions.

This iteration adds:

- **A fuzz harness** at `src/engine/solver/techniques/fuzz.test.ts` that,
  for each finder in the 27-technique chain, runs the finder against a
  bounded number of randomly-reduced boards across all three variants.
  The harness asserts no finder throws. Failures print the variant id,
  the seed, and the reduced board so the bug is reproducible. The
  harness uses a bounded count (e.g. 100 boards × 3 variants per finder)
  so it stays inside a unit-test budget.
- **Per-finder hardening** for any finder the fuzz harness identifies as
  throwing. Each fix is a discrete commit with a regression fixture
  added to the finder's existing `<name>.test.ts`. Finders that simply
  cannot apply on a smaller variant should return `null` early rather
  than throw on a degenerate grid.

### 4.3 Bug B — strict tier rule + narrow tier windows

After Bug A is fixed, some (variant × tier) combinations may still fail
their budget legitimately because the generator's natural distribution
does not produce that tier within 50 attempts. This is suspected for
Six's middle tiers (Medium / Hard / Expert / Master) and possibly for
Mini's narrow Medium / Hard windows.

The mitigation is non-invasive:

- **Tier-aware `minClues` heuristics.** `clueBoundsLowerForTier` already
  selects the lower bound of the tier's `CLUE_BOUNDS` window as a
  generation hint. For mid-range tiers, also pass an *upper* bound so
  the generator does not over-aggressively remove clues and overshoot
  into the next tier. `generate()` already supports `minClues`; this
  iteration extends the hint plumbing to also accept `maxClues` so the
  generator can refuse to remove a clue that would push the puzzle
  below `maxClues`.
- **Per-tier attempt budgets.** Replace the single `DEFAULT_MAX_ATTEMPTS`
  constant with a per-tier table. Easy / Medium remain at 50; Hard /
  Expert / Master double; Diabolical / Demonic / Nightmare keep 50 but
  consume the full 60s wall-clock. The wall-clock cap is unchanged.
- **Verification.** Bug B is treated as conditional. After Bug A is
  fixed, the matrix E2E test (§9.1) reveals which combos still fail.
  Only the failing combos receive the heuristic above. If everything
  passes after Bug A alone, this section is descoped.

### 4.4 Rater correctness — silent skip and Expert fallback

The iteration 2 review (review.md §2 bug #1, §2 bug #5, §4 #3) identified
two related defects in `src/engine/generator/rate.ts`:

- **Silent skip on no-op eliminations.** Lines ~681–940 each test an
  extended-chain finder, adapt its eliminations, and `continue` only
  when `applyEliminations` returns `true`. If a finder's eliminations
  have all already been removed from the rate.ts grid, the chain falls
  through to the next finder. If *every* remaining finder no-ops in
  this way, the loop hits `break` (line 943) and the puzzle is rated
  `'Expert'`. This can mis-classify a puzzle whose hardest required
  technique is, say, a Demonic-tier ALS-XZ as `Expert`.
- **Expert as a dual-purpose label.** When the cascade stalls, `rate()`
  returns `'Expert'` (lines 947). This collides with puzzles that
  legitimately rate `Expert`. `generateForDifficulty('Expert')` then
  silently accepts unsolvable-by-cascade puzzles.

Fixes:

- **Disambiguate "stalled" from "rated".** `RateResult` already exposes
  `solved: boolean`. Update the post-loop logic so `difficulty` is set
  to `hardestTier` regardless of the solved flag, and `solved: false`
  is preserved as an out-of-band signal. Update
  `generateForDifficulty` to reject any puzzle with `solved: false`
  before applying the strict tier rule. The `'Expert'` fallback label
  is removed entirely.
- **Surface no-op eliminations as an actionable signal.** When an
  extended finder returns non-null but all its eliminations no-op
  against the rate grid, log a `console.warn` describing the
  situation, then continue to the next finder as today. No need to
  dedupe across finder invocations — rating is short-lived and a
  little warning spam is acceptable. The warning is enough for triage
  without changing behaviour for puzzles that work today.
- **Reconcile cascade vs catalog ordering** (review §2 bug #8, §4 #4):
  align the order of techniques in `src/engine/solver/techniques/index.ts`
  with `src/engine/solver/techniques/catalog.ts`. Today the cascade
  has `naked-pair` / `naked-triple` before `pointing` /
  `box-line-reduction`, while the catalog order is the reverse. Make
  the catalog order canonical and re-order the cascade to match. The
  rater's order is independent and unchanged.

## 5. Save schema v3 — per-(variant, difficulty) slots

Today, `src/store/save.ts` keeps one save per *variant* under
`sudoku.save.v2`. Starting any game for that variant overwrites it
(modulo the `window.confirm` in `src/screens/Home.tsx:101-108`).

The new model is one save per *(variant, difficulty)* — up to 17
simultaneous saves under the variant tier caps (8 Classic + 6 Six + 3
Mini).

### 5.1 Storage shape

- New key: `sudoku.save.v3`. Values follow:
  ```ts
  interface SaveFile {
    version: 3;
    appVersion: string;
    saves: Record<string, SavedGame>; // key = `${variantId}:${difficultySlug}`
  }
  ```
  The slot key is `${variantId}:${difficultySlug}` (e.g. `classic:hard`,
  `mini:easy`).
- `SavedGame` shape is unchanged — it already records `variant` and
  `difficulty` per entry.
- The exported helpers gain a difficulty argument:
  - `getSavedGame(variantId, difficulty)` returns the slot or null.
  - `putSavedGame(saved)` derives the slot from `saved.variant` and
    `saved.difficulty`.
  - `clearSavedGame(variantId, difficulty)` clears just that slot.
  - `hasSavedGame(variantId, difficulty)` reports presence.
  - New `listSavedGames()` returns all slots in `savedAt` desc order
    for the resume list.
- Stats schema (`sudoku.stats.v2`) bumps to `sudoku.stats.v3`. The
  `entries` map is already keyed by `(variant, difficulty)`; the bump
  exists to consume the same migration prompt as saves and to attach a
  fresh `appVersion` stamp.
- Settings (`sudoku.settings.v2`) bumps to `sudoku.settings.v3` for the
  same reason. No structural change.

### 5.2 Game store integration

`src/store/game.ts`:

- `newGame(variant, difficulty)` writes to the slot keyed by
  `(variant, difficulty)` rather than the variant's only slot.
- `resumeSavedGame(variantId, difficulty)` accepts the difficulty and
  loads the corresponding slot.
- `completeGame()` clears just the current `(variant, difficulty)` slot,
  not all saves for the variant.
- `saveCurrent()` writes to the current `(variant, difficulty)` slot.

### 5.3 Resume list

`src/screens/Home.tsx`:

- The "Resume" section renders one card per slot returned by
  `listSavedGames()`, ordered **most recently saved first**.
- Each card shows: variant label, `DifficultyBadge`, elapsed time
  (existing), **and a `savedAt` timestamp formatted to the second**
  (e.g. "2026-04-29 14:37:21"). Local time, not UTC. The format is
  a fixed locale-independent `YYYY-MM-DD HH:MM:SS` string.
- Test ids are `home-resume-${variantId}-${difficultySlug}` so each
  card is addressable.
- Tapping a card calls `resumeSavedGame(variantId, difficulty)` then
  navigates into the game.

### 5.4 Replace confirmation — `<ConfirmDialog>`

`window.confirm` is replaced with a styled in-app `<ConfirmDialog>`
component that matches the app's existing modal style (the §7.3
generation-failure dialog is the closest reference: backdrop overlay,
card, primary/secondary buttons).

- New file `src/components/ConfirmDialog.tsx` exports
  `<ConfirmDialog>` with props `{ open, title, body, confirmLabel,
  cancelLabel, onConfirm, onCancel }`. Uses `role="dialog"`,
  `aria-modal`, focus trap, Escape → `onCancel`. Re-used by §5.5.
- `Home.handleNewGame` uses it when the (variant, difficulty) slot is
  occupied: *"You have a Classic Hard game in progress saved at
  2026-04-29 14:37:21. Start a new one and replace it?"* Confirm =
  proceed; Cancel = stay on Home.
- The previous `confirmReplace` test override on `<Home>` is removed;
  tests interact with the dialog through its DOM.

### 5.5 First-load migration prompt + Settings entry

- **Detector.** On app boot, before any save read, scan localStorage
  for keys matching `^sudoku\.(save|stats|settings)\.v[12]$`. If any
  match, expose `hasOldSaves: true` to the App shell.
- **First-load prompt.** When `hasOldSaves` is true, render a
  `<ConfirmDialog>` over the Home screen with copy:

  > **Old saves detected.** We found saves from an earlier version
  > of the app that aren't compatible with this version. They take
  > up space but won't load.
  >
  > Remove them now? You can also remove them later from Settings →
  > Storage → Remove old saves.

  Buttons: **Remove now** (clears all matching keys) and **Decide
  later** (dismisses for the session).
- **Session memory.** "Decide later" is held in memory only — it does
  not write to localStorage. On the next app launch the dialog
  re-appears so an undecided player isn't permanently nagged but
  isn't permanently spared either. Once the player explicitly removes
  the old saves, the dialog never re-appears (the keys are gone).
- **Settings entry.** `src/screens/Settings.tsx` gains a "Storage"
  section visible whenever `hasOldSaves` is true. It contains a
  "Remove old saves" button that opens the same `<ConfirmDialog>`
  with the "Remove now" / "Cancel" actions. After removal the
  section is hidden.
- Removal logic deletes every matched `sudoku.*.v1|v2` key. v3 keys
  are untouched.

## 6. Stats screen — per-variant tier filter

`src/screens/Stats.tsx` currently renders one column per available
tier per variant section. Classic's full 8-column table is wide on
small viewports.

This iteration adds a per-variant filter:

- Above each variant's table, a row of pill buttons: **All** + each
  tier in `availableTiers(variant)`. Default selection: **All**.
- Selecting a tier collapses that variant's table to the single
  selected column. Selecting **All** restores the full table.
- Filter state is **local to the screen** and **resets on each visit**.
  No persistence in `sudoku.settings.v3`.
- Test ids: `stats-filter-${variantId}-${slug}` for each pill,
  `stats-filter-${variantId}-all` for the All pill.

## 7. Desktop navigation

`src/App.tsx:138` sets `className="fixed bottom-0 inset-x-0 flex
sm:hidden"` on the bottom tab bar — so the bar is hidden at the
Tailwind `sm` breakpoint (≥640px) and there is no desktop-equivalent
nav. Stats / Learn / Settings are unreachable on desktop without
typing URL hashes.

The fix is intentionally minimal: drop the `sm:hidden` class. The
mobile UX becomes the canonical UX; the bottom tab bar shows on every
viewport. No top nav, no side rail, no dual layouts to maintain.

The user has explicitly stated that mobile is the primary target;
desktop is a manual-testing surface. This decision is final for this
iteration.

## 8. PWA update detection

`src/pwa/useUpdate.ts:20-27` registers the service worker but never
asks the browser to check for updates. The iteration 2 setup
(`registerType: 'prompt'`, `injectRegister: false`) requires the app
to call `r.update()` itself to discover a newer SW — without it, the
browser only re-checks on hard navigation. As a result, players who
keep the app in a tab miss updates indefinitely.

Fixes:

- **Periodic update poll.** Use `onRegisteredSW(swUrl, r)` to
  `setInterval(() => r?.update(), 60_000)` — once a minute. Cleared
  on hook unmount.
- **Focus / visibility-driven check.** When the document becomes
  visible (`visibilitychange` → `document.visibilityState ===
  'visible'`), call `r?.update()`. Catches the "I came back to the
  tab" case immediately.
- **Manual "Check for updates" entry in Settings.** New entry under
  a "Updates" section. Button label cycles based on the resolved
  status: **Check for updates** → **Checking…** (while the
  `r.update()` promise is in flight) → one of:
  - **Up to date** for ~2 s when the check completes without a new
    SW (then reverts to **Check for updates**).
  - No special label when a new SW is detected — the existing
    `<update-banner>` at the top of the app handles that case.
  - **Couldn't check — try again** for ~2 s when the check fails
    (e.g. offline), then reverts.

The `onNeedRefresh` callback that already drives the banner stays as
today; the banner UX (`src/App.tsx:112-133`) does not change.

## 9. Test coverage

### 9.1 E2E: difficulty matrix

`tests/e2e/difficulty-matrix.spec.ts`. For each variant in
`['classic', 'mini', 'six']`, iterate every tier in
`availableTiers(variant)`. For each combination:

- Navigate to Home, select the variant + tier.
- Click **New Game**.
- Within a generous per-tier budget (e.g. 75s — accommodating the
  60s hard cap), assert that **either** the board renders (success
  path: `[data-testid=sudoku-board]` visible with at least one given
  cell) **or** the failure dialog renders with a non-empty
  `closestRating` and a populated `lastError` field. Failure with
  no rating and no error is a hard failure.
- The test reports each failing (variant, tier) combination explicitly
  so a regression points at the exact slot.

The test suite uses Playwright's parallel mode (already on); under
WebKit + Chromium each combo runs in its own worker. Total runtime
target: under 3 minutes on a developer machine.

### 9.2 E2E: desktop navigation

`tests/e2e/desktop-nav.spec.ts`. Run at the default Desktop Chrome
viewport (and WebKit). Asserts:

- `[data-testid=tab-bar]` is visible on Home.
- Each top-level tab (`tab-home`, `tab-stats`, `tab-learn`,
  `tab-settings`) navigates to the corresponding screen.
- The tab bar remains visible on every non-game screen.

### 9.3 E2E: re-enable spinner / cancel

`tests/e2e/difficulty-loading.spec.ts` is currently `test.skip`'d
because real Demonic generation is too non-deterministic.

This iteration adds a **test-only escape hatch**: a `?slowGenerate=N`
query-param on the page URL that the main thread reads at request
time and forwards into the worker via the `GenerateRequest` payload
(a new optional `slowGenerateMs` field). The worker, on receipt,
`await`s `new Promise(r => setTimeout(r, slowGenerateMs))` once
before invoking `generateForDifficulty`. The `?slowGenerate=15000`
form sleeps 15 s, guaranteeing the 200 ms overlay debounce, the 10 s
Cancel reveal, and the cancel-resolves-to-Home flow are all
observable.

The query-string read on the main thread is gated behind
`import.meta.env.DEV`, so production builds neither read the URL nor
forward the field, and the worker silently ignores it if it ever
appears. Worker code does **not** read its own `self.location.search`
— the worker URL is the bundled worker file, not the page URL.

The test is un-`skip`'d and rewritten against the slow path.

### 9.4 E2E: PWA update banner

`tests/e2e/pwa-update.spec.ts`. Uses Playwright's network
interception to:

1. Load the app, wait for SW registration.
2. Intercept the next SW manifest request and serve a manifest with a
   bumped revision/hash so Workbox detects an update.
3. Trigger an update check (focus event or wait for the poll).
4. Assert the `[data-testid=update-banner]` appears.
5. Click `[data-testid=update-reload]`; assert reload was triggered
   (the test does not need to fully verify the new SW activates —
   only that the click path is wired through `updateSW(true)`).

This test runs against a built preview server (`vite preview`) rather
than the dev server, because dev does not produce a real SW manifest.

### 9.5 WebKit Playwright project

`playwright.config.ts` adds a second project entry:

```ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
],
```

E2E runs cover both browsers locally pre-push. CI continues to run
unit tests only — the project remains a non-CI commit gate.

### 9.6 Unit tests

Folded in from review §3 and the new work:

- `useDebouncedFlag.test.ts` — direct test of the 200ms threshold
  with `vi.useFakeTimers`.
- `game.test.ts` — async `newGame` failure path and cancel-in-flight
  path. Asserts `loading: false`, `generationFailure` populated, and
  the worker is terminated when cancelling.
- `rate.test.ts` — the silent-skip fix is regression-tested with a
  fixture where every extended-chain finder no-ops; the test asserts
  the rate is the correct tier (not `'Expert'`).
- `generate-for-difficulty.test.ts` — the per-attempt try/catch is
  tested with a mock `rate` that throws on the first attempt; the
  function must continue to attempt 2 rather than failing the call.
- `catalog.test.ts` — fixture round-trip: for each catalog entry,
  load its fixture, call `rate(fixture.board)`, and assert
  `result.difficulty === entry.tier`. Prevents fixture drift from
  the rater's actual behaviour.
- `Settings.test.tsx` — covers the new "Updates" + "Storage" sections
  including "Check for updates" idle/checking/up-to-date states and
  the "Remove old saves" gating.
- `App.test.tsx` (or a new `migration.test.tsx`) — first-load prompt
  appears when `sudoku.*.v1|v2` keys are present, dismisses on
  "Decide later" without writing localStorage, removes all matching
  keys on "Remove now".

### 9.7 Fuzz harness

`src/engine/solver/techniques/fuzz.test.ts` (described in §4.2). Bounded
to remain inside a unit-test budget. Failures print enough state to
reproduce.

## 10. Failure dialog improvements

`src/components/GenerationFailedDialog.tsx`:

- Renders the new `lastError` field below the existing buttons when
  present, in a small, muted style. Always visible (per user direction
  in discovery).
- Adds focus management: focus is trapped within the dialog while
  open; Escape triggers the Cancel handler; on close, focus restores
  to the element that opened the dialog (the New Game button, in
  practice). Reuses the `<ConfirmDialog>` component's focus
  utilities where they overlap (both dialogs share the same trap
  helper extracted to `src/components/useFocusTrap.ts`).

## 11. Existing code to update

Non-exhaustive list of files this iteration touches beyond the new
ones:

- `src/engine/generator/generate-for-difficulty.ts` — per-attempt
  try/catch; per-tier attempt budgets; pass `maxClues` hint; surface
  `lastError` in `GenerationFailed`; respect `solved: false` from
  rater; remove the `'Expert'` fallback path.
- `src/engine/generator/rate.ts` — silent-skip fix; remove `'Expert'`
  fallback; preserve `solved: false`.
- `src/engine/solver/techniques/index.ts` — reorder cascade to match
  `catalog.ts`.
- `src/engine/generator/generate.ts` — accept `maxClues`.
- `src/workers/generator.worker.ts` — diagnostic console.warn on
  caught exceptions; surface `lastError` in `failed` message; honour
  the `slowGenerateMs` field on incoming `GenerateRequest` payloads
  (the worker does **not** read any URL itself).
- `src/workers/generator-client.ts` — propagate `lastError`; in DEV
  builds, read `?slowGenerate=N` from the page URL and forward as
  `slowGenerateMs` on the worker request.
- `src/store/game.ts` — `newGame(variant, difficulty)` writes
  per-(variant, difficulty) slot; `resumeSavedGame(variantId,
  difficulty)`; `completeGame()` clears one slot; `lastError` on
  `GenerationFailure`.
- `src/store/save.ts` — schema v3, key change, listSavedGames.
- `src/store/stats.ts` — schema v3 (no structural change beyond key).
- `src/store/settings.ts` — schema v3 (no structural change).
- `src/screens/Home.tsx` — resume list iterates per-slot saves,
  shows timestamp, sorted most-recent-first; replace confirmation
  uses `<ConfirmDialog>`.
- `src/screens/Game.tsx` — saves/loads via per-slot helpers.
- `src/screens/Stats.tsx` — per-variant tier filter pills.
- `src/screens/Settings.tsx` — Storage section (remove old saves)
  and Updates section (manual check).
- `src/components/GenerationFailedDialog.tsx` — `lastError` line,
  focus trap, Escape handler.
- `src/App.tsx` — drop `sm:hidden` on the tab bar; render first-load
  migration prompt; bump `__APP_VERSION__` consumption.
- `src/pwa/useUpdate.ts` — periodic poll, visibility-driven check,
  expose a `checkForUpdates()` for the Settings button.
- `playwright.config.ts` — WebKit project.
- `package.json` — bump version to 0.3.0.

## 12. Testing strategy

- **Unit**: per-finder regression fixtures for any defect surfaced by
  the fuzz harness; rater fixtures for the silent-skip fix; store
  fixtures for the per-(variant, difficulty) slot model; settings/app
  fixtures for the migration prompt.
- **Component**: `<ConfirmDialog>`, the resume list (sort order +
  timestamp formatting), the stats filter pills, the dialog focus
  trap.
- **E2E (local pre-push, Chromium + WebKit)**: difficulty matrix,
  desktop navigation, re-enabled spinner/cancel via the slow-generate
  hatch, PWA update banner.

## 13. Edge cases and failure modes

- **Old save keys reappear** (e.g. an older tab writes a v2 entry
  after the v3 cleanup): the next app load detects them again and
  re-prompts. No special protection is required.
- **Two simultaneous tabs writing to different (variant, difficulty)
  slots**: localStorage's last-write-wins behaviour is acceptable —
  each tab's own slot is preserved by reading-then-writing the full
  slot map every time. Existing pattern, unchanged.
- **`(variant, difficulty)` collision on Resume + concurrent New
  Game**: ConfirmDialog blocks new game start until resolved; the
  resume list reflects the current localStorage on every render.
- **Worker error with no message**: `lastError` is `undefined`; the
  dialog renders no extra line.
- **Visibility check during generation**: the §8 visibility-driven
  `r.update()` runs concurrently with a generation request — both
  use independent SW APIs and do not interact.
- **PWA test on dev server**: the spec runs against `vite preview`
  (production build), not `vite dev`. Dev-mode SW behaviour is out
  of scope for E2E.
- **Slow-generate hatch in production**: gated behind a build-time
  flag; production builds strip the branch.

## 14. Success criteria

- Every (variant × shown difficulty) combination loads a playable
  board in ≥95% of attempts within the budget. The matrix E2E test
  passes on both Chromium and WebKit.
- The bottom tab bar is visible at desktop viewports; clicking each
  tab navigates to the corresponding screen. The desktop-nav E2E
  test passes.
- Starting a new game when an existing in-progress game has the same
  (variant, difficulty) raises the in-app `<ConfirmDialog>`; starting
  a new game with a different (variant, difficulty) does not raise
  the dialog and does not overwrite any save.
- The Resume list shows one card per `(variant, difficulty)` slot,
  ordered most-recently-saved first, with a `YYYY-MM-DD HH:MM:SS`
  timestamp on each card.
- A redeployed local build raises the update banner within ~60s of
  the redeploy without requiring the player to clear their cache.
  The Settings "Check for updates" button surfaces idle / checking /
  up-to-date feedback. The PWA update E2E test passes.
- Old `sudoku.*.v1` and `sudoku.*.v2` keys are detected on first
  load and removed once the player confirms; the Settings "Remove
  old saves" entry is visible whenever any old key remains and is
  hidden otherwise.
- The Stats screen offers a per-variant tier filter that defaults to
  `All` and resets on each screen visit.
- `rate()` no longer returns `'Expert'` as the cascade-stalled
  fallback; `RateResult.solved` is the authoritative signal.
- The §7.3 failure dialog displays the worker's `lastError` message
  whenever one is present.
- The fuzz harness runs in CI's unit suite without throwing; any
  per-finder regression fixtures derived from its output are green.
- WebKit and Chromium E2E suites pass locally pre-push.
- No regressions in v0.2.0 functionality (existing E2E + unit suites
  still pass).
