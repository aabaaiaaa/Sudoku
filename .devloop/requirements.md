# Sudoku PWA — Iteration 2 Requirements: Difficulty Overhaul

This iteration overhauls the difficulty system, adds a comprehensive techniques
help section, makes puzzle generation responsive via a Web Worker, and bumps the
persistence schema to support future migrations.

The v0.1.0 baseline (variants, themes, PWA, save/stats/settings stores, board
and gameplay components) is unchanged except where called out. The previous
iteration's requirements are archived at `.devloop/archive/iteration-1/`.

## 1. Motivation

The shipped difficulty system is broken in two ways:

1. **Expert is too easy.** Most puzzles labelled Expert can be solved with
   nothing harder than a Hidden Single. The user reports very little perceived
   difference between Easy and Expert.
2. **The rater conflates "hard" with "unsolvable by our techniques".** The
   solver implements only seven techniques; any puzzle requiring something
   beyond X-Wing falls back to a generic "Expert" label, regardless of whether
   it actually requires advanced reasoning.

The fix is to (a) implement a much deeper technique library, (b) require strict
tier matching during generation (a puzzle's tier is determined by the hardest
technique it actually needs), and (c) split the difficulty space across eight
tiers — one per "generation" of solving technique — so each tier introduces
exactly one new family of reasoning the player must learn.

## 2. Goals

- Make each difficulty tier feel meaningfully harder than the last.
- Guarantee that a puzzle's tier reflects the hardest reasoning it requires.
- Teach players advanced techniques in-app, with interactive examples.
- Keep the UI responsive during long generations (top-tier puzzles may take
  many seconds and many rejected attempts to find).
- Preserve room for future save migrations by stamping new persisted records
  with the app version that wrote them.

## 3. Non-goals

- No multiplayer, leaderboards, accounts, or sync (still out of scope from v1).
- No automated migration of v1 saved state — old saves are silently dropped.
- No new variants. Mini and Six remain; Killer remains out of scope.
- No solver coverage of every published technique. We implement a curated set
  spanning generations 1-8; rarer or near-equivalent techniques (e.g. Sue de
  Coq, Death Blossom, multi-sector Locked Sets) are out of scope for this
  iteration.

## 4. Tier system

Eight tiers, named in the Classic escalation style. Each tier corresponds to
a "generation" — the family of technique whose presence as the *hardest
required* step defines that tier.

| #  | Tier        | Generation             | Hardest required technique(s)                              |
|----|-------------|------------------------|------------------------------------------------------------|
| 1  | Easy        | Singles                | Naked Single only                                          |
| 2  | Medium      | Singles                | Hidden Single                                              |
| 3  | Hard        | Locked candidates      | Pointing Pair, Box-Line Reduction                          |
| 4  | Expert      | Subsets                | Naked/Hidden Pair, Naked/Hidden Triple, Naked/Hidden Quad  |
| 5  | Master      | Fish                   | X-Wing, Swordfish, Jellyfish                               |
| 6  | Diabolical  | Wings, chains, single-digit chains | XY-Wing, XYZ-Wing, W-Wing, Simple Coloring, X-Cycle, Empty Rectangle, Skyscraper, Two-String Kite |
| 7  | Demonic     | Advanced inferences    | Unique Rectangle (Types 1/2/4), BUG+1, XY-Chain, Multi-Coloring, ALS-XZ, WXYZ-Wing, Hidden Rectangle, Avoidable Rectangle |
| 8  | Nightmare   | Exotica                | Nice Loop (continuous + discontinuous), Grouped X-Cycle, 3D Medusa, Death Blossom, Forcing Chains |

The `Difficulty` type and `DIFFICULTY_ORDER` constant in
`src/engine/generator/rate.ts` must be expanded to include all eight tiers in
order from Easy through Nightmare.

### 4.1 Variant caps

Smaller grids cannot mathematically require advanced techniques. The UI hides
infeasible tiers per variant so the picker only shows what the generator can
realistically produce.

| Variant         | Tiers shown                    | Cap reason                                      |
|-----------------|--------------------------------|-------------------------------------------------|
| Classic (9×9)   | Easy → Nightmare (all 8)       | Full tier range supported.                      |
| Six (6×6)       | Easy → Diabolical (6)          | Wings/chains possible; Demonic+ statistically unreachable. |
| Mini (4×4)      | Easy → Hard (3)                | Box size 2×2 makes subsets and fish degenerate. |

`CLUE_BOUNDS` in `rate.ts` must be extended with entries for the new tiers per
variant. The bounds are advisory; strict tier matching (§6) is the primary
filter.

## 5. Solver — new technique implementations

The existing solver implements seven techniques (naked single, hidden single,
naked pair, naked triple, pointing, box-line reduction, X-wing). This
iteration adds **twenty-seven** more, each in its own file under
`src/engine/solver/techniques/` with a unit test using a hand-authored
fixture.

### 5.1 New techniques and tier mapping

| Technique             | File                                                   | Tier        |
|-----------------------|--------------------------------------------------------|-------------|
| Hidden Pair           | `techniques/hidden-pair.ts`                            | Expert      |
| Hidden Triple         | `techniques/hidden-triple.ts`                          | Expert      |
| Naked Quad            | `techniques/naked-quad.ts`                             | Expert      |
| Hidden Quad           | `techniques/hidden-quad.ts`                            | Expert      |
| Swordfish             | `techniques/swordfish.ts`                              | Master      |
| Jellyfish             | `techniques/jellyfish.ts`                              | Master      |
| XY-Wing               | `techniques/xy-wing.ts`                                | Diabolical  |
| XYZ-Wing              | `techniques/xyz-wing.ts`                               | Diabolical  |
| W-Wing                | `techniques/w-wing.ts`                                 | Diabolical  |
| Simple Coloring       | `techniques/simple-coloring.ts`                        | Diabolical  |
| X-Cycle               | `techniques/x-cycle.ts`                                | Diabolical  |
| Empty Rectangle       | `techniques/empty-rectangle.ts`                        | Diabolical  |
| Skyscraper            | `techniques/skyscraper.ts`                             | Diabolical  |
| Two-String Kite       | `techniques/two-string-kite.ts`                        | Diabolical  |
| Unique Rectangle      | `techniques/unique-rectangle.ts` (Types 1, 2, 4)       | Demonic     |
| BUG+1                 | `techniques/bug.ts`                                    | Demonic     |
| XY-Chain              | `techniques/xy-chain.ts`                               | Demonic     |
| Multi-Coloring        | `techniques/multi-coloring.ts`                         | Demonic     |
| ALS-XZ                | `techniques/als-xz.ts`                                 | Demonic     |
| WXYZ-Wing             | `techniques/wxyz-wing.ts`                              | Demonic     |
| Hidden Rectangle      | `techniques/hidden-rectangle.ts`                       | Demonic     |
| Avoidable Rectangle   | `techniques/avoidable-rectangle.ts`                    | Demonic     |
| Nice Loop             | `techniques/nice-loop.ts` (continuous + discontinuous) | Nightmare   |
| Grouped X-Cycle       | `techniques/grouped-x-cycle.ts`                        | Nightmare   |
| 3D Medusa             | `techniques/medusa-3d.ts`                              | Nightmare   |
| Death Blossom         | `techniques/death-blossom.ts`                          | Nightmare   |
| Forcing Chains        | `techniques/forcing-chains.ts`                         | Nightmare   |

Each technique exports a finder function that operates on a candidate grid
(matching the existing pattern in `rate.ts`) and returns either eliminations
or a placement plus metadata (`{ technique, eliminations | placement,
explanation }`). Each technique's test file has at least one positive fixture
(pattern present, expected eliminations) and one negative fixture (pattern
absent, returns null).

### 5.2 Rater integration

The candidate-grid solver inside `rate.ts` (currently inlined) must be extended
to call each new finder in increasing-difficulty order. On any progress, the
solver restarts at Naked Single — so the hardest technique that actually fired
is the puzzle's tier.

The `TECHNIQUE_TIER` mapping in `rate.ts` must be **rebuilt**, not just
extended — several existing techniques move to different tiers under the new
system:

| Technique             | v0.1.0 tier | New tier   |
|-----------------------|-------------|------------|
| Naked Single          | Easy        | Easy       |
| Hidden Single         | Medium      | Medium     |
| Naked Pair            | Hard        | Expert     |
| Naked Triple          | Hard        | Expert     |
| Pointing Pair         | Hard        | Hard       |
| Box-Line Reduction    | Expert      | Hard       |
| X-Wing                | Expert      | Master     |

The new mapping (existing + 27 new entries) covers all 34 techniques. The
`Difficulty` union type expands to:

```ts
export type Difficulty =
  | 'Easy' | 'Medium' | 'Hard' | 'Expert'
  | 'Master' | 'Diabolical' | 'Demonic' | 'Nightmare';
```

`hardestTechnique` and `techniquesUsed` in `RateResult` retain their current
shapes; only the tier mapping grows.

### 5.3 Public hint solver

The public `nextStep` exported by `src/engine/solver/techniques/index.ts` must
also include all new techniques in difficulty order so the **Hint** button can
surface them. Currently `nextStep` recomputes candidates per call; this remains
true, but the technique chain is extended.

For chain-style techniques (XY-Chain, Nice Loop, etc.) where the eliminations
matter more than a single placement, the hint metadata must include enough
information for the help-section walkthrough to render the deduction (the
relevant cells, the chain links, and the cell(s) where candidates are
eliminated).

## 6. Strict tiering and generator changes

### 6.1 Strict tier rule

`generateForDifficulty(variant, target)` must accept a generated puzzle only
when `rate(puzzle).difficulty === target`. Any other rating — easier or harder
— is rejected and the generator retries.

This is the central behavioural change that makes the tier label trustworthy.
It replaces today's behaviour, which only checks clue count and accepts
whatever tier the puzzle happens to rate at.

### 6.2 Retry policy

- **Maximum attempts**: 50 per call.
- **Hard timeout**: 60 seconds wall clock.
- Whichever limit is hit first ends generation in failure.

On failure the generator returns a structured `GenerationFailed` result with
the closest tier produced (if any) plus the attempt count and elapsed time.
The UI surfaces a fallback dialog (§7.3) rather than silently falling back.

### 6.3 Web Worker

Generation moves to a Web Worker:

- New file `src/workers/generator.worker.ts` exporting a worker that handles
  `{ type: 'generate', variant, difficulty }` messages.
- Worker emits progress events `{ type: 'progress', attempt, max }` after each
  rejected attempt and a terminal `{ type: 'done', puzzle, rating }` or
  `{ type: 'failed', closestRating, attempts, elapsedMs }`.
- Worker is `terminate()`-able. Cancel from the main thread terminates
  immediately.
- A small Promise wrapper in `src/store/game.ts` (or a new
  `src/workers/generator-client.ts`) exposes:
  ```ts
  function generateInWorker(variant, difficulty): {
    promise: Promise<Puzzle | GenerationFailed>;
    cancel: () => void;
    onProgress: (cb: (p: { attempt: number; max: number }) => void) => void;
  };
  ```

The Web Worker is a hard requirement — without it, top-tier generation freezes
the UI and the cancel button cannot be clicked.

### 6.4 Game store integration

The `newGame(variant, difficulty)` action in `src/store/game.ts` becomes async.
It sets a `loading: true` flag, calls `generateInWorker`, and resolves the
board into the store on success or surfaces the failure dialog on failure.
Existing tests of the game store must be updated to await the action.

## 7. Loading UX

### 7.1 Spinner overlay

- After **200 ms** of generation (debounced — quick generations should not
  flash an overlay), the game store's `loading` flag triggers a full-screen
  overlay rendered in `src/screens/Game.tsx`.
- Visual: blurred grid behind (reusing the existing pause-overlay treatment)
  with a centered spinner. No text.
- Spinner is a simple animated SVG/CSS spinner; no progress percentage.

### 7.2 Cancel button (10 second threshold)

- After **10 seconds** of continuous generation, fade in:
  - A **Cancel** button below the spinner.
  - A small note: *"Higher difficulties can take longer to generate."*
- Clicking Cancel terminates the worker and returns to Home.

### 7.3 Hard-timeout fallback dialog

When the worker reports `failed` (50 attempts or 60 seconds), the spinner
overlay is replaced by a modal dialog with:

- Heading: e.g. *"Couldn't find a Demonic puzzle in time."*
- Body explaining the situation briefly.
- Three actions:
  - **Try again** — re-runs `generateInWorker` for the same target.
  - **Try [next-easier-tier]** — re-runs for the tier directly below.
  - **Cancel** — returns to Home.

If no easier tier exists (target was Easy), only **Try again** and **Cancel**
are shown.

## 8. Techniques help section

A new screen teaches every implemented technique with an interactive example.

### 8.1 Navigation

Bottom tab bar gains a **Learn** entry alongside Home / Stats / Settings. The
Learn tab is the entry point to the techniques index.

### 8.2 Index page

`src/screens/Techniques.tsx`:

- Lists all 34 techniques (7 existing + 27 new) grouped by generation.
- Each row shows technique name + tier badge.
- Tapping a row opens the detail page.

### 8.3 Detail page

`src/screens/TechniqueDetail.tsx` (or a sub-route):

- Technique name, tier badge, plain-language *"When to look for it"*
  description.
- **Live mini-board** rendered with the existing `Board` component, preloaded
  with a hand-authored fixture demonstrating the technique. The board uses
  the variant most appropriate for the technique (usually Classic 9×9, but
  Mini for the early techniques where space allows).
- **Three-step walkthrough buttons** in order:
  1. **Highlight pattern** — colors the relevant cells/houses on the live
     board.
  2. **Show deduction** — visualises the eliminations or forced placement
     (highlighted candidates struck through, or the placement cell glowing).
  3. **Apply** — applies the deduction to the board.
- A **Reset** button returns the board to the original fixture state.

### 8.4 Fixtures

Each technique has a hand-authored fixture stored alongside its solver code as
`techniques/<name>.fixture.ts`. The fixture exports:

```ts
export const fixture = {
  variant: 'classic' | 'six' | 'mini',
  board: string,            // serialized board
  patternCells: Position[], // cells to highlight in step 1
  deduction: {
    eliminations?: Array<{ pos: Position; digits: Digit[] }>;
    placement?: { pos: Position; digit: Digit };
  };
  description: string,      // "When to look for it"
};
```

Fixtures are imported by both the technique's unit test and the help screen,
so the test verifies the fixture is real (the technique actually fires on it).

### 8.5 Hint integration

The existing **Hint** panel (`src/components/Hint.tsx`) gains a
*"Learn more about [technique name] →"* link below the technique explanation.
The link navigates to the detail page for that technique. A player who
encounters an unfamiliar technique mid-game can immediately read about it.

## 9. Save versioning

### 9.1 Schema bump

- `localStorage` key `sudoku.save.v1` → `sudoku.save.v2`.
- `localStorage` key `sudoku.stats.v1` → `sudoku.stats.v2`.
- v1 entries silently dropped on first load (continues existing behaviour for
  schema mismatch).
- No migration code is added in this iteration.

### 9.2 appVersion stamp

Every persisted record (saves and stats) gains an `appVersion: string` field
written at save time. The value is read from `package.json#version` via Vite's
`define` config:

```ts
// vite.config.ts
define: {
  __APP_VERSION__: JSON.stringify(pkg.version),
}
```

Future iterations can use `appVersion` to make migration decisions. This
iteration does not consume the field.

## 10. Existing code to update

Non-exhaustive list of files this iteration touches beyond the new ones:

- `src/engine/generator/rate.ts` — extended technique chain + tier mapping +
  Difficulty union.
- `src/engine/generator/generate-for-difficulty.ts` — strict tier rule, retry
  cap, hard timeout, structured failure result.
- `src/engine/solver/techniques/index.ts` — register all new techniques in
  difficulty order, expose them via `nextStep`.
- `src/store/game.ts` — async `newGame`, `loading` flag, worker integration.
- `src/store/save.ts` — schema bump, `appVersion` stamp.
- `src/store/stats.ts` — schema bump, `appVersion` stamp, new tier keys.
- `src/screens/Home.tsx` — variant-aware difficulty picker (cap shown tiers
  per variant).
- `src/screens/Game.tsx` — loading overlay + cancel button + fallback dialog.
- `src/components/Hint.tsx` — *Learn more* link to help detail page.
- App routing / bottom tab bar — add **Learn** tab.
- `vite.config.ts` — `define` for `__APP_VERSION__`.
- `package.json` — bump version (e.g. 0.1.0 → 0.2.0) so the new appVersion
  stamp is meaningful.

## 11. Testing strategy

- **Unit (Vitest)**:
  - One test file per new technique under
    `src/engine/solver/techniques/<name>.test.ts` with positive and negative
    fixtures.
  - `rate.test.ts` extended with hand-authored puzzles of each new tier
    (Master, Diabolical, Demonic, Nightmare) for Classic.
  - `generate-for-difficulty.test.ts` extended to verify strict tiering and
    the structured failure result on retry-cap exhaustion (use a low cap in
    test config).
  - Worker client wrapper tested with a fake worker (post-message-driven).
- **Component (Vitest + Testing Library)**:
  - `Techniques.test.tsx` — index renders all techniques grouped by tier.
  - `TechniqueDetail.test.tsx` — three-step walkthrough advances on click;
    Reset restores the fixture.
  - Loading overlay test — overlay appears after 200ms; cancel button appears
    after 10s; clicking Cancel terminates the worker.
- **E2E (Playwright)**:
  - `tests/e2e/difficulty.spec.ts` — pick a Demonic puzzle, observe spinner,
    observe cancel button after wait, and assert the puzzle eventually loads
    with the expected difficulty badge.
  - `tests/e2e/techniques-help.spec.ts` — open the Learn tab, navigate into
    a technique, step through the walkthrough, return to the index.
  - `tests/e2e/hint-learn-more.spec.ts` — start a game, click Hint, click
    *Learn more*, assert it navigates to the matching technique page.

## 12. Edge cases and failure modes

- **Worker generation fails (50 attempts):** fallback dialog with "Try again",
  "Try [easier]", "Cancel".
- **User clicks Cancel during generation:** worker terminated; UI returns to
  Home; `loading` flag cleared.
- **Page hidden mid-generation:** worker continues (the Worker thread isn't
  paused by `visibilitychange` for non-throttled workers; UI catches up on
  resume). No special handling required.
- **Difficulty selected for variant where tier is unsupported:** UI never
  exposes that combination (variant cap enforced in the picker).
- **Hint surfaces a technique not yet in help section:** impossible by design
  — every technique implemented has a help page and fixture. Tests verify
  the registry sets match.
- **Old v1 save discovered:** silently discarded as today.
- **Unknown `appVersion` in save:** load normally for now; future iterations
  may branch on this.
- **Solver chain encounters a puzzle it can't solve at all (theoretical):**
  rated `Nightmare`; logs a warning to the console with the puzzle for triage.

## 13. Success criteria

- Selecting Easy through Nightmare on Classic produces puzzles whose hardest
  required technique exactly matches the tier.
- Selecting an Expert puzzle requires at least a Naked/Hidden Pair to solve
  logically — never solvable with only singles.
- Selecting a Demonic puzzle on Classic eventually generates within 60s in
  ≥95% of attempts.
- Loading overlay appears only when generation exceeds 200ms.
- Cancel button appears at 10s and successfully terminates the worker.
- All 34 techniques are represented in the **Learn** section with interactive
  walkthroughs.
- Clicking *Learn more* in the Hint panel navigates to the matching technique
  page.
- Existing v1 saves are silently discarded; new saves contain `appVersion`.
- No regressions in v0.1.0 functionality (existing E2E suite still passes).
- All new and updated unit tests pass; targeted E2E tests pass.
