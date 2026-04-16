# Sudoku PWA — Tasks

See `.devloop/requirements.md` for full context. All tasks assume Windows/bash;
paths use forward slashes relative to repo root.

Conventions:
- Engine code is pure TS (no React) under `src/engine/`.
- Unit tests live next to the file under test (`foo.ts` + `foo.test.ts`).
- Playwright specs live under `tests/e2e/`.
- `data-testid` attributes are added on any UI element referenced by E2E tests.

---

### TASK-001: Initialize Vite + React + TypeScript project
- **Status**: done
- **Dependencies**: none
- **Description**: Scaffold a Vite + React + TS project at the repo root. Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`. Install `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, and type packages. Ensure `npm run dev` and `npm run build` scripts exist.
- **Verification**: `npm run build` completes without errors.

### TASK-002: Add Tailwind CSS
- **Status**: done
- **Dependencies**: TASK-001
- **Description**: Install `tailwindcss`, `postcss`, `autoprefixer`. Generate `tailwind.config.js` and `postcss.config.js`. Add Tailwind directives to `src/index.css` and import it from `main.tsx`. Add a visible test class on `App.tsx` (e.g. a styled heading) to confirm it applies.
- **Verification**: `npm run build` completes and the output CSS in `dist/` contains Tailwind utility classes (grep for `bg-` or similar in built CSS).

### TASK-003: Configure Vitest with a smoke test
- **Status**: done
- **Dependencies**: TASK-001
- **Description**: Install `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`. Add `vitest.config.ts` (or extend `vite.config.ts`) with jsdom env. Add `test` script running `vitest run`. Create `src/smoke.test.ts` with a trivial assertion.
- **Verification**: `npx vitest run src/smoke.test.ts` passes.

### TASK-004: Configure Playwright with a smoke test
- **Status**: done
- **Dependencies**: TASK-001
- **Description**: Install `@playwright/test` and run `npx playwright install chromium`. Add `playwright.config.ts` pointing at the Vite dev server (webServer config). Create `tests/e2e/smoke.spec.ts` that navigates to `/` and asserts the page loads.
- **Verification**: `npx playwright test tests/e2e/smoke.spec.ts` passes.

### TASK-005: Add vite-plugin-pwa with a minimal manifest
- **Status**: done
- **Dependencies**: TASK-001
- **Description**: Install `vite-plugin-pwa`. Configure it in `vite.config.ts` with `registerType: 'autoUpdate'`, a minimal `manifest` (name, short_name, theme_color, display: 'standalone', placeholder icons). Create a `public/` folder with placeholder SVG icons referenced by the manifest.
- **Verification**: `npm run build` completes and `dist/manifest.webmanifest` plus `dist/sw.js` exist.

### TASK-006: Engine — core types
- **Status**: done
- **Dependencies**: TASK-003
- **Description**: Create `src/engine/types.ts` defining `Digit`, `Cell` (value | null, notes: Set<Digit>, given: boolean), `Board` (2D array of Cell plus variant reference), `Variant` (id, size, boxWidth, boxHeight, digits), `Move`, `Position`. No logic — pure types and small factory helpers.
- **Verification**: `npx tsc --noEmit src/engine/types.ts` completes without errors.

### TASK-007: Engine — variant registry with Classic 9×9
- **Status**: done
- **Dependencies**: TASK-006
- **Description**: Create `src/engine/variants/index.ts` with a variant registry map. Add `src/engine/variants/classic.ts` defining the 9×9 variant (size 9, boxWidth 3, boxHeight 3, digits 1-9).
- **Verification**: `npx tsc --noEmit src/engine/variants/classic.ts src/engine/variants/index.ts` completes without errors.

### TASK-008: Engine — Mini 4×4 and Six 6×6 variants
- **Status**: done
- **Dependencies**: TASK-007
- **Description**: Add `src/engine/variants/mini.ts` (4×4, 2×2 boxes, digits 1-4) and `src/engine/variants/six.ts` (6×6, 2 rows × 3 cols per box, digits 1-6). Register both in the variant registry.
- **Verification**: `npx tsc --noEmit src/engine/variants/mini.ts src/engine/variants/six.ts` completes without errors.

### TASK-009: Engine — peer computation
- **Status**: done
- **Dependencies**: TASK-007
- **Description**: Create `src/engine/peers.ts` with `rowPeers`, `colPeers`, `boxPeers`, and combined `peers(variant, pos)` returning the set of peer positions for a cell. Write `src/engine/peers.test.ts` covering all three variants and a corner/center spot check.
- **Verification**: `npx vitest run src/engine/peers.test.ts` passes.

### TASK-010: Engine — board utilities
- **Status**: done
- **Dependencies**: TASK-009
- **Description**: Create `src/engine/board.ts` with `emptyBoard(variant)`, `cloneBoard`, `serialize`/`deserialize` (compact string form), `isComplete`, `findConflicts(board)` returning positions violating Sudoku rules. Add `src/engine/board.test.ts` covering each function.
- **Verification**: `npx vitest run src/engine/board.test.ts` passes.

### TASK-011: Engine — backtracking solver with uniqueness check
- **Status**: done
- **Dependencies**: TASK-010
- **Description**: Create `src/engine/solver/backtracking.ts` exporting `solve(board)` and `countSolutions(board, cap = 2)` (stops once 2 solutions found; used for uniqueness). Add `src/engine/solver/backtracking.test.ts` with known-solution fixtures for Classic, Mini, and Six, plus a uniqueness test.
- **Verification**: `npx vitest run src/engine/solver/backtracking.test.ts` passes.

### TASK-012: Engine — technique solver: naked singles
- **Status**: done
- **Dependencies**: TASK-011
- **Description**: Create `src/engine/solver/techniques/naked-single.ts` exporting a function that scans the board, computes candidates per cell, and returns the first cell with exactly one candidate along with metadata (`{ technique, cell, digit, explanation }`). Test file with fixtures where a naked single exists and where none does.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-single.test.ts` passes.

### TASK-013: Engine — technique solver: hidden singles
- **Status**: done
- **Dependencies**: TASK-012
- **Description**: Add `src/engine/solver/techniques/hidden-single.ts` — for each house (row/col/box), find a digit that can go in only one cell of that house. Return metadata with the house name. Test with fixtures for row, col, and box hidden singles.
- **Verification**: `npx vitest run src/engine/solver/techniques/hidden-single.test.ts` passes.

### TASK-014: Engine — technique solver: naked pairs/triples
- **Status**: done
- **Dependencies**: TASK-013
- **Description**: Add `src/engine/solver/techniques/naked-subset.ts` detecting naked pairs and naked triples in any house and returning candidate eliminations. Test with fixtures for a naked pair eliminating candidates in the same row.
- **Verification**: `npx vitest run src/engine/solver/techniques/naked-subset.test.ts` passes.

### TASK-015: Engine — technique solver: pointing pairs / box-line reduction
- **Status**: done
- **Dependencies**: TASK-014
- **Description**: Add `src/engine/solver/techniques/intersection.ts` detecting pointing pairs (candidates confined to a box-line intersection, eliminating from the rest of the line) and box-line reduction (the inverse). Test each direction with a fixture.
- **Verification**: `npx vitest run src/engine/solver/techniques/intersection.test.ts` passes.

### TASK-016: Engine — technique solver: X-wing
- **Status**: pending
- **Dependencies**: TASK-015
- **Description**: Add `src/engine/solver/techniques/x-wing.ts` detecting X-wing patterns (two rows or cols where a digit is confined to the same two columns/rows). Test with a classic X-wing fixture.
- **Verification**: `npx vitest run src/engine/solver/techniques/x-wing.test.ts` passes.

### TASK-017: Engine — technique solver aggregator
- **Status**: pending
- **Dependencies**: TASK-016
- **Description**: Create `src/engine/solver/techniques/index.ts` exporting `nextStep(board)` that applies techniques in increasing difficulty order and returns the first one that makes progress (or null). Export the technique list in order. Test that naked singles fire before hidden singles, etc.
- **Verification**: `npx vitest run src/engine/solver/techniques/index.test.ts` passes.

### TASK-018: Engine — puzzle generator (Classic 9×9)
- **Status**: pending
- **Dependencies**: TASK-017
- **Description**: Create `src/engine/generator/generate.ts`. Strategy: fill a full valid solution (randomized backtracking), then remove cells one at a time while `countSolutions === 1`, stopping when further removal would break uniqueness or a clue-count floor is reached. Test that generated puzzles are unique and solvable for Classic, Mini, and Six.
- **Verification**: `npx vitest run src/engine/generator/generate.test.ts` passes.

### TASK-019: Engine — difficulty rater
- **Status**: pending
- **Dependencies**: TASK-018
- **Description**: Create `src/engine/generator/rate.ts` that runs the technique solver on a puzzle and returns the hardest technique required, mapped to `Easy | Medium | Hard | Expert`. Include clue-count bounds per variant (per requirements doc §5). Test with hand-crafted puzzles of each tier for Classic.
- **Verification**: `npx vitest run src/engine/generator/rate.test.ts` passes.

### TASK-020: Engine — difficulty-targeted generator
- **Status**: pending
- **Dependencies**: TASK-019
- **Description**: Add `generateForDifficulty(variant, difficulty)` that repeatedly generates + rates until it produces a puzzle at the requested tier or hits a retry cap; on cap exhaustion, returns the closest tier produced. Test that it returns a puzzle rated at the requested tier for each of the 4 tiers on Classic.
- **Verification**: `npx vitest run src/engine/generator/generate-for-difficulty.test.ts` passes.

### TASK-021: Store — game slice (Zustand)
- **Status**: done
- **Dependencies**: TASK-003, TASK-010
- **Description**: Install `zustand`. Create `src/store/game.ts` with state: `board`, `selection`, `notesMode`, `mistakes`, `timer` (startTs, accumulatedMs, paused). Actions: `newGame(variant, difficulty)`, `select(pos)`, `placeDigit(d)`, `toggleNote(d)`, `erase()`, `toggleNotesMode()`, `pause()`, `resume()`. No persistence yet. Tests for `placeDigit` auto-removing pencil marks from peers and incrementing mistakes on conflict.
- **Verification**: `npx vitest run src/store/game.test.ts` passes.

### TASK-022: Store — stats slice with persistence
- **Status**: done
- **Dependencies**: TASK-021
- **Description**: Create `src/store/stats.ts` tracking per-`(variant, difficulty)`: games completed, best time, streak (current/longest, tracked via last-played date), average solve time, total mistakes. Use Zustand `persist` middleware writing to `localStorage` under key `sudoku.stats.v1`. Action `recordCompletion({variant, difficulty, timeMs, mistakes})`. Tests: best time updates only when faster; streak increments on consecutive days and resets on gap.
- **Verification**: `npx vitest run src/store/stats.test.ts` passes.

### TASK-023: Store — settings slice with persistence
- **Status**: done
- **Dependencies**: TASK-021
- **Description**: Create `src/store/settings.ts` with `theme: 'light' | 'dark' | 'notepad' | 'space'` and `followSystem: boolean`. Zustand `persist` middleware, key `sudoku.settings.v1`. Action `setTheme(theme)` turns off follow-system; `setFollowSystem(true)` recomputes theme from `matchMedia('(prefers-color-scheme: dark)')`. Tests for each behavior.
- **Verification**: `npx vitest run src/store/settings.test.ts` passes.

### TASK-024: Store — save-game persistence (one per variant)
- **Status**: done
- **Dependencies**: TASK-022
- **Description**: Extend the game store with persistence of in-progress games keyed by variant under `sudoku.save.v1`. On `newGame` for a variant, overwrite that variant's save. On completion, clear the save. Expose `hasSavedGame(variant)` and `resumeSavedGame(variant)`. Include a schema `version` field; on mismatch, discard the save. Tests for save/resume/clear and version-mismatch discard.
- **Verification**: `npx vitest run src/store/save.test.ts` passes.

### TASK-025: Theme system — base infrastructure + light/dark
- **Status**: done
- **Dependencies**: TASK-002, TASK-023
- **Description**: Create `src/themes/index.ts` registering theme definitions (CSS custom property maps). Create `src/themes/light.css` and `src/themes/dark.css` using `[data-theme="light"]` / `[data-theme="dark"]` selectors setting variables like `--bg`, `--fg`, `--cell-bg`, `--cell-given`, `--cell-selected`, `--cell-peer`, `--cell-conflict`, `--border`, `--accent`. Import themes in `main.tsx`. Create `src/themes/ThemeProvider.tsx` (or a small hook) that applies `data-theme` on `<html>` from the settings store, listening to system changes when follow-system is on. Test via component test that theme attribute updates.
- **Verification**: `npx vitest run src/themes/ThemeProvider.test.tsx` passes.

### TASK-026: Themes — Notepad and Space
- **Status**: done
- **Dependencies**: TASK-025
- **Description**: Add `src/themes/notepad.css` (paper/graphite aesthetic: warm off-white bg, pencil-grey player ink, inked black given clues, ruled-paper accent) and `src/themes/space.css` (deep indigo bg, luminous digits, subtle starfield accent via radial gradient). Register both in the theme registry. Add a visual smoke test that each theme sets the `data-theme` attribute correctly.
- **Verification**: `npx vitest run src/themes/ThemeProvider.test.tsx` passes (same test file, extended with new theme cases).

### TASK-027: Component — Board renderer
- **Status**: done
- **Dependencies**: TASK-021, TASK-025
- **Description**: Create `src/components/Board.tsx` rendering an N×N grid parameterized by variant. Uses thicker borders at box boundaries. Reads current board + selection from the game store and emits `onSelectCell(pos)`. Include `data-testid="sudoku-board"` and per-cell `data-testid="cell-r{row}-c{col}"`. Snapshot/render test renders a Classic empty board with 81 cells.
- **Verification**: `npx vitest run src/components/Board.test.tsx` passes.

### TASK-028: Component — Cell
- **Status**: done
- **Dependencies**: TASK-027
- **Description**: Create `src/components/Cell.tsx` rendering digit (or pencil-marks grid when empty), with styling for given, selected, peer-highlighted, same-digit-highlighted, and conflict states driven by props. Test: renders digit, renders 1-9 pencil marks when empty, applies conflict class when `isConflict` is true.
- **Verification**: `npx vitest run src/components/Cell.test.tsx` passes.

### TASK-029: Component — Number pad
- **Status**: done
- **Dependencies**: TASK-021
- **Description**: Create `src/components/NumberPad.tsx` rendering 1..N digit buttons (N from active variant), an Erase button, and a Notes toggle. Clicking a digit calls `placeDigit` or `toggleNote` based on `notesMode`. `data-testid="pad-digit-{n}"`, `data-testid="pad-erase"`, `data-testid="pad-notes"`. Test: clicking digit dispatches correct store action.
- **Verification**: `npx vitest run src/components/NumberPad.test.tsx` passes.

### TASK-030: Component — Keyboard input handler
- **Status**: done
- **Dependencies**: TASK-029
- **Description**: Create `src/components/KeyboardHandler.tsx` (renders nothing; attaches window listeners). Maps: arrows → move selection, 1-N → placeDigit or toggleNote, `N` → toggle notes mode, Backspace/Delete → erase, Escape → deselect, Space → pause/resume. Test with `userEvent` firing keys and asserting store actions.
- **Verification**: `npx vitest run src/components/KeyboardHandler.test.tsx` passes.

### TASK-031: Component — Timer with visibility auto-pause
- **Status**: done
- **Dependencies**: TASK-021
- **Description**: Create `src/components/Timer.tsx` showing elapsed time computed from store timestamps (not interval counters) and a pause/resume button. Subscribe to `document.visibilitychange`: pause on hidden, resume on visible (unless manually paused). Test: fire visibilitychange events and assert paused state; assert manual pause overrides visibility resume.
- **Verification**: `npx vitest run src/components/Timer.test.tsx` passes.

### TASK-032: Component — Hint
- **Status**: pending
- **Dependencies**: TASK-017, TASK-027
- **Description**: Create `src/components/Hint.tsx` with a button that calls `nextStep(board)` and, on result, highlights the relevant cell(s) and shows the technique name + explanation in a small panel. Does not fill the digit. Shows a friendly "no available hint" message when `nextStep` returns null. Test: button click surfaces the hint panel with expected text for a naked-single fixture.
- **Verification**: `npx vitest run src/components/Hint.test.tsx` passes.

### TASK-033: Screen — Home
- **Status**: done
- **Dependencies**: TASK-023, TASK-024
- **Description**: Create `src/screens/Home.tsx`: variant picker (Classic / Mini / Six), difficulty picker (Easy / Medium / Hard / Expert), a "New Game" button, and a "Resume" card per variant that has a saved game (showing difficulty and elapsed time). Clicking Resume loads that save into the game store. Clicking New Game with an existing save in that variant prompts a confirm.
- **Verification**: `npx vitest run src/screens/Home.test.tsx` passes.

### TASK-034: Screen — Game layout
- **Status**: pending
- **Dependencies**: TASK-027, TASK-029, TASK-030, TASK-031, TASK-032
- **Description**: Create `src/screens/Game.tsx` composing Board, NumberPad, Timer, Hint, KeyboardHandler, and a back-to-home button. Mobile-first layout (board above pad, constrained on desktop). Smoke test renders without crashing when a game is active.
- **Verification**: `npx vitest run src/screens/Game.test.tsx` passes.

### TASK-035: Screen — Stats
- **Status**: done
- **Dependencies**: TASK-022
- **Description**: Create `src/screens/Stats.tsx` showing a table per variant with columns for each difficulty and rows for each stat (games, best time, streaks, average, mistakes). Reads from stats store. Includes a Reset button with a confirm step that clears stats.
- **Verification**: `npx vitest run src/screens/Stats.test.tsx` passes.

### TASK-036: Screen — Settings
- **Status**: done
- **Dependencies**: TASK-025, TASK-026
- **Description**: Create `src/screens/Settings.tsx` with a theme selector (Light / Dark / Notepad / Space) and a "Follow system" toggle. Wires to the settings store. Test: selecting a non-auto theme clears follow-system; toggling follow-system picks the system theme.
- **Verification**: `npx vitest run src/screens/Settings.test.tsx` passes.

### TASK-037: Win modal + stats recording
- **Status**: pending
- **Dependencies**: TASK-022, TASK-034
- **Description**: Create `src/components/WinModal.tsx` that opens when `isComplete(board)` becomes true, showing final time and mistakes and offering "New Game" / "Home". On mount, calls `stats.recordCompletion` and clears the in-progress save for that variant. Test: simulate completion, assert recordCompletion invoked once and save cleared.
- **Verification**: `npx vitest run src/components/WinModal.test.tsx` passes.

### TASK-038: Routing / navigation
- **Status**: pending
- **Dependencies**: TASK-033, TASK-034, TASK-035, TASK-036
- **Description**: Wire top-level navigation between Home, Game, Stats, Settings. Either a tiny router (e.g. `react-router-dom`) or a hash-based screen switcher — choose the smaller option. Add a persistent bottom tab bar on mobile for Home/Stats/Settings; the Game screen is its own full-screen view.
- **Verification**: `npm run build` completes without errors and navigation smoke test `npx vitest run src/App.test.tsx` passes.

### TASK-039: PWA icons and manifest polish
- **Status**: done
- **Dependencies**: TASK-005
- **Description**: Replace placeholder icons with simple but distinct Sudoku-themed SVG/PNG icons sized 192, 512, and maskable 512. Update the manifest name, short_name, description, theme_color to match a base theme. Add `apple-touch-icon` and iOS meta tags.
- **Verification**: `npm run build` completes and `dist/manifest.webmanifest` contains the final name plus 192 and 512 icon entries.

### TASK-040: Mobile viewport and safe-area insets
- **Status**: done
- **Dependencies**: TASK-002
- **Description**: In `index.html`, add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`. In CSS, use `env(safe-area-inset-*)` padding on the main layout container. Verify Tailwind classes don't conflict.
- **Verification**: `npm run build` completes and the built `index.html` contains the viewport-fit meta tag.

### TASK-041: Offline precache configuration
- **Status**: pending
- **Dependencies**: TASK-005, TASK-038
- **Description**: Extend the `vite-plugin-pwa` config with Workbox `globPatterns` covering JS, CSS, HTML, and fonts, and a navigation fallback to `index.html`. Build and inspect the generated service worker to confirm the app shell is precached.
- **Verification**: `npm run build` completes and `dist/sw.js` contains references to the precache manifest (grep for `precacheAndRoute` or equivalent).

### TASK-042: E2E — new game → place digits → win
- **Status**: pending
- **Dependencies**: TASK-034, TASK-037
- **Description**: Add `tests/e2e/new-game.spec.ts`. Seed the game store (via an exposed test hook or by navigating through UI) with a solvable near-complete puzzle, then use the number pad to place the final digits and assert the win modal appears with a non-zero time. Use `data-testid` selectors introduced in earlier tasks.
- **Verification**: `npx playwright test tests/e2e/new-game.spec.ts` passes.

### TASK-043: E2E — pencil marks, auto-removal, mistake highlighting
- **Status**: pending
- **Dependencies**: TASK-042
- **Description**: Add `tests/e2e/notes-and-conflicts.spec.ts`. Toggle notes mode, add pencil marks, place a digit in a peer and assert that digit is removed from peers' notes. Place a conflicting digit and assert the conflict class is applied to both cells.
- **Verification**: `npx playwright test tests/e2e/notes-and-conflicts.spec.ts` passes.

### TASK-044: E2E — pause, resume, visibility auto-pause
- **Status**: pending
- **Dependencies**: TASK-042
- **Description**: Add `tests/e2e/timer.spec.ts`. Verify the timer advances, manual pause stops it and hides the board, resume restores the board, and simulating `visibilitychange` via `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` with `document.hidden = true` pauses it.
- **Verification**: `npx playwright test tests/e2e/timer.spec.ts` passes.

### TASK-045: E2E — resume saved game after reload
- **Status**: done
- **Dependencies**: TASK-024, TASK-033
- **Description**: Add `tests/e2e/resume.spec.ts`. Start a new Classic game, place a few digits, reload the page, confirm a Resume card appears on Home with the correct variant, click it, and assert the board state is restored.
- **Verification**: `npx playwright test tests/e2e/resume.spec.ts` passes.

### TASK-046: E2E — theme switch persists
- **Status**: pending
- **Dependencies**: TASK-036
- **Description**: Add `tests/e2e/theme.spec.ts`. Navigate to Settings, select Notepad, assert `document.documentElement` has `data-theme="notepad"`. Reload the page and assert the attribute is still `notepad`.
- **Verification**: `npx playwright test tests/e2e/theme.spec.ts` passes.
