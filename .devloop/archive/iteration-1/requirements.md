# Sudoku PWA — Requirements

A mobile-friendly, installable Sudoku web app that plays well on iOS Safari and
Chrome on Android, and remains fully usable on desktop Chrome with keyboard
controls. Everything runs client-side; there is no backend, no account system,
and no network dependency during gameplay.

## 1. Goals

- Deliver a polished, offline-capable Sudoku game as a Progressive Web App.
- Support multiple grid variants and four difficulty tiers.
- Feel native on mobile (touch-first) while remaining first-class on desktop.
- Keep all state local to the browser — puzzles, progress, stats, and settings.
- Be extensible: themes and variants should be straightforward to add later.

## 2. Non-goals

- No user accounts, authentication, or cloud sync.
- No multiplayer, leaderboards, or social features.
- No ads or monetization.
- No backend, database, or server-side puzzle generation.
- No accessibility work beyond what comes naturally from semantic HTML and
  reasonable contrast (explicitly out of scope per the user).
- Killer Sudoku is intentionally excluded from v1.

## 3. Target platforms

- **Primary:** iOS Safari and Chrome on Android, installed as a PWA.
- **Secondary:** Chrome on desktop (and modern desktop browsers broadly) with
  keyboard navigation.
- Layout is mobile-first; desktop gets a centered, width-constrained layout.

## 4. Variants

Three variants ship in v1:

| Variant    | Grid  | Boxes         | Digit set |
|------------|-------|---------------|-----------|
| Classic    | 9×9   | 3×3 (nine)    | 1-9       |
| Mini       | 4×4   | 2×2 (four)    | 1-4       |
| Six        | 6×6   | 2×3 (six)     | 1-6       |

The engine (grid type, solver, generator, renderer, number pad) must be
parameterized over variant so new variants can be added by registering their
dimensions, box shape, and digit set. Killer is out of scope for v1 but should
not be designed out — leave room for cage overlays later.

## 5. Difficulty levels

Four difficulty tiers: **Easy**, **Medium**, **Hard**, **Expert**.

Difficulty is defined by the hardest solving technique required to solve the
puzzle logically (no guessing), with clue-count acting as a secondary bound so
tiers feel distinct at a glance. Proposed rules for Classic 9×9:

| Tier   | Hardest required technique                | Target clue count |
|--------|-------------------------------------------|-------------------|
| Easy   | Naked singles only                        | 38-45             |
| Medium | Hidden singles                            | 32-37             |
| Hard   | Naked/hidden pairs, pointing pairs        | 28-31             |
| Expert | Box/line reduction, X-wing (or harder)    | 24-27             |

For Mini (4×4) and Six (6×6) the same tiering concept applies but with
variant-appropriate clue counts. The generator rates each puzzle by running the
technique solver and records the rating alongside the puzzle. Puzzles must
have a unique solution.

## 6. Core gameplay

### 6.1 Board interaction

- Tap (or click) a cell to select it. Selected cell, its row/column/box peers,
  and any cells containing the same digit are visually highlighted.
- Enter digits via the on-screen number pad (primary input) or the keyboard
  (desktop). Given clues (from the starting puzzle) cannot be edited.
- A "notes" / pencil-mark toggle switches the number pad between entering a
  solved digit and toggling a candidate note.
- Placing a digit in a cell automatically removes that digit from the pencil
  marks of every peer cell (row, column, box).
- An "erase" action clears the current cell's entered digit and notes.

### 6.2 Keyboard (desktop)

- **Arrow keys:** move selection.
- **1-9 (or 1-N for variant):** place digit in normal mode, toggle note in
  note mode.
- **N:** toggle note mode.
- **Backspace / Delete:** erase cell.
- **Escape:** deselect.
- **Space:** pause/resume.

### 6.3 Mistake highlighting

When the player places a digit that conflicts with a peer (duplicate in row,
column, or box), the conflicting cells are highlighted in a warning color.
Entry is still allowed — the highlight is advisory, not blocking. There is no
mistake cap and no game-over state; a mistake count is tracked for stats only.

### 6.4 Hints

A **Hint** button runs the technique solver against the current board state
and surfaces the next logical step:

- Highlights the relevant cell(s) and/or house.
- Names the technique in plain language (e.g. "Hidden single in column 4",
  "Naked pair in row 7 eliminates 2/5 from R7C1").
- Does not fill in the answer automatically — the player still places the
  digit.

If the current board cannot be advanced by the implemented techniques (because
the player has entered a mistake or the engine doesn't know a harder
technique), the hint surfaces a helpful message rather than a solution.

### 6.5 Timer and pause

- A timer starts on the first interaction with a new game and pauses on
  completion.
- A manual **Pause** button hides the board behind an overlay and freezes the
  timer; resuming restores the board.
- The timer auto-pauses when the page is hidden (tab switched, app backgrounded)
  via the `visibilitychange` event, and resumes on focus.

### 6.6 Win state

When the board is completely and correctly filled, the game enters a win
state: a modal congratulates the player, shows the final time and mistake
count, and offers "New Game" and "Back to Home". Stats are updated.

## 7. Save, stats, and settings

All persistence is local (browser `localStorage`). No server calls.

### 7.1 In-progress save

- Exactly one in-progress game per variant is saved.
- Starting a new game of a variant replaces any previous unfinished save for
  that variant (with a confirmation prompt).
- On launch, the home screen surfaces a "Resume" card per variant that has a
  saved game, showing difficulty and elapsed time.

### 7.2 Stats (per variant × difficulty)

- Games completed
- Best time
- Current streak and longest streak (consecutive days with at least one
  completion)
- Average solve time (rolling)
- Total mistakes made

Stats survive page reloads and app reinstalls (within the same browser
profile). A **Reset stats** button lives in settings with a confirmation step.

### 7.3 Settings

- **Theme:** Light, Dark, Notepad, Space. Plus a "Follow system" toggle that,
  when on, switches between Light and Dark based on `prefers-color-scheme`.
  Selecting a non-auto theme turns the toggle off.
- Future settings (difficulty default, sound, etc.) can slot in here.

## 8. Themes

Themes are implemented as sets of CSS custom properties on a root element and
selected by a `data-theme` attribute. Four themes ship in v1:

- **Light** — clean, neutral, high contrast. Default when system is light.
- **Dark** — deep neutrals, softened contrast for night play.
- **Notepad** — paper / graphite aesthetic. Warm off-white background,
  ruled-paper feel, graphite-pencil ink for player digits, inked given clues.
- **Space** — cosmic aesthetic. Deep indigo / near-black background, subtle
  starfield or nebula accent, luminous digits.

The theme system must make adding a fifth theme a matter of adding one CSS
variable set plus a registry entry — no component changes.

## 9. PWA / offline

- Installable on iOS and Android (manifest with name, icons, theme color,
  display mode `standalone`).
- Service worker (via `vite-plugin-pwa`) pre-caches the built app shell so the
  game is fully playable offline after first load.
- Safe-area insets respected for iOS notches and home indicator.
- Viewport configured to prevent unwanted zooming during digit entry.

## 10. Technical stack

- **Language:** TypeScript
- **Framework:** React 18
- **Build:** Vite with `vite-plugin-pwa`
- **Styling:** Tailwind CSS, theme variables via CSS custom properties
- **State:** Zustand, with persistence middleware writing to `localStorage`
- **Package manager:** npm
- **Unit tests:** Vitest (for engine, solver, generator, stores)
- **E2E tests:** Playwright (for gameplay flows, PWA, offline)
- **Deploy:** static host (Vercel / Netlify / GitHub Pages) — chosen later

## 11. Architecture outline

Suggested folder layout (non-binding, to be refined during implementation):

```
src/
  engine/             # pure puzzle logic, no React
    types.ts          # Cell, Board, Variant, Move types
    variants/         # variant registry (classic, mini, six)
    solver/           # backtracking solver + technique solver
    generator/        # puzzle generation + difficulty rating
  store/              # Zustand stores: game, stats, settings
  components/         # Board, Cell, NumberPad, Timer, Hint, Modal, ...
  screens/            # Home, Game, Stats, Settings
  themes/             # theme definitions (CSS variable maps)
  pwa/                # manifest, icons, service worker config
  App.tsx
  main.tsx
tests/
  unit/               # Vitest
  e2e/                # Playwright
```

The engine layer has no React dependency so it can be fully unit-tested and
reused across variants.

## 12. Edge cases and failure modes

- **Puzzle generator hangs or loops:** generator must have a retry cap and
  fall back to a safe pre-seeded pattern if it can't produce a puzzle in the
  target difficulty within N attempts.
- **Corrupted localStorage:** read/validate saved state; on schema mismatch or
  parse failure, drop the save and start fresh rather than crashing.
- **Save schema evolves:** include a `version` field on persisted state; stores
  should migrate or discard older versions gracefully.
- **Timer drift during long pauses:** compute elapsed time from timestamps
  rather than interval counters.
- **Tab hidden mid-move:** auto-pause must not clobber pending input; resume
  restores the exact prior selection.
- **Theme mid-game:** changing theme never alters game state.
- **Hint with no available technique:** surface a clear message, don't spin.
- **Zoom / pinch on mobile:** disabled for gameplay surfaces so accidental
  zooms don't break layout; still allowed on modal content if needed.

## 13. Testing strategy

- **Unit (Vitest):** engine types, peer computation, backtracking solver
  correctness and uniqueness, each solving technique, generator produces
  unique-solution puzzles at the target difficulty, difficulty rater,
  store reducers, persistence migration.
- **E2E (Playwright):** start a new game, place digits via number pad and
  keyboard, toggle notes, mistake highlighting, hint surfaces a technique,
  pause/resume, win flow updates stats, resume an in-progress save after
  reload, theme switch persists, offline load after install.

## 14. Success criteria ("done")

- All three variants playable end-to-end on mobile and desktop.
- Generator produces puzzles with unique solutions in under ~2 seconds for
  Classic; faster for Mini and Six.
- Puzzles are correctly rated into Easy / Medium / Hard / Expert.
- Pencil marks auto-clear from peers on digit entry.
- Mistake highlighting works; mistake count recorded.
- Hints name the technique and highlight cells without filling the answer.
- Timer pauses correctly on manual pause and on tab hide.
- One in-progress save per variant persists across reloads.
- Stats persist and update correctly on completion.
- All four themes selectable; follow-system toggle works on first load and
  live.
- App installs as a PWA on iOS and Android and loads offline.
- Vitest and Playwright suites pass in CI.
