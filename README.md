# Sudoku PWA

A mobile-friendly, installable Sudoku game that runs entirely in the browser.
Three grid variants, four difficulty levels, four themes, and full offline
support via a service worker.

No backend, no accounts, no network dependency during gameplay — puzzles,
progress, stats, and settings all live in `localStorage`.

## Features

- **Three variants:** Classic 9×9, Mini 4×4, and Six 6×6.
- **Four difficulties:** Easy, Medium, Hard, Expert — rated by the hardest
  solving technique required (no guessing needed for any puzzle).
- **Technique-aware hints:** the Hint button names the next logical step
  (naked single, hidden single, naked pair/triple, pointing pair, box/line
  reduction, X-wing) and highlights the relevant cells without filling in
  the answer.
- **Auto-pencil-mark cleanup:** placing a digit removes it from every peer
  cell's notes.
- **Mistake highlighting:** conflicts are flagged but never blocked; mistake
  count is tracked for stats only.
- **Timer with smart pause:** manual pause hides the board; auto-pauses when
  the tab is hidden and resumes on focus. Elapsed time is computed from
  timestamps so it's immune to interval drift during long pauses.
- **One saved game per variant:** resume cards on the home screen show
  difficulty and elapsed time; clicking resumes exactly where you left off.
- **Per-variant × difficulty stats:** games completed, best time, current /
  longest streak, average solve time, total mistakes.
- **Four themes:** Light, Dark, Notepad (paper/graphite), and Space
  (cosmic). Plus a "Follow system" toggle for Light ↔ Dark.
- **Installable PWA:** works offline after first load on iOS Safari, Chrome
  on Android, and desktop Chrome.
- **Keyboard-first on desktop:** arrow keys to move, 1–N to place, `N` to
  toggle notes, Backspace/Delete to erase, Space to pause, Escape to
  deselect.

## Stack

- TypeScript + React 18
- Vite, with `vite-plugin-pwa` for the service worker and manifest
- Tailwind CSS, themes via CSS custom properties
- Zustand for state, with `persist` middleware writing to `localStorage`
- Vitest for unit tests, Playwright for end-to-end tests

The game engine (types, peer computation, backtracking solver, technique
solver, generator, difficulty rater) is pure TypeScript with no React
dependency — it lives under `src/engine/` and is fully unit-tested and
reused across variants.

## Getting started

```bash
npm install
npm run dev           # Vite dev server
```

Open the URL printed by Vite (default `http://localhost:5179/Sudoku/`).

## Scripts

| Script           | What it does                                      |
|------------------|---------------------------------------------------|
| `npm run dev`    | Start the Vite dev server with HMR                |
| `npm run build`  | Type-check (`tsc -b`) and produce `dist/`         |
| `npm run preview`| Serve the built `dist/` locally (for PWA testing) |
| `npm test`       | Run the Vitest unit suite                         |
| `npx playwright test` | Run the Playwright E2E suite                 |

## Project structure

```
src/
  engine/             # pure TS puzzle logic (no React)
    types.ts          # Cell, Board, Variant, Move, Position
    variants/         # classic, mini, six — registered in index.ts
    peers.ts          # row/col/box peer sets
    board.ts          # board utilities, serialize, findConflicts
    solver/
      backtracking.ts # solve + countSolutions (uniqueness check)
      techniques/     # naked single, hidden single, subsets, ...
    generator/        # puzzle generation + difficulty rating
  store/              # Zustand: game, stats, settings, save
  components/         # Board, Cell, NumberPad, Timer, Hint, WinModal, ...
  screens/            # Home, Game, Stats, Settings
  themes/             # light/dark/notepad/space + ThemeProvider
  App.tsx, main.tsx
tests/
  e2e/                # Playwright specs
```

## Testing

Unit tests live next to the file under test (`foo.ts` + `foo.test.ts`).
E2E specs live under `tests/e2e/`.

```bash
npm test                                  # all unit tests
npx vitest run src/engine/solver          # a subset
npx playwright test                       # all E2E
npx playwright test tests/e2e/theme.spec.ts
```

## Themes

Themes are sets of CSS custom properties scoped under a `[data-theme="…"]`
selector. Adding a new theme is a matter of:

1. Create `src/themes/mytheme.css` with a `[data-theme="mytheme"] { … }`
   block defining `--bg`, `--fg`, `--cell-bg`, `--cell-given`,
   `--cell-selected`, `--cell-peer`, `--cell-conflict`, `--border`, and
   `--accent`.
2. Import it from `src/main.tsx`.
3. Register it in `src/themes/index.ts` and add it to the Settings picker.

No component changes required — all surfaces consume the CSS variables.

## Deployment

Pushes to `master` build and publish the app to GitHub Pages via
`.github/workflows/deploy.yml`. The workflow runs unit tests, builds
`dist/`, and uses `actions/deploy-pages` to publish.

One-time setup: **Repository Settings → Pages → Source: "GitHub Actions"**.

Vite is configured with `base: '/Sudoku/'` so asset URLs resolve under the
project-pages URL `https://<user>.github.io/Sudoku/`. If you fork to a
repo with a different name, update `base` in `vite.config.ts` and the PWA
`scope`/`start_url` to match.

To test a production build locally before pushing:

```bash
npm run build
npm run preview
# then open http://localhost:5179/Sudoku/
```
