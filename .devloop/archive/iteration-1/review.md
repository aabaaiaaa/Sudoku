# Sudoku PWA — Final Code Review

Reviewer: Claude (Opus 4.7, 1M context)
Date: 2026-04-16
Scope: requirements.md §1-14, tasks.md TASK-001 through TASK-046

---

## 1. Requirements vs Implementation

### Coverage matrix

| Requirement section | Status | Notes |
|---|---|---|
| §4 Variants (Classic/Mini/Six) | Met | `src/engine/variants/*` registered and consumed by engine/UI |
| §5 Difficulty tiers + rating | Met | `src/engine/generator/rate.ts`, `generate-for-difficulty.ts` |
| §6.1 Selection + peer highlight + auto-note-removal | Met | `src/store/game.ts:202-211` removes digit from peer notes on placement |
| §6.2 Keyboard (arrows, 1-N, N, Backspace, Escape, Space) | Met | `src/components/KeyboardHandler.tsx` |
| §6.3 Advisory mistake highlight (non-blocking) | Met | Conflicts increment counter but don't block; confirmed by tests |
| §6.4 Hints that name technique + highlight without filling | Met | `src/components/Hint.tsx` uses `nextStep(board)` |
| §6.5 Timer from timestamps + visibilitychange auto-pause | Met | `src/components/Timer.tsx`, `src/store/game.ts` (startTs/accumulatedMs) |
| §6.6 Win modal with time/mistakes + stats update | Met | `src/components/WinModal.tsx` |
| §7.1 One save per variant + schema version + corruption fallback | Met | `src/store/save.ts` |
| §7.2 Stats per variant × difficulty | Met | `src/store/stats.ts` |
| §7.3 Theme + follow-system | Met | `src/store/settings.ts`, `src/themes/ThemeProvider.tsx` |
| §8 Four themes, CSS-var driven | Met | `src/themes/{light,dark,notepad,space}.css` |
| §9 PWA manifest + SW + safe-area + viewport-fit | Met | `vite.config.ts`, `index.html`, `dist/sw.js`, `public/icon-*` |
| §10 Stack (Vite/React/TS/Tailwind/Zustand/Vitest/Playwright) | Met | `package.json`, config files |
| §11 Folder layout | Met (engine is pure TS, no React imports) | |
| §12 Edge cases | Partially met — see Code Quality below |
| §13 Testing strategy (unit + E2E) | Partially met — gaps below |
| §14 Success criteria | Met on paper; gaps in offline/hint/stats E2E |

### Gaps / partial implementations

- **Offline E2E (§9, §14):** SW is configured but no E2E navigates while offline to confirm the app shell actually loads from cache. `tests/e2e/smoke.spec.ts` only checks first-load.
- **Hint E2E (§6.4, §14):** `Hint.tsx` has unit tests but no E2E exercises the Hint button flow, so the "technique name visible in panel" success criterion is only unit-verified.
- **Stats E2E (§7.2, §14):** Stats screen and reset button have unit tests; no E2E navigates to `#/stats`, asserts values after a completion, or exercises reset-with-confirm.
- **Serialization is 1-9-only (§4 extensibility):** `src/engine/board.ts:12-22` hardcodes `digitToChar`/`charToDigit` for 1-9. Current variants all fit; but the requirements explicitly call out extensibility and cage overlays later. A future variant with digits beyond 9 would silently corrupt saves. Not blocking v1, but not parameterized.
- **Rate loop has no iteration cap (§12 "generator hangs"):** `src/engine/generator/rate.ts` (~L526) is `while (true)` — if a technique reports progress but the board isn't actually advancing, it loops forever. Generator has retry cap; rater doesn't.

### Scope creep

None observed. No auth, networking, ads, or features beyond the requirements. Killer is absent as specified.

---

## 2. Code Quality

### Bugs / logic errors

1. **localStorage quota errors silently lost (high).** `src/store/save.ts:79` calls `setItem` unwrapped; `src/store/stats.ts:64` and `src/store/settings.ts:51` use Zustand `persist` without a custom storage adapter. `saveCurrent()` is called on every move (`src/store/game.ts:217,237,253`). On a full quota, writes fail silently — the player keeps playing but their save is not persisted. §12 mentions corrupted storage but not quota; this should still fail loudly.

2. **ThemeProvider follow-system effect thrashes (low-medium).** `src/themes/ThemeProvider.tsx:22` depends on `[followSystem, setFollowSystem]`. The media-query handler calls `setFollowSystem(true)`, which re-renders and re-subscribes the listener. End behavior is correct, but the subscription churns on every system change.

3. **Timer `manualPausedRef` drift (medium).** `src/components/Timer.tsx:26` seeds `manualPausedRef` from initial `timer.paused` only. After `resumeSavedGame`, the ref can be stale relative to the store, so the visibility-driven resume may ignore a genuinely manual pause or vice-versa. Sync the ref in an effect when `timer.paused` changes.

4. **Digit range check loose (low).** `src/components/KeyboardHandler.tsx:79` uses `Number(key)` with a `1..size` range check rather than `variant.digits.includes(digit)`. Fine for Classic/Mini/Six (contiguous), but contradicts the "parameterized over variant" requirement.

5. **`findConflicts` short-circuit after first peer (low).** `src/engine/board.ts` breaks after the first conflicting peer per cell; tests codify this behaviour. Correctness is preserved because every conflicting cell appears in the output (the peer flags itself from its own side), but the code reads as if it may under-report — worth a comment, or simplify to "cell is conflicted if any peer shares its value".

6. **Rate solver has no contradiction detection (medium).** `rate.ts` relies on "no technique matched" to exit, and labels the result Expert. A board in an impossible state (candidate list empties before completion) should be flagged as invalid, not rated.

7. **Generator doesn't re-verify final puzzle (low).** `src/engine/generator/generate.ts` builds the puzzle by removing cells while `countSolutions === 1`; the final puzzle is never re-validated. In practice the invariant holds, but an assertion would catch regressions.

### Error handling

- **Good:** save schema version check with discard (`src/store/save.ts`), JSON parse guarded.
- **Weak:** no `try/catch` around any `localStorage.setItem`. No handling of `matchMedia` being undefined (older iOS PWAs can be odd in standalone mode). No handling for `visibilityState` unavailability.
- **Weak:** deserialize throws on bad chars but does not report which cell, making corruption hard to debug.

### Security

- No XSS vectors observed — all cell values are numeric, React auto-escapes.
- No external network calls; no user content rendered as HTML.
- Service worker scope is root with standard Workbox routes — nothing custom that could cache cross-origin requests.
- No concerns.

---

## 3. Testing

### Unit tests — strong

- Engine coverage is thorough: peers, board, backtracking, each technique, aggregator, generator, rater, `generateForDifficulty`.
- Stores cover the main behaviours (`placeDigit` peer-note clearing, conflict counting, stats streak rollover, settings follow-system).
- Components have render/interaction tests.

### Untested edge cases

- `src/store/save.ts` — no test for `localStorage.setItem` throwing (quota exceeded).
- `src/store/save.ts` — corruption test covers JSON parse failure; no test for structurally-valid-but-wrong-shape JSON (e.g., `board: null`).
- `src/store/settings.ts` — no test for `matchMedia` absent or throwing.
- `src/components/Timer.tsx` — `manualPausedRef` syncing after resume is not asserted.
- `src/engine/board.ts` — serialize/deserialize tested only on Classic; Mini and Six round-trips not exercised.
- `src/engine/board.ts` — malformed deserialize inputs (mismatched notes commas, non-binary in `givenStr`) not tested.
- `src/engine/generator/rate.ts` — no test for "impossible board" returning a sensible value.
- `src/engine/generator/generate-for-difficulty.ts` — no test for retry-cap exhaustion returning closest tier.

### E2E gaps

- No offline spec.
- No hint spec.
- No stats spec (including reset confirm flow).
- No spec exercising the "new game overwrites existing save" confirm prompt.

---

## 4. Recommendations (before production)

Priority order:

1. **Wrap all `localStorage.setItem` in a storage adapter that catches quota/security errors** and surfaces a non-blocking toast or console warning. Apply to save, stats, settings.
2. **Sync `manualPausedRef` with store state** in `Timer.tsx` via a `useEffect` on `timer.paused`, so resume-from-save behaves predictably.
3. **Add an iteration cap to `rate.ts`'s main loop** (e.g., `variant.size * variant.size + 1`) and return a sentinel on cap exhaustion so generation can retry.
4. **Add the three missing E2E specs** — offline, hint, stats — since those are the explicit success-criteria items not covered by unit tests.
5. **Tighten keyboard digit validation** to use `variant.digits.includes(...)` for consistency with the variant-parameterized design.
6. **Fix the ThemeProvider effect deps** so the listener isn't re-subscribed on every system change.
7. **Extend serialize round-trip tests** to cover Mini and Six, and add one negative test per malformed-input path.
8. **Improve deserialize error messages** to include cell coordinates for forensic debugging of corrupted saves.

---

## 5. Future Considerations

### Features that fit naturally next

- **Undo/redo** stack on the game store — the requirements don't ask for it, but a move history ring is cheap and a common expectation.
- **Auto-candidate (pencil-mark assist) toggle** — fill all legal candidates once, and/or auto-remove candidates on conflict as well as placement.
- **Colour/marker layer** for advanced players (separate from pencil marks).
- **Daily puzzle** — deterministic seed per date; still fully client-side.
- **Export/import save** (copy-to-clipboard of the serialized form) so players migrating between devices have a manual escape hatch in the absence of cloud sync.
- **Killer Sudoku** — the engine was explicitly designed not to preclude cage overlays; the solver will need sum-constraint techniques.

### Architectural decisions to revisit

- **Engine serialization format.** The 1-9 hardcode in `digitToChar`/`charToDigit` is the single largest impediment to adding variants with digits outside that range (Sudoku-16, letter-based Sudoku). Worth rewriting as variant-aware (`variant.digits.indexOf`) before the format is locked in by a large installed base of saves.
- **Candidate-grid in technique solver API.** `nextStep` recomputes candidates from scratch each call, so elimination-only techniques (naked pairs, pointing pairs, X-wing) "forget" their work between calls. For hint UX it's fine (user places one digit and asks again), but if the project ever wants an "explain the whole solve path" view, the rater's stateful approach should be hoisted into the public API.
- **Zustand persist vs. bespoke save slice.** `save.ts` is already a bespoke slice; stats/settings use the middleware. Mixed strategies make error-handling inconsistent. Consider a single shared storage layer.
- **Routing.** The hash-based switcher is appropriate for v1's four screens, but if modals-as-routes, deep links to stats, or share URLs become requirements, migrate to `react-router-dom` early before every screen grows ad-hoc guards.

### Technical debt introduced

- **Hardcoded digit charset** in serialization (see above) — #1 debt.
- **Silent localStorage write failures** — #2 debt; easy to fix but currently invisible until a user hits it.
- **No instrumentation / telemetry** — acceptable given the no-backend constraint, but once the user wants to know "how often do hints appear with no technique available" or "what's the p95 generator time on Expert", there's nothing to read.
- **Rate loop without guard** — a latent hang that won't appear in CI but could surface with a future technique bug.
- **Timer ref drift** — minor but user-visible if hit.
- **No lint/format config visible in repo root** — if ESLint and Prettier are implicit via Vite's defaults, a checked-in config with a `lint` script would prevent style drift as the project grows.

Overall: the project meets the spec and is close to shippable. The blocking work is small (quota handling + two timer/theme bugs + three E2E specs); the rest is polish and forward-planning.
