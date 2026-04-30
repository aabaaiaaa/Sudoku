# Sudoku PWA — Iteration 7 Requirements: collapse the difficulty ladder to six tiers

This iteration is driven by the iteration-6 corrected baseline plus the
recurring observation surfaced during iteration-7 discovery: classic
puzzles never land in `Hard` or `Master`, six puzzles never land in
anything above `Medium`, and mini puzzles never land above `Easy`.
The iteration-6 review section §5.2 (`Player-facing tier coverage`)
called this out and the corrected baseline data
(`scripts/tier-distribution.summary.json`) confirms it: every
`solvedRate` for `classic:Hard`, `classic:Master`, every `six:Hard+`,
and every `mini:Medium+` cell is exactly zero over a sample of 20.

The empirical reason is structural: the rater categorizes a puzzle
by the *maximum* technique tier required in its solving chain. The
techniques tagged `Hard` (`pointing`, `box-line-reduction`) and the
techniques tagged `Master` (`x-wing`, `swordfish`, `jellyfish`)
co-occur in real puzzles with techniques one tier higher
(subsets and wings respectively). So a puzzle whose hardest *named*
technique is `pointing` always also requires a subset, which kicks
its rated tier to `Expert`. The "Hard" and "Master" bands of the
ladder are statistically empty.

Iteration 7 collapses the eight-tier `DIFFICULTY_ORDER` down to six
tiers (`Easy / Medium / Hard / Expert / Master / Nightmare`), remaps
the technique-to-tier table so the new ramp is reachable end-to-end,
re-profiles the corrected baseline at `n=50` (up from `n=20`) for
sharper rate estimates, and re-pins the per-tier attempt and timeout
budgets against the new evidence. Persisted v3 saves and stats are
discarded via the existing legacy-cleanup prompt path; users see one
"Old saves detected" prompt on first launch of v0.6.0.

Iteration 7 also folds in three deferred cleanups from the
iteration-6 review:

- §5.1 `slotKey` asymmetry between `save.ts` and `stats.ts` (small,
  dormant-but-fixable).
- §5.4 parallel `MAX_ATTEMPTS_BY_TIER` / `TIMEOUT_MS_BY_TIER` tables
  consolidated into one record.
- A retuned `DifficultyBadge` colour ramp matching the new six-tier
  ladder rather than dropping two slots out of the existing
  eight-colour palette.

The v0.5.0 baseline is unchanged except where called out below.
Iteration 6's requirements, tasks, progress, and review are archived
at `.devloop/archive/iteration-5/` (note: the archive directory
naming is offset by one from the iteration content; the archive
created during DevLoop's commit step for iteration 7 will be
`iteration-6/`).

## 1. Motivation

The iteration-6 corrected baseline (committed 2026-04-29 with the
`solvedRate` methodology fix) gave us empirical proof that two of
the eight rated tiers are unreachable on the classic 9×9:

| Cell                | rate | solvedRate | Sample |
| ------------------- | ---- | ---------- | ------ |
| classic:Easy        | 0.90 | 0.90       | 20     |
| classic:Medium      | 0.55 | 0.55       | 20     |
| **classic:Hard**    | 0.00 | 0.00       | 20     |
| classic:Expert      | 0.20 | 0.20       | 20     |
| **classic:Master**  | 0.00 | 0.00       | 20     |
| classic:Diabolical  | 0.20 | 0.15       | 20     |
| classic:Demonic     | 0.20 | 0.05       | 20     |
| classic:Nightmare   | 0.10 | 0.10       | 20     |

The structural cause is the technique-to-tier table at
`src/engine/generator/rate.ts:64-99`. Every technique is mapped to
exactly one tier, and a puzzle's tier is the maximum over the
techniques required to solve it. The two empty tiers contain
techniques that always co-occur with techniques one band higher in
real puzzles:

- **Hard** (`pointing`, `box-line-reduction`) — these "intersection"
  techniques almost never appear without an accompanying naked or
  hidden subset somewhere in the solving path. The subset bumps
  the rating to Expert.
- **Master** (`x-wing`, `swordfish`, `jellyfish`) — these "fish"
  techniques almost never appear without an accompanying wing or
  coloring somewhere in the solving path. The wing bumps the rating
  to Diabolical.

The iteration-6 lever-2 sweep at lower clue floors confirmed this is
not a clue-count problem: every tested floor for `six:Hard+` and
`mini:Medium+` returned `solvedRate=0` as well. The structural cause
is intrinsic to the technique chain, not the generator's clue budget.

The least-invasive structural fix is to **collapse the empty tiers**:
fold `Hard`'s technique members into `Expert` (the next tier up) and
fold `Master`'s technique members into `Diabolical`, then rename the
resulting six tiers to `Easy / Medium / Hard / Expert / Master /
Nightmare` for a cleaner player-facing ramp. Under this collapse,
no actually-occurring puzzle is reclassified — only the labels move.

This iteration's headline deliverable is that collapse, re-profiled
at `n=50` (up from iteration-6's `n=20`) for tighter confidence
intervals on every advertised tier's `solvedRate`.

## 2. Goals

- Collapse `Difficulty` from eight tiers to six. The new
  `DIFFICULTY_ORDER` is `['Easy', 'Medium', 'Hard', 'Expert',
  'Master', 'Nightmare']`.
- Remap `TECHNIQUE_TIER` so the new ramp is empirically reachable —
  every advertised tier on every variant has at least one puzzle
  the rater can produce.
- Re-profile via `npm run profile-tiers -- --all-tiers --n=50` and
  commit the iteration-7 corrected baseline. Use it as the source
  of truth for tier budgets, fixtures, and variant tier lists.
- Re-pin `MAX_ATTEMPTS_BY_TIER` and `TIMEOUT_MS_BY_TIER` against the
  iteration-7 baseline using the §6 reliability formula (carried
  from iteration 6 unchanged).
- Bump persistence schemas (`save` v3 → v4, `stats` v3 → v4) and
  extend the existing legacy-cleanup pattern in
  `src/store/migration.ts` to detect v3 keys. Users on first launch
  of v0.6.0 see one "Old saves detected — remove?" prompt and click
  through; no in-app rewrite logic.
- Update the `DifficultyBadge` colour ramp to a clean six-tier
  palette rather than the current eight-tier ramp with two unused
  slots.
- Close §5.1 from the iteration-6 review: `stats.ts:entryKey` now
  lowercases the difficulty before composing the entry key,
  matching `save.ts:slotKey`.
- Close §5.4 from the iteration-6 review: merge
  `MAX_ATTEMPTS_BY_TIER` and `TIMEOUT_MS_BY_TIER` into a single
  `Record<Difficulty, { maxAttempts: number; timeoutMs: number }>`
  named `TIER_BUDGETS`, keeping `defaultMaxAttemptsForTier` as a
  thin wrapper for the existing public surface.
- Close review G1: add `TIER_FIXTURES` entries for `six:Easy` and
  `mini:Easy` from the iteration-7 baseline so the docblock claim
  "one fixture per advertised cell" holds.
- Bump `package.json` to `0.6.0` (minor — player-visible ramp
  change, save data discarded).

## 3. Non-goals

- **No rater changes.** The rater chain, the candidate-grid logic
  in `rate.ts`, and the tier-aware finder in
  `src/engine/solver/techniques/index.ts` are untouched. The 34
  technique implementations are unchanged. We are only moving the
  tier label assigned to each technique.
- **No new techniques, variants, or generator behaviour.**
- **No save-data rewrite migration.** Persisted v3 saves and stats
  are deleted via the existing migration prompt; users see one
  prompt and lose any in-progress puzzle, but the player's stats
  history at advertised tiers (`easy`, `medium`, `nightmare`) is
  also dropped. This is the explicit user choice; the trade-off
  was discussed during iteration-7 discovery. No save-rewrite logic
  is added to `migration.ts`.
- **No rater extension for small grids.** The iteration-6 review
  §5.2 path 2 (give 4×4/6×6 their own per-variant tier
  discriminators so mini gets Medium/Hard and six gets Hard+) is
  deferred to iteration 8. After iteration 7 the `six` variant
  advertises `[Easy, Medium]` and `mini` advertises `[Easy]` only —
  exactly as today. This iteration is purely about collapsing the
  empty bands on the existing ladder.
- **No `useUpdate.checkForUpdates` resolution-timing race fix.**
  Carried.
- **No candidate-grid duplication cleanup in `rate.ts`.** Multi-
  iteration; deferred since iteration 3.
- **No `__APP_VERSION__` ambient typing fix.** Minor; deferred.
- **No `availableTiers` / `CLUE_BOUNDS` unification.** Deferred from
  iteration-6 review §5.1; the iteration-7 work touches both
  tables but does not merge them. A separate iteration with the
  consolidation as its headline goal would be cleaner.
- **No CI E2E runs.** Local pre-push gate only.

## 4. New `Difficulty` ladder

The new type, in `src/engine/generator/rate.ts`:

```ts
export type Difficulty =
  | 'Easy'
  | 'Medium'
  | 'Hard'
  | 'Expert'
  | 'Master'
  | 'Nightmare';

export const DIFFICULTY_ORDER: readonly Difficulty[] = [
  'Easy',
  'Medium',
  'Hard',
  'Expert',
  'Master',
  'Nightmare',
];
```

The `Diabolical` and `Demonic` literals are removed entirely; the
type system enforces the new ladder at compile time. Every consumer
of `Difficulty` (catalog, fixtures, budget tables, variant-tiers,
DifficultyBadge swatches, save and stats stores, screens) is
updated to match.

The `tierRank` helper is unchanged; its behaviour follows the new
order automatically.

### 4.1 Technique-to-tier remap

`TECHNIQUE_TIER` in `rate.ts` and `tier:` on each
`TECHNIQUE_CATALOG` entry in
`src/engine/solver/techniques/catalog.ts` are remapped together —
the catalog is the canonical source for the Learn page, the
`TECHNIQUE_TIER` map is the canonical source for the rater. Both
tables must agree.

| Tier      | Techniques                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Easy      | naked-single                                                                                                                          |
| Medium    | hidden-single                                                                                                                         |
| **Hard**  | pointing, box-line-reduction, naked-pair, naked-triple, naked-quad, hidden-pair, hidden-triple, hidden-quad                           |
| **Expert**| x-wing, swordfish, jellyfish, xy-wing, xyz-wing, w-wing, simple-coloring, x-cycle, empty-rectangle, skyscraper, two-string-kite       |
| **Master**| unique-rectangle, bug-plus-one, xy-chain, multi-coloring, als-xz, wxyz-wing, hidden-rectangle, avoidable-rectangle                    |
| Nightmare | nice-loop, grouped-x-cycle, 3d-medusa, death-blossom, forcing-chains                                                                  |

**Semantic shift:** the new `Hard` corresponds to the *old* `Expert`
band (subsets are the discriminator); the new `Expert` corresponds
to the *old* `Diabolical` band (fish + wings); the new `Master`
corresponds to the *old* `Demonic` band (chains + ALS). Players who
previously saw "Expert" in the picker for a given puzzle difficulty
will now see "Hard" for the same actual difficulty. This is the
intended user-facing rename — the player-visible ramp is now
monotonic in name and difficulty.

### 4.2 `CLUE_BOUNDS` rename

`CLUE_BOUNDS.classic` windows shift by rename:

```ts
classic: {
  Easy:      [38, 45],
  Medium:    [32, 37],
  Hard:      [24, 27],   // old Expert window
  Expert:    [24, 28],   // old Diabolical window
  Master:    [22, 26],   // old Demonic window
  Nightmare: [20, 24],
},
```

The old `Hard` window `[28, 31]` and `Master` window `[26, 31]` are
dropped — they were sized for tiers that empirically produced
nothing.

`CLUE_BOUNDS.six` is unchanged: `Easy [22, 26]`, `Medium [14, 21]`
(the iteration-6 lever-2-restored lower bound is preserved). Six's
`Hard+` entries are dropped.

`CLUE_BOUNDS.mini` keeps only `Easy [12, 14]`.

### 4.3 `VARIANT_TIERS` rewrite

```ts
const VARIANT_TIERS: Record<string, readonly Difficulty[]> = {
  classic: ['Easy', 'Medium', 'Hard', 'Expert', 'Master', 'Nightmare'],
  six: ['Easy', 'Medium'],
  mini: ['Easy'],
};
```

Classic gains all six advertised tiers (every tier in the new
ladder is reachable per the iteration-7 baseline §5). Six and Mini
keep their iteration-6-determined coverage exactly — iteration 7
does not extend the rater for small grids.

The `variant-tiers.ts` docblock is rewritten to cite the iteration-7
baseline and the iteration-6 lever-2 sweep that is still the basis
for the small-grid descopes. Iteration-6 sweep ranges remain in the
docblock so iteration 8 has the historical record.

## 5. Re-profile (iteration-7 corrected baseline)

Run `npm run profile-tiers -- --all-tiers --n=50`. The output
overwrites `scripts/tier-distribution.md` and
`scripts/tier-distribution.summary.json` and is committed as the
**iteration-7 corrected baseline**.

The sample size bumps from 20 (iteration-6) to **50** to halve the
confidence-interval width on small `solvedRate` cells. At
`solvedRate ≈ 0.05`, `n=20` gives a standard error of ~0.05; `n=50`
gives ~0.031 — a meaningful tightening for the formula-driven
budget calculation in §6 below.

The expected baseline (analytical equivalence with iteration-6 since
no actually-occurring puzzle is reclassified):

| Cell             | Predicted solvedRate | Predicted firstHit |
| ---------------- | -------------------- | ------------------ |
| classic:Easy     | ≈ 0.90               | seed 0             |
| classic:Medium   | ≈ 0.55               | seed near 102      |
| classic:Hard     | ≈ 0.20               | seed near 301      |
| classic:Expert   | ≈ 0.15               | seed near 504      |
| classic:Master   | ≈ 0.05               | seed near 612      |
| classic:Nightmare| ≈ 0.10               | seed near 703      |
| six:Easy         | ≈ 1.00               | seed 1000          |
| six:Medium       | ≈ 0.05               | seed 1102          |
| mini:Easy        | ≈ 1.00               | seed 2000          |

The actual baseline values from the `n=50` run are the source of
truth for §6, §7, and §8 below; the predictions above are sanity
checks only.

If any advertised cell in the iteration-7 baseline returns
`solvedRate < 0.05` it is descoped following the iteration-5/6
contingency rule: drop the tier from `VARIANT_TIERS`, file the
finding as iteration-8 scope, and ship without that advertised
tier. The strict-matrix E2E
(`tests/e2e/difficulty-matrix.spec.ts`) is the canonical guard.

The runtime budget for the `n=50 --all-tiers` sweep is significant
— roughly 18 advertised cells × 50 samples × variable per-attempt
cost (Easy ~ms, Master/Nightmare ~1–2s with average 10–20 attempts
per puzzle). Estimate one to two hours total. Per the user's
explicit direction during discovery, that runtime is acceptable in
exchange for the tighter rate estimates.

## 6. `TIER_BUDGETS` consolidation

`MAX_ATTEMPTS_BY_TIER` and `TIMEOUT_MS_BY_TIER` are merged into a
single record at
`src/engine/generator/generate-for-difficulty.ts`:

```ts
interface TierBudget {
  maxAttempts: number;
  timeoutMs: number;
}

export const TIER_BUDGETS: Record<Difficulty, TierBudget> = {
  Easy:      { maxAttempts:  50, timeoutMs: 150_000 },
  Medium:    { maxAttempts: 122, timeoutMs: 370_000 },
  Hard:      { maxAttempts:  50, timeoutMs: 150_000 },
  Expert:    { maxAttempts:  50, timeoutMs: 150_000 },
  Master:    { maxAttempts: 122, timeoutMs: 370_000 },
  Nightmare: { maxAttempts:  59, timeoutMs: 180_000 },
};
```

Values shown above are the iteration-6 budgets translated under the
rename; the **actual** iteration-7 values are recomputed against the
`n=50` baseline using the same reliability formula carried from
iteration 6:

```
maxAttempts = ceil(log(0.002) / log(1 - solvedRate))   // 99.8% reliability
timeoutMs   = max(60_000, maxAttempts × 2000ms × 1.5)
```

A floor of `50` attempts is kept for tiers whose formula `N` falls
below 50 (small-sample variance protection). The default
`60_000ms` timeout is kept for tiers whose attempt cap stays at the
default 50 *and* whose per-attempt cost is low (Easy is the only
realistic candidate).

The docblock above `TIER_BUDGETS` is rewritten to:

- Cite the iteration-7 corrected baseline by date.
- For each non-default budget, cite the (variant, tier, solvedRate)
  driver tuple.
- State explicitly that the `timeoutMs` rule applies whenever the
  attempt cap is widened above the default — clearing up the
  iteration-6 review G3 ambiguity.

The public exports `MAX_ATTEMPTS_BY_TIER`, `TIMEOUT_MS_BY_TIER`,
`DEFAULT_MAX_ATTEMPTS`, and `DEFAULT_TIMEOUT_MS` are removed.
`defaultMaxAttemptsForTier(d)` becomes a thin wrapper returning
`TIER_BUDGETS[d]?.maxAttempts ?? 50` (the existing one-line shim).
The internal call site in `generateForDifficulty` reads
`TIER_BUDGETS[difficulty]?.timeoutMs ?? 60_000` instead of looking
up two parallel records.

## 7. Tier fixtures

`src/engine/solver/techniques/tier-fixtures.ts` is rebuilt from the
iteration-7 baseline. Every advertised `(variant, tier)` cell gets
exactly one fixture, sourced from the cell's `firstHitSeed` and
`firstHitBoard` in `scripts/tier-distribution.summary.json`.

The full advertised set (9 cells) is:

```
classic:Easy, classic:Medium, classic:Hard, classic:Expert,
classic:Master, classic:Nightmare,
six:Easy, six:Medium,
mini:Easy
```

`six:Easy` and `mini:Easy` are new entries (closes review G1 — the
iteration-6 docblock claimed "one fixture per advertised cell" but
those two cells were missing).

The block-level comment at iteration-6's
`tier-fixtures.ts:64-66` (explaining that `six:Medium` came from
the lever-2 sweep) is preserved or rewritten as appropriate; the
six:Medium fixture's seed and board update if the iteration-7
baseline produces a different `firstHitSeed` for that cell at
clueFloor=14.

The file-level docblock cites the iteration-7 corrected baseline by
date and removes the iteration-6 reference to "Hard and Master are
omitted" (both now have fixtures).

`tier-fixtures.test.ts` is unchanged in structure but now
round-trips 9 fixtures instead of 7 (and the renamed entries); the
existing `expect(result.solved).toBe(true)` assertion at iteration-6
line 49 is preserved.

## 8. Persistence: v4 schemas, no rewrite migration

### 8.1 Save schema bump

`src/store/save.ts`:

```ts
export const SAVE_STORAGE_KEY = 'sudoku.save.v4';
export const SAVE_SCHEMA_VERSION = 4;
```

The internal payload shape (`SaveFile`, `SavedGame`, etc.) is
unchanged. Only the storage key and schema-version literal change.
Existing v3 entries become "old saves" automatically once §8.3 is
in place.

### 8.2 Stats schema bump

`src/store/stats.ts`:

```ts
export const STATS_STORAGE_KEY = 'sudoku.stats.v4';
export const STATS_SCHEMA_VERSION = 4;
```

The Zustand `persist` middleware automatically discards persisted
state whose version doesn't match — v3 stats are silently dropped
on first read. The `merge` callback at iteration-6
`stats.ts:143-150` is unchanged; it operates on the post-version-
check payload.

The hard-coded comment at iteration-6 `stats.ts:53-57`
("the new tier names ('master', 'diabolical', 'demonic',
'nightmare')") is rewritten to cite the iteration-7 ladder
(`'easy', 'medium', 'hard', 'expert', 'master', 'nightmare'`).

### 8.3 Migration regex extension

`src/store/migration.ts`:

```ts
const OLD_SAVE_KEY_PATTERN = /^sudoku\.(save|stats|settings)\.v[123]$/;
```

The regex changes from `[12]` to `[123]`. Existing UI in
`App.tsx:115-121` and `Settings.tsx:104-105, 254-256` — both of
which already render a `ConfirmDialog` gated on `hasOldSaves()` —
automatically pick up the v3 case without any component changes.
Users on first launch of v0.6.0 see the existing "Old saves
detected — remove?" prompt; clicking through wipes v1+v2+v3 entries
in one sweep.

The `migration.test.ts` v3-not-detected case at iteration-6
lines 28-33 inverts: v3 keys *are* now detected as legacy, and the
test is updated to assert that. A new "v4 keys are not detected"
case is added.

## 9. `slotKey` symmetry (review §5.1 close)

`src/store/save.ts:48`:

```ts
export function slotKey(variantId: string, difficulty: string): string {
  return `${variantId}:${difficulty.toLowerCase()}`;
}
```

`src/store/stats.ts:37`:

```ts
export function entryKey(variant: string, difficulty: string): string {
  return `${variant}:${difficulty.toLowerCase()}`;
}
```

The two helpers are now structurally identical. The dormant
asymmetry is gone; future callers passing a Title-Case difficulty
to either store get the same lower-cased slot in both. No call-site
behaviour changes today (every call already passes lowercase) but
the contract is now explicit.

`stats.test.ts` gains one targeted assertion that
`entryKey('classic', 'Hard') === 'classic:hard'`; `save.test.ts`
already has the equivalent for `slotKey`.

## 10. `DifficultyBadge` colour ramp retune

`src/components/DifficultyBadge.tsx`'s `TIER_SWATCH` table is
rewritten for the new six-tier ramp. Target visual progression:
cool calm → warm urgent → red-purple → near-black, monotonically
increasing in saturation/contrast intensity:

```ts
const TIER_SWATCH: Record<string, { background: string; color: string }> = {
  easy:      { background: '#15803d', color: '#ffffff' },  // green-700
  medium:    { background: '#1d4ed8', color: '#ffffff' },  // blue-700
  hard:      { background: '#b45309', color: '#ffffff' },  // amber-700
  expert:    { background: '#c2410c', color: '#ffffff' },  // orange-700
  master:    { background: '#7f1d1d', color: '#ffffff' },  // red-900
  nightmare: { background: '#0f0f1f', color: '#ffffff' },  // near-black indigo
};
```

The `diabolical`, `demonic`, and the original `master` (red-700)
swatches are dropped. The renamed `master` slot uses red-900 (a
deeper red than the old `master`'s red-700) to preserve the visual
escalation between Expert and Nightmare; the orange→red-900 jump is
intentional and matches the corresponding semantic jump (chains and
ALS are a meaningful step harder than wings and fish).

`DifficultyBadge.test.tsx` adds explicit "renders for each of the
six tiers" cases and removes the old eight-tier ramp test. The
neutral fallback for unknown slugs is unchanged.

## 11. Re-profile (iteration-7 final snapshot)

After §6 and §7 land on the iteration-7 corrected baseline, re-run
`npm run profile-tiers -- --all-tiers --n=50` once more and commit
the result as the **iteration-7 final snapshot**. This second run
is the reliability check — every advertised tier should still hit
its target rate within its widened attempt budget. If any
advertised tier's final-snapshot `solvedRate` drops below 5% (e.g.
due to seed-range variance from the recalibrated budgets), its
advertisement is reverted before the iteration ships, following the
iteration-5/6 contingency pattern.

## 12. Existing code to update

Non-exhaustive list of files this iteration touches:

- `src/engine/generator/rate.ts` — `Difficulty` type, `DIFFICULTY_ORDER`,
  `TECHNIQUE_TIER`, `CLUE_BOUNDS`. Major rewrite.
- `src/engine/generator/variant-tiers.ts` — `VARIANT_TIERS`, doc-block.
- `src/engine/generator/generate-for-difficulty.ts` — `TIER_BUDGETS`
  consolidation; remove `MAX_ATTEMPTS_BY_TIER`,
  `TIMEOUT_MS_BY_TIER`, `DEFAULT_MAX_ATTEMPTS`,
  `DEFAULT_TIMEOUT_MS`; rewrite docblock.
- `src/engine/solver/techniques/catalog.ts` — every `tier:` field
  on `TECHNIQUE_CATALOG`.
- `src/engine/solver/techniques/tier-fixtures.ts` — keys, seeds,
  boards, docblock; new fixtures for `six:Easy` and `mini:Easy`.
- `src/store/save.ts` — `SAVE_STORAGE_KEY`, `SAVE_SCHEMA_VERSION`.
- `src/store/stats.ts` — `STATS_STORAGE_KEY`, `STATS_SCHEMA_VERSION`,
  `entryKey` lowercase normalisation, comment refresh.
- `src/store/migration.ts` — `OLD_SAVE_KEY_PATTERN` regex.
- `src/components/DifficultyBadge.tsx` — `TIER_SWATCH`.
- `scripts/tier-distribution.md` — overwritten twice (iteration-7
  baseline, iteration-7 final snapshot).
- `scripts/tier-distribution.summary.json` — same; six fewer
  cells than iteration-6 (no Diabolical/Demonic).
- `package.json` — version `0.5.0 → 0.6.0`.
- Tests across `src/` — every file that imports `Difficulty`,
  `DIFFICULTY_ORDER`, `MAX_ATTEMPTS_BY_TIER`, `TIMEOUT_MS_BY_TIER`,
  `SAVE_STORAGE_KEY`, `STATS_STORAGE_KEY`, or any tier name. See §13.
- `.devloop/archive/iteration-6/` — created during DevLoop's
  archive step.

Files **not** touched (verified during discovery):

- `src/engine/solver/techniques/index.ts` and the 34 individual
  technique implementations.
- `src/engine/solver/backtracking.ts`.
- `src/engine/variants/*.ts`.
- `src/workers/*` (the worker doesn't know about tier names; it
  just forwards the `difficulty` string).
- The Hint panel and TechniqueDetail screen (they drive off the
  catalog by ID, not tier).

## 13. Testing strategy

### Unit suites that need updating

- `src/engine/generator/rate.test.ts` — assertions on
  `TECHNIQUE_TIER`, `DIFFICULTY_ORDER`, `CLUE_BOUNDS` keys.
- `src/engine/generator/generate-for-difficulty.test.ts` —
  per-tier budget table assertion (the iteration-6 explicit values
  Medium=122 / Demonic=122 / Nightmare=59 become Medium / Master /
  Nightmare in the new naming, with values re-pinned against the
  iteration-7 baseline). The Nightmare-by-default attempts test
  carries over with the new budget.
- `src/engine/generator/variant-tiers.test.ts` — `availableTiers`
  return values for each variant.
- `src/engine/solver/techniques/tier-fixtures.test.ts` — round-trip
  asserts every entry in `TIER_FIXTURES` (now 9 entries).
- `src/engine/solver/techniques/catalog.test.ts` — any tier-grouping
  assertions; the catalog test that asserts every technique has an
  entry is unaffected.
- `src/store/save.test.ts` — `SAVE_STORAGE_KEY` and
  `SAVE_SCHEMA_VERSION` literals; `slotKey` already has a
  lowercase-normalisation case.
- `src/store/stats.test.ts` — `STATS_STORAGE_KEY` /
  `STATS_SCHEMA_VERSION` literals; new lowercase-normalisation case
  for `entryKey`; `initialStatsEntries` shape (one entry per
  advertised cell — six classic, two six, one mini = nine total).
- `src/store/migration.test.ts` — v3 detection inverts; new "v4
  not detected" case.

### Component / screen suites that need updating

- `src/components/DifficultyBadge.test.tsx` — six-tier ramp.
- `src/screens/Home.test.tsx` — picker for classic now has six
  options (`easy/medium/hard/expert/master/nightmare`); six and
  mini unchanged.
- `src/screens/Stats.test.tsx` — the `tiers.length <= 1` filter-pill
  hide rule from iteration 5 still applies; classic now exposes
  six pills.
- `src/screens/Settings.test.tsx` — storage section already keyed
  off `hasOldSaves()`, no test changes for the regex bump beyond
  asserting v3 keys now trigger the section.
- `src/App.test.tsx` — migration prompt; the existing test seeds a
  v2 save and asserts the dialog renders. A new case seeds a v3
  save and asserts the same dialog.

### E2E

- `tests/e2e/difficulty-matrix.spec.ts` — iterates
  `availableTiers(variant)`. With classic gaining four new
  advertised tiers (Hard, Expert, Master, plus the renamed
  Nightmare which is unchanged in techniques), the strict matrix
  takes longer. The cap-on-success contract is preserved; failed
  generation at any advertised tier blocks the iteration.
- All other E2E specs (worker, pwa-update, hint-learn-more,
  new-game, notes, resume) are unaffected. Resume specs may need
  to seed v4 keys instead of v3 — verify when the suite is run.

### Verification scope

Per CLAUDE.md, each TASK's verification must run only the tests
relevant to that task — `npm test -- --grep` patterns or specific
files. The full `npm test` sweep is the iteration-7 closing task.
The full `npx playwright test` sweep is the final task — earlier
E2E tasks reference specific specs.

## 14. Edge cases and failure modes

- **An advertised tier in the iteration-7 baseline returns
  `solvedRate < 0.05`.** Per the iteration-5/6 contingency rule:
  drop the tier from `VARIANT_TIERS`, leave its `TECHNIQUE_TIER`
  membership intact (so puzzles that *would* have rated to it
  silently rate to the next-higher tier), and ship without it.
  File the rater-side fix as iteration-8 scope.
- **A user has in-progress v3 saves at advertised tiers (Easy,
  Medium, Nightmare were unchanged in name).** They will be
  prompted on first launch and lose those saves. This is the
  explicit user choice from discovery; the requirements doc
  surfaces it here so the iteration-7 review can confirm the
  prompt copy in `App.tsx` (which talks about "old saves") is
  accurate without modification — v3 → v4 is "old" by the same
  mechanism that v1/v2 → v3 was.
- **The `n=50` profile sweep overshoots two hours wall-clock.**
  Acceptable per discovery — wait it out. If it overshoots four
  hours the requirement-side response is to re-run with `n=30`
  (still better than iteration-6's `n=20`); the §6 reliability
  formula's confidence band widens proportionally. Below `n=30` is
  worse than iteration-6 evidence, which would be a regression.
- **The iteration-7 baseline produces a `firstHitSeed` for a
  newly-advertised cell that fails fixture round-trip.** The
  fixture's `seed` and `clueFloor` parameters are sourced directly
  from the baseline summary; if `tier-fixtures.test.ts` round-trip
  fails, the iteration-7 baseline itself is suspect (this would
  indicate the rater is non-deterministic across runs, which
  iteration-6 confirmed it is not). Investigate before shipping.
- **A test imports the removed `MAX_ATTEMPTS_BY_TIER` /
  `TIMEOUT_MS_BY_TIER` symbols.** Type-check catches it. The
  per-tier table assertion in
  `generate-for-difficulty.test.ts:185-203` is rewritten to
  destructure `TIER_BUDGETS` instead of the two parallel records.
- **A test imports the removed `Diabolical` / `Demonic` literals.**
  Type-check catches it. Update to the renamed tiers per the
  semantic-shift table in §4.1 above.
- **The `DifficultyBadge` neutral-fallback path triggers on the
  removed `diabolical` / `demonic` slugs.** This would happen if
  *some* persisted save survived the v3 → v4 cleanup carrying the
  old slug — but the cleanup deletes the entire entry, so the
  badge is never asked to render that slug. If a defensive test
  for the fallback path is needed, use a synthetic slug like
  `'unknown-tier'` instead.
- **A user reports that they can't play "Diabolical" any more.**
  This is intentional and documented in the iteration-7 release
  notes (commit body of the version-bump commit). The new "Master"
  is the renamed Diabolical+Demonic+. There is no UI affordance to
  recover the old terminology — the player-visible ramp is the
  only ramp.

## 15. Success criteria

- `Difficulty` is six members; `DIFFICULTY_ORDER` has six entries
  in the new order.
- `TECHNIQUE_TIER` and `TECHNIQUE_CATALOG[*].tier` agree on the
  new mapping per §4.1; type-check passes.
- `CLUE_BOUNDS.classic` has exactly six tier windows; `six` has
  two; `mini` has one.
- `VARIANT_TIERS.classic` lists all six tiers; six and mini
  unchanged from iteration 6.
- `scripts/tier-distribution.summary.json` (iteration-7 corrected
  baseline) shows `solvedRate ≥ 0.05` for every advertised cell;
  `firstHitSeed` and `firstHitBoard` are populated for every
  advertised cell. `n=50` per cell.
- `TIER_BUDGETS` is the only attempt-budget / timeout table in
  `generate-for-difficulty.ts`; per-tier values reflect the
  formula-derived budgets sized against the iteration-7 baseline;
  the docblock cites iteration-7 evidence.
- `defaultMaxAttemptsForTier` is preserved as a thin wrapper.
- `TIER_FIXTURES` has nine entries — one per advertised cell;
  every entry's seed and board come from the iteration-7 baseline;
  `tier-fixtures.test.ts` round-trips all nine.
- `SAVE_STORAGE_KEY === 'sudoku.save.v4'` and
  `STATS_STORAGE_KEY === 'sudoku.stats.v4'`.
- `OLD_SAVE_KEY_PATTERN` matches v1, v2, and v3 keys; v4 keys are
  not detected.
- `entryKey` and `slotKey` both lower-case the difficulty before
  composing the key.
- `DifficultyBadge` `TIER_SWATCH` has six entries; renders cleanly
  for each of the six advertised slugs across all variants.
- `package.json.version === '0.6.0'`.
- The strict matrix E2E
  (`tests/e2e/difficulty-matrix.spec.ts`) passes on Chromium and
  WebKit for every advertised tier in every variant — including
  the six newly-named classic tiers.
- Unit, type-check, and production build sweeps pass cleanly.
- `scripts/tier-distribution.md` and
  `scripts/tier-distribution.summary.json` (iteration-7 final
  snapshot) committed after all tuning lands.
- No regressions in v0.5.0 functionality at the surface area
  unrelated to the tier rename — Hint panel, TechniqueDetail,
  worker generation, PWA update, new-game and resume flows all
  continue to behave correctly.

## 16. Future work

Items intentionally not in iteration 7:

- **Rater extension for small grids** (review §5.2 path 2). The
  six and mini variants advertise only `[Easy, Medium]` and
  `[Easy]` respectively because their grid sizes degenerate the
  bigger-grid technique chain. A per-variant `TECHNIQUE_TIER` (or
  step-count-based discriminator) could give them their own
  meaningful ladders. Iteration 8 candidate.
- **`availableTiers` / `CLUE_BOUNDS` unification** (review §5.1).
  Iteration-7's tier collapse touches both tables; a follow-up
  could merge them into a single `Record<Variant, Record<Tier,
  ClueWindow>>` so future tier rebalances are one-line changes.
- **Candidate-grid duplication in `rate.ts`** — multi-iteration,
  carried since iteration 3.
- **`useUpdate.checkForUpdates` resolution-timing race** — UX-
  visible but minor; carried.
- **Daily puzzle / hint history / undo discipline / stat exports**
  — feature follow-ons.
