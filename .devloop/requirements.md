# Sudoku PWA — Iteration 8 Requirements: a Learn section the player can actually read

This iteration is driven by direct player feedback on the Learn
section at `/learn`. Three problems combine to make the help system
unusable for a casual player:

1. The walkthrough refers to cells by **`r1c1`-style coordinates**
   instead of pointing at them on the board the player is already
   looking at.
2. The fixture descriptions and the runtime hint explanations use
   solver-paper jargon — *house*, *bivalue*, *strong/weak link*,
   *conjugate*, *node*, *cycle*, *alternation*, *cluster*,
   *almost-locked set*, *deadly pattern*, *fin*, etc. — without ever
   defining any of it.
3. At least two fixture boards (3D Medusa, Hidden Single) are
   structurally **invalid sudoku setups** — they ship as concrete
   examples in the help system but a careful reader will conclude
   that the rules of sudoku don't hold there.

This iteration replaces the player-facing surface of the Learn
section and the in-game Hint panel with on-board, role-coded
highlighting and plain-English copy at roughly a 12-year-old
reading age, adds an inline 6–8 entry glossary surfaced per
technique, audits every technique fixture against its own finder so
broken examples can't recur silently, and fixes the two known-bad
fixtures.

The iteration-7 corrected baseline (six-tier ladder, `n=50`
profile) is unchanged. Persisted v4 saves and stats are unaffected.
No generator, rater, or technique-finder logic changes; only the
*explanations* change.

The iteration-7 plan is archived at
`.devloop/archive/iteration-7/` (per the off-by-one convention
introduced in the iteration-7 docblock note: the archive directory
created during DevLoop's commit step for iteration 8 will be
`iteration-7/`).

## 1. Motivation

Player feedback names specific terms that the existing Learn copy
relies on without explanation:

> cell, digit, candidate, node, bivalue cell, conjugate, house,
> weak link, cycle, edges being strong/weak, alternation wraps
> cleanly all the way around, weak link, inter-cell

The same player flagged that the 3D Medusa example at
`/learn/3d-medusa` "contains an invalid sudoku setup". A targeted
audit confirms two real fixture bugs and a third class of
structural risk:

| File                            | Bug                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hidden-single.fixture.ts`      | Digit 9 placed twice in box (rows 1–3, cols 4–6) (R2C4 and R3C5) **and** twice in box (rows 4–6, cols 1–3) (R4C2 and R5C3). The puzzle violates basic sudoku rules in the givens.     |
| `medusa-3d.fixture.ts`          | All four cluster cells (R1C1, R1C2, R2C1, R2C2) sit in box 1 with candidates `{1,5}` only, forming a deadly pattern. Both bipartite colourings of the technique's strong-link graph place the same digit twice in box 1, so the documented "eliminate colour A" deduction is unsound — colour B fails the same way. |

A programmatic sweep of every fixture's givens for row/column/box
duplicates flagged only `hidden-single`. The 3D Medusa class of bug
(givens are individually fine but the puzzle has no valid
completion / both colourings of a chain conflict) is not reachable
by a static check; it requires running the fixture board through
the technique's own finder and confirming the documented deduction
matches the finder's output.

The existing per-technique tests do not consistently provide this
coverage. Several import only the technique's solver code, not its
fixture: `hidden-single.test.ts`, `naked-single.test.ts`,
`x-wing.test.ts`, plus pointing/box-line-reduction (covered by a
shared `intersection.test.ts`) and naked-pair/triple/quad (covered
by a shared `naked-subset.test.ts`). For those techniques, *no*
test exercises the fixture board through the finder, so the broken
hidden-single example shipped without the test suite noticing.

Beyond the bugs themselves: the Hint panel in the live game
(`src/components/Hint.tsx`) exposes an `onHighlight` callback
intended to highlight the cells a hint touches on the player's
board, but `src/screens/Game.tsx` never wires that callback up.
Today, when a player asks for a hint mid-game, the panel returns
dense jargon-heavy text with `R3C4`-style references but **no cell
highlighting on the live board** — a strict superset of the
problems on the Learn page. The work in this iteration covers both
surfaces in one pass.

## 2. Goals

- Replace `r1c1` text references in the Learn walkthrough and the
  Hint panel with **role-coded on-board highlighting**. Every
  pattern cell, elimination target, and placement target gets a
  themed background colour driven by a small fixed role
  taxonomy.
- Wire `Hint`'s `onHighlight` callback through `Game.tsx` so live
  hints highlight cells on the player's actual game board, with
  the same role-coded scheme as the Learn walkthrough.
- Rewrite all 34 fixture `description` strings in plain English at
  approximately a 12-year-old reading level. No "house", "bivalue
  cell", "strong link", "conjugate", "alternation", "ALS",
  "BUG+1", "deadly pattern", "fin", "fish", "kite",
  "skyscraper-as-graph-construction", "cluster", "node", "edge",
  or other solver-paper vocabulary in the player-facing text.
- Rewrite all runtime `explanation` template strings in each of
  the 34 technique finders in the same plain English. Drop the
  embedded `R${r+1}C${c+1}` cell references entirely — the
  highlighted cells on the board carry that information.
- Add a small **glossary** of 6–8 terms that genuinely cannot be
  avoided (`candidate`, `box`, `pair`, `chain`, `cluster`, `pivot`,
  `pincer`, `placement`, `elimination`). Each entry has a one-line
  definition and a tiny inline SVG diagram. The glossary is
  surfaced as a collapsible **"Terms used here"** section at the
  bottom of each `TechniqueDetail` page, listing only the terms
  relevant to the current technique.
- Add a per-fixture **round-trip self-validation test** for every
  one of the 37 catalog fixtures. The test parses the fixture
  board, runs it through the technique's own finder, and asserts
  the finder returns the documented placement / elimination set.
  This catches the 3D-Medusa class of bug.
- Fix the two known-bad fixtures (`hidden-single`, `medusa-3d`).
  The audit may surface additional bugs during round-trip
  validation; resolving any such finds is in scope.
- Fix the missing fixture imports in `hidden-single.test.ts`,
  `naked-single.test.ts`, `x-wing.test.ts`, `intersection.test.ts`
  (covers `pointing` and `box-line-reduction`), and
  `naked-subset.test.ts` (covers `naked-pair`, `naked-triple`,
  `naked-quad`). These tests should at minimum import their
  fixture and route through the new round-trip validation
  helper.
- Bump `package.json` to `0.7.0` (minor — substantial player-
  visible UX overhaul of the Learn screen and Hint panel).

## 3. Non-goals

- **No rater, generator, or technique-finder algorithm changes.**
  The 34 finder implementations and the rater chain are untouched.
  Only the `explanation` string templates inside each finder
  change.
- **No save / stats / settings schema bump.** This iteration adds
  no new persisted state; the v4 keys from iteration 7 stay v4.
- **No new techniques or variants.** No new entries in
  `TECHNIQUE_CATALOG`, `DIFFICULTY_ORDER`, or `VARIANT_TIERS`.
- **No tier or budget changes.** `TIER_BUDGETS` and the
  iteration-7 final-snapshot baseline are unchanged.
- **No translations.** All copy is plain English.
- **No board arrows / lines / numbered step badges for chain and
  cycle techniques.** Per discovery, chains use colour-coded role
  highlighting only; the player infers chain order from the
  position of the cells. Drawing an SVG overlay layer over the
  board is deferred.
- **No standalone Glossary screen in the navigation.** The
  glossary is inline-on-each-technique-page only — no
  `/learn/glossary` route, no top-level Learn nav tab.
- **No Settings preview update beyond what the new role tokens
  demand.** `Settings.tsx`'s existing cell-state preview swatches
  (`--cell-selected`, `--cell-conflict`, `--cell-completed`,
  `--cell-highlight`) stay; new role swatches do not need to be
  previewed in Settings.
- **No `useUpdate.checkForUpdates` race fix, no rate.ts candidate-
  grid duplication cleanup, no `__APP_VERSION__` ambient typing
  fix, no `availableTiers` / `CLUE_BOUNDS` unification, no rater
  extension for small grids.** All carried.
- **No CI E2E runs.** Local pre-push gate only.

## 4. Role taxonomy

A new shared module
`src/engine/solver/techniques/roles.ts` exports the canonical
role enum:

```ts
export type CellRole =
  | 'pattern-primary'
  | 'pattern-secondary'
  | 'pivot'
  | 'pincer'
  | 'cluster-a'
  | 'cluster-b'
  | 'chain-link'
  | 'corner'
  | 'elimination'
  | 'placement';
```

Semantic meanings:

| Role                | Meaning                                                                                                                                                | Used by                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pattern-primary`   | The main cells the technique looks for: the subset cells, the fish corners, the intersection cells, the BUG+1 cell.                                    | naked-pair/triple/quad, hidden-pair/triple/quad, pointing, box-line-reduction, x-wing, swordfish, jellyfish, bug-plus-one                            |
| `pattern-secondary` | Supporting cells the pattern leans on but that aren't the primary subset — e.g. fish lines, the strong-link cell that's not also a roof, the W-Wing's strong-link house. | x-wing/swordfish/jellyfish (line cells outside the corners), w-wing (strong link), skyscraper (base), two-string-kite (shared box), empty-rectangle (box cells) |
| `pivot`             | The single central cell of a wing pattern.                                                                                                              | xy-wing, xyz-wing, wxyz-wing, death-blossom (stem), forcing-chains (source)                                                                          |
| `pincer`            | The cells surrounding a pivot.                                                                                                                          | xy-wing, xyz-wing, wxyz-wing (pincers), death-blossom (petals' bivalue ends)                                                                         |
| `cluster-a`         | First colour group in a two-colouring technique.                                                                                                        | simple-coloring, multi-coloring (cluster1A + cluster2A), 3d-medusa (colorA), als-xz (alsA)                                                            |
| `cluster-b`         | Second colour group, complement of `cluster-a`.                                                                                                         | simple-coloring, multi-coloring (cluster1B + cluster2B), 3d-medusa (colorB), als-xz (alsB)                                                            |
| `chain-link`        | Interior cells of a chain or cycle.                                                                                                                     | xy-chain, x-cycle, nice-loop, grouped-x-cycle                                                                                                         |
| `corner`            | The four corners of a deadly-pattern rectangle.                                                                                                         | unique-rectangle, hidden-rectangle, avoidable-rectangle                                                                                              |
| `elimination`       | Cells where candidates are removed by the deduction.                                                                                                    | every technique that has eliminations                                                                                                                |
| `placement`         | Cell where a digit is placed by the deduction.                                                                                                          | naked-single, hidden-single, bug-plus-one (when applicable)                                                                                          |

Every fixture and every runtime hint result maps each cell to
exactly one role. When a cell could plausibly play two roles
(e.g. an x-wing corner that's also an elimination — it isn't, but
hypothetically), `elimination`/`placement` win over the pattern
roles, and within pattern roles `pattern-primary` wins over
`pattern-secondary`. The conflict order is enforced by a small
helper `mergeCellRoles(roles: CellRole[]): CellRole`.

### 4.1 Theme tokens

Each role gets a CSS custom property in every theme stylesheet.
Suggested palette (light theme; other themes adapt for contrast):

```css
:root {
  --role-pattern-primary:   #fff3bf; /* same as old --cell-highlight */
  --role-pattern-secondary: #fde7a8;
  --role-pivot:             #c7d2fe;
  --role-pincer:            #ddd6fe;
  --role-cluster-a:         #bbf7d0;
  --role-cluster-b:         #fed7aa;
  --role-chain-link:        #e0e7ff;
  --role-corner:            #fef3c7;
  --role-elimination:       #fecaca;
  --role-placement:         #bbf7d0;  /* shares green family with cluster-a; placement wins by precedence */
}
```

Each of `light.css`, `dark.css`, `notepad.css`, `space.css` gets a
matching block tuned for that theme's contrast and saturation.
Concrete colour values are an authoring decision during the theme
task; the requirement is that every role is visually
distinguishable from the four existing cell-state colours and
from the other roles within a single theme.

### 4.2 Conflict precedence

The Board component's existing background-colour decision tree
(currently `conflict → selected → highlight → completed → given →
default`) is extended to insert role highlights *between selected
and completed*, in this order:

```
conflict → selected → role highlight (if any) → completed → given → default
```

`elimination` and `placement` are visually distinguished from the
pattern roles by a subtle pulse / border accent during the
walkthrough's `deduction` and `applied` steps; the exact
animation is left to authoring discretion but must be subtle
enough to read in dark and notepad themes.

## 5. Plain-English style guide

Reading-age target: roughly 12 years old. Casual sudoku player
who plays for fun, has never read a solver paper, and has not
learned chain-graph theory.

### 5.1 Banned terms and substitutions

| Banned term                                                                   | Plain substitute                                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| house                                                                         | "row, column, or box" (or just one of the three when the description means specifically one)  |
| bivalue cell                                                                  | "cell with only two possible numbers"                                                         |
| candidate (in user-facing prose)                                              | "possible number" (in glossary entry: keep `candidate` as the term being defined)             |
| node, edge                                                                    | drop entirely — restate without the graph metaphor                                            |
| strong link                                                                   | "in this row/column/box, the number can only go in one of two cells, so one of the two must hold it" |
| weak link                                                                     | "two cells can't both hold the number"                                                        |
| conjugate, conjugate pair                                                     | "the only two cells in this row/column/box where the number can go"                           |
| alternation, alternates                                                       | "switching back and forth"                                                                    |
| inter-cell                                                                    | "between cells"                                                                               |
| cycle (in the graph sense)                                                    | "loop"                                                                                        |
| ALS, almost-locked set                                                        | "a small group of cells where you almost know which numbers go in them"                       |
| BUG+1, bivalue universal grave                                                | "a near-stuck pattern where every cell except one has only two possibilities"                  |
| deadly pattern                                                                | "a pattern that would give the puzzle two answers — which isn't allowed"                      |
| fin                                                                           | "an extra cell on the side that breaks the pattern"                                           |
| fish, x-wing/swordfish/jellyfish (in prose, not as the technique's display name) | "a rectangle (or 3-row / 4-row pattern) of cells where a number is forced to one of a few columns" |
| chain (when used loosely in prose)                                            | keep the *word* "chain" (it's in the glossary); avoid graph-theoretic baggage like "directed", "alternating", "node-edge" |
| cluster                                                                       | keep, in glossary; describe simply as "a group of cells coloured to track which can/can't be the number together" |
| pincer / pivot                                                                | keep, in glossary; pivot = "the cell in the middle that points two ways", pincer = "the cell on each side that closes off the deduction" |

`cell`, `digit`, `row`, `column`, `box`, `pair`, `triple`, `quad`,
`number`, `place`, `remove`, `pattern` are allowed without
glossary entry — they are everyday words at the target reading
level.

### 5.2 Sentence-shape guidance

- Every description starts with **"When you see…"** or **"Look
  for…"** — the player thinks in terms of patterns to spot.
- Each description finishes with a one-sentence **"…then you can
  place / remove…"** so the deduction is explicit.
- Hard upper bound: each description fits in 3 sentences. Long
  technique writeups (3D Medusa, forcing-chains, ALS-XZ) get a
  dedicated `glossaryTerms` list that pulls weight off the prose.
- The cell references that today read as `r3c4` are dropped from
  the prose entirely. The Board highlights speak for themselves.

### 5.3 Before/after examples

These are the target style — not authored verbatim, but the bar.

**Naked Single** (Easy):

- Before: *"A cell whose row, column, and box together rule out
  every digit except one. The remaining digit must be placed in
  that cell."*
- After: *"Look for a cell where every other number is already
  used in its row, column, or box. The one number that's left
  must go there."*

**Hidden Single** (Medium):

- Before: *"Within a row, column, or box, a digit that has only
  one remaining candidate cell — even if that cell still has
  other candidates. Place the digit there."*
- After: *"Look at one row, column, or box and pick a number.
  If there's only one cell in that group where the number can
  still fit, that's where it goes — even if the cell has lots
  of other possibilities."*

**Naked Pair** (Hard):

- Before: *"Two cells in a row, column, or box that share the
  same two candidates and only those two candidates form a
  naked pair. Those digits must occupy those two cells, so they
  can be eliminated from every other cell in the house."*
- After: *"When two cells in the same row, column, or box can
  each only be one of the same two numbers, those two numbers
  have to go in those two cells. You can rule them out
  everywhere else in that row, column, or box."*

**X-Wing** (Expert):

- Before (rate.ts paraphrased): *"In two rows (or columns), if
  a digit's candidate cells lie in the same two columns (or
  rows), those two lines form an x-wing…"*
- After: *"Look at two rows where one number can only go in two
  cells each, and those four cells line up to form a rectangle.
  The number has to go in two opposite corners of the rectangle.
  You can rule it out from any other cell in the rectangle's two
  columns. (And the same idea works swapping rows and columns.)"*

**3D Medusa** (Master):

- Before: *"Build a graph whose nodes are every candidate (cell,
  digit) and whose strong links join two nodes that cannot both
  be false. Two kinds of strong link feed the graph: a bivalue
  cell joins its two candidates, and a house with exactly two
  candidates for some digit joins those two cells for that
  digit. Two-colour each connected component…"*
- After: *"Pick two numbers and follow how they have to travel
  through the grid. Sometimes a cell has only those two numbers
  left, and sometimes a row, column, or box has only two cells
  where one of the numbers can go. Colour the cells you visit in
  two alternating colours. If one colour ever forces the same
  number into two cells of the same row, column, or box, that
  colour can't be right — so you can rule out everything that
  colour was claiming."*

The 3D Medusa "after" example uses the word `colour` (UK
spelling, matching the codebase) without defining it: the
glossary entry for `cluster` covers the colour-grouping concept.

## 6. Glossary

A new module `src/engine/solver/techniques/glossary.ts` exports
the glossary data:

```ts
export type GlossaryTermId =
  | 'candidate'
  | 'box'
  | 'pair'
  | 'chain'
  | 'cluster'
  | 'pivot-pincer'
  | 'placement'
  | 'elimination';

export interface GlossaryEntry {
  id: GlossaryTermId;
  term: string;
  definition: string;
  /** Tiny inline SVG (≤ 120×120px) shown next to the definition. */
  diagram: () => JSX.Element;
}

export const GLOSSARY: Record<GlossaryTermId, GlossaryEntry>;
```

Initial entry list (8 terms; final list trimmed during writing if
two terms collapse into one):

| ID              | Term                | Definition (target wording)                                                                                                                            |
| --------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `candidate`     | Candidate           | A small number you write in a cell to remember a possibility before committing.                                                                        |
| `box`           | Box                 | One of the small groups outlined by thicker lines. Classic sudoku has nine 3-by-3 boxes; the smaller variants use 2-by-3 or 2-by-2 boxes.              |
| `pair`          | Pair (and triple, quad) | Two cells (or three, or four) in the same row, column, or box that together can only be the same two (or three, or four) numbers.                  |
| `chain`         | Chain               | A sequence of cells where each step tells you "if this isn't the number, the next one must be". Following the chain lets you rule numbers out. |
| `cluster`       | Cluster             | A group of cells you mark in two alternating colours to see which set of guesses can be true together. If one colour leads to a contradiction, the other colour wins. |
| `pivot-pincer`  | Pivot and pincer    | In some patterns, a cell in the middle (the pivot) is paired with two cells on either side (the pincers). Together they squeeze a number out of any cell that sees both pincers. |
| `placement`     | Placement           | Filling a cell in with its final number — you've worked out for certain what goes there.                                                              |
| `elimination`   | Elimination         | Removing a candidate from a cell because you've ruled it out. The cell still has other possibilities; you've just narrowed them.                    |

Each entry has a small inline SVG diagram authored as a tiny TSX
function returning JSX. The diagrams are mini-grids (3×3, 4×4, or
fragments) with the relevant cells highlighted in the role colours
that match the technique pages, so the visual language is
consistent.

`TechniqueCatalogEntry` gains an optional `glossaryTerms?:
GlossaryTermId[]` field listing the terms relevant to that
technique. Each `TechniqueDetail` page renders a collapsible
**"Terms used here"** section after the walkthrough panel, listing
the entries from `glossaryTerms` (if any), each as a card with
term name, definition, and diagram. The section is collapsed by
default and toggled with a chevron. Persisted state is not
stored — collapse state resets on navigation.

If a technique's `glossaryTerms` array is empty or absent, the
"Terms used here" section is not rendered.

## 7. Fixture interface changes

`src/engine/solver/techniques/catalog.ts` updates the
`TechniqueFixture` interface:

```ts
export interface FixtureCellRole {
  pos: Position;
  role: CellRole;
}

export interface TechniqueFixture {
  variant: 'classic' | 'six' | 'mini';
  /** Same as today: row-major board string with '1'-'9' (or 'a'-'i' for placed-not-given), '.'/'0' for empty. */
  board: string;
  /**
   * Replaces the iteration-7 `patternCells` field. Each cell highlighted
   * during the walkthrough's `pattern` step is listed here with its
   * role. The Board renders `role` via the corresponding theme token.
   */
  roles: FixtureCellRole[];
  deduction: {
    eliminations?: Array<{ pos: Position; digits: Digit[] }>;
    placement?: { pos: Position; digit: Digit };
  };
  description: string;
}
```

`patternCells` is removed; every fixture file is rewritten to use
`roles` instead.

`TechniqueCatalogEntry` updates:

```ts
export interface TechniqueCatalogEntry {
  displayName: string;
  tier: Difficulty;
  fixture: TechniqueFixture;
  description: string;
  /** Glossary terms shown in the "Terms used here" section on the technique's page. */
  glossaryTerms?: GlossaryTermId[];
}
```

## 8. Runtime explanation rewrites

Every `*.ts` finder file with an `explanation:` template
(approximately 40 templates across 30 files; some files have
multiple templates, e.g. `unique-rectangle.ts` Type 1 / 2 / 4)
gets its template rewritten under the §5 style guide. The
following constraints apply:

- The rewritten template **does not include** any
  `R${pos.row+1}C${pos.col+1}`, `cellLabel(pos)`, or similar
  cell-coordinate interpolation. The cells are surfaced through
  the `onHighlight` callback to the Board.
- Numbers (digits, candidates), house labels (e.g. "row 3"), and
  technique name remain as interpolations where they aid
  understanding without referring to cells by coordinate.
- Each rewritten template stays under ~30 words. Long technique
  results that previously emitted multi-clause sentences are
  shortened — the deeper detail lives in the technique's
  fixture description and the glossary, both available via the
  Hint panel's "Learn more" link.

Concrete example for `bug.ts` (current line 183 above):

- Before: `BUG+1: every other unsolved cell is bivalue, so R${plusOne.row + 1}C${plusOne.col + 1} must take ${forcedDigit} — the only candidate appearing three times in its ${describeHouse(forcedHouse)}; any other choice would leave a deadly bivalue pattern with multiple solutions`
- After: `Place ${forcedDigit} in the highlighted cell. Every other open cell has only two possibilities, so this cell has to take the only number that's left over.`

`describeHouse` and any helper functions only used to build
removed cell-coordinate strings get deleted. Functions still used
to produce house labels (e.g. `"row 3"`, `"column 7"`, `"box 5"`)
are kept and reused.

## 9. Hint API changes

`src/components/Hint.tsx`:

```ts
export interface HintHighlight {
  pos: Position;
  role: CellRole;
}

interface HintProps {
  store?: typeof gameStore;
  board?: Board;
  onHighlight?: (cells: HintHighlight[]) => void;
}
```

`cellsFromResult` is renamed to `cellsAndRolesFromResult` and
returns `HintHighlight[]` instead of `Position[]`. Each
technique's case statement maps the result's semantic fields
(e.g. `result.pivot` → role `pivot`, `result.pincers` → role
`pincer`, `result.colorA` → role `cluster-a`,
`result.elimination` cells → role `elimination`) onto roles. The
mapping is deterministic and exhaustive; type-check enforces all
techniques are covered (the existing exhaustive switch on
`result.technique` already does this).

For chains and cycles, all chain-interior cells map to
`chain-link`; the documented elimination cells map to
`elimination`. For multi-coloring, cluster1A + cluster2A both
become `cluster-a` (player doesn't need to distinguish which
cluster is which — both are the same colour family);
analogously cluster1B + cluster2B → `cluster-b`.

`src/screens/Game.tsx`:

The `<Hint>` invocation gains an `onHighlight` prop wired to a
new local `highlights: HintHighlight[]` state. The state is
passed to `<Board>` via a new prop `cellHighlights?:
HintHighlight[]`. Highlights persist on the live game board
until the player makes their next move (places a digit or
toggles a note); after any board mutation, the highlights are
cleared by the same store subscription that already watches
`board` changes.

The Hint panel `explanation` paragraph stays in place as the
text rendering, with the rewritten plain-English content from §8.

## 10. Board component changes

`src/components/Board.tsx`:

```ts
interface BoardProps {
  store?: typeof gameStore;
  onSelectCell?: (pos: Position) => void;
  /**
   * Optional role-coded highlight overlay. Each entry maps a cell
   * position to a CellRole; the rendered background follows the
   * conflict → selected → role highlight → completed → given →
   * default precedence chain.
   */
  cellHighlights?: ReadonlyArray<{ pos: Position; role: CellRole }>;
}
```

The internal `CellViewProps` gains a `roleHighlight?: CellRole`
field. The `bg` decision adds a new branch:

```ts
const bg =
  conflict ? 'var(--cell-conflict)' :
  selected ? 'var(--cell-selected)' :
  roleHighlight ? `var(--role-${roleHighlight})` :
  completed ? 'var(--cell-completed)' :
  cell.given ? 'var(--cell-given-bg, var(--cell-bg))' :
  'var(--cell-bg)';
```

The role-CSS-variable name is derived from the role enum value
(`pattern-primary` → `--role-pattern-primary` etc.). The CSS
variables are defined in §4.1.

The `cellHighlights` prop is converted to a
`Map<positionKey, CellRole>` once at the top of the Board render
to keep per-cell lookups O(1).

A `data-role` attribute is added to each cell button when
`roleHighlight` is set, so tests can assert role assignments
without inspecting computed styles.

## 11. TechniqueDetail changes

`src/screens/TechniqueDetail.tsx`:

- `formatPosition`, `deductionSummary`, and any other
  cell-coordinate formatting helpers are deleted.
- The `walkthrough-pattern-cells` testid no longer renders an
  `r1c1, r2c4, …` text list. Instead, during the `pattern` step,
  the side panel shows a single sentence: `"The highlighted
  cells are the pattern to look for."` (or, for a technique
  with multiple roles, `"The highlighted cells form the
  technique's pattern. The legend below shows what each colour
  means."`).
- During the `deduction` step, the side panel shows: for
  placements `"Place ${digit} in the highlighted cell."`; for
  eliminations `"Remove ${digits.join(' and ')} from the
  highlighted cells."` (digits joined naturally; `[1]` reads as
  `"1"`, `[1,2]` reads as `"1 and 2"`, `[1,2,3]` reads as
  `"1, 2, and 3"`).
- A new **legend strip** appears immediately above the Board,
  listing each role used by the current fixture with a small
  colour swatch and its label. Labels come from a
  `roleLabels: Record<CellRole, string>` table living next to
  the role enum (e.g. `pattern-primary` → "Pattern",
  `elimination` → "Cells affected", `placement` → "Place
  here", `pivot` → "Centre cell", etc.). Labels are at the
  same reading level as the descriptions.
- The walkthrough's three-step button bar (`Highlight pattern →
  Show deduction → Apply → Reset`) is preserved unchanged.
- Below the buttons, the new collapsible **"Terms used here"**
  section renders the technique's `glossaryTerms` entries
  (per §6).
- `Board` is invoked with a new `cellHighlights` prop derived
  from `fixture.roles` (during the `pattern` step) plus the
  deduction cells (during the `deduction` and `applied` steps,
  with `placement` / `elimination` roles taking precedence over
  pattern roles).

## 12. Fixture bug fixes

### 12.1 Hidden Single

Replace the broken board with one that places digit 9 in
positions that block each row and column entering box 0
*without* duplicating digit 9 anywhere. A valid construction:
9 at (1,3) for row, 9 at (2,5) for row (different box from
(1,3): box (rows 1-3, cols 3-5) versus box (rows 1-3, cols
3-5) — wait, those are the same box). Use instead 9 at (1,4)
and 9 at (2,7), 9 at (3,1) and 9 at (4,2) — verify each pair
sits in distinct boxes and distinct rows/columns from the
others. Final placement is determined during the fixture-
authoring task; the round-trip test (§13) is the gate.

### 12.2 3D Medusa

The fixture's "four cluster cells in a single box, all
candidates `{1,5}`" structure is a deadly pattern by
construction. Replace with a 3D Medusa example whose strong-
link graph spans cells in **at least two boxes**, so that
exactly one of the two colours leads to a contradiction.

A typical valid construction places the cluster cells across a
2-row strip but spanning two horizontal boxes (e.g. R1C1, R1C5,
R2C1, R2C5 — corners straddling boxes 1 and 2), or across a
diagonal that touches three boxes. The fixture-authoring task
decides on a concrete construction; the round-trip test (§13)
gates correctness.

### 12.3 Audit findings

The §13 round-trip test, when added, may surface additional
fixtures that fail to reproduce their documented deduction.
Each surfaced failure is fixed in scope of this iteration, in
the same style as §12.1 / §12.2 — replacing the board with a
correct construction. If a failure cannot be fixed within a
small number of attempts (say, 3 fixture-rewrite tasks per
technique), the fixture is escalated and the tier rating /
catalog entry for that technique is reviewed; descoping the
technique entirely is the contingency, but no descope is
expected.

## 13. Round-trip self-validation tests

A new `src/engine/solver/techniques/fixtures-round-trip.test.ts`
file iterates `Object.values(TECHNIQUE_CATALOG)` and runs each
fixture through its technique's finder. The test:

1. Parses the fixture board (with `a-i` placed-not-given handling
   for avoidable-rectangle).
2. For variant `classic`/`six`/`mini`, constructs the board via
   `createEmptyBoard(variant)` and `createGivenCell(d)`. For
   `'a'-'i'` placed-not-given characters (used only by
   `avoidable-rectangle.fixture.ts`), the parser inlines the
   conversion (`ch.charCodeAt(0) - 'a'.charCodeAt(0) + 1`) and
   sets `cell.value = d` with `given = false`, mirroring the
   loop at `avoidable-rectangle.test.ts:45-46`. A new shared
   helper in `types.ts` is not added — the inline conversion
   lives in the round-trip test alone.
3. Looks up the technique's finder by id (a new
   `FINDER_BY_ID: Record<TechniqueId, (board: Board) => TechniqueResult | null>`
   table is added next to `TECHNIQUE_CATALOG`).
4. Calls the finder.
5. Asserts the finder's result is non-null.
6. Asserts the result's eliminations / placement match the
   fixture's documented deduction (exact set match, not subset —
   the fixture should match the finder's first / canonical
   result).
7. Asserts the cells the finder identifies (via the
   `cellsAndRolesFromResult` helper) form a *superset* of the
   fixture's `roles` cell list — every fixture role cell appears
   in the finder result. (Strict equality is too tight: some
   finders return additional supporting cells not authored into
   the fixture roles.)

The test's failure messages name the fixture file and the
specific mismatch so a regression points straight at the
broken fixture.

The five test files with missing fixture imports
(`hidden-single.test.ts`, `naked-single.test.ts`,
`x-wing.test.ts`, `intersection.test.ts`,
`naked-subset.test.ts`) gain a top-of-file
`import { fixture } from './<name>.fixture'` plus at least one
test-case that runs that fixture through the technique's
finder and asserts the deduction. The shared `fixtures-round-
trip.test.ts` provides the canonical assertion; the per-file
test-case can simply reference it by id.

## 14. Settings preview

`Settings.tsx`'s existing cell-state preview row (selected /
conflict / completed / highlight) remains unchanged. The new
role tokens are not previewed in Settings — that surface is
about persisted theme choice, not about explaining help-screen
colours.

If during authoring a theme's role swatches turn out to clash
with the existing cell-state swatches in Settings (e.g.
`--role-pattern-primary` is identical to `--cell-highlight`),
the role token is adjusted, not the cell-state token; theme
backwards compatibility is the priority.

## 15. Existing code to update

Non-exhaustive list of files this iteration touches:

- `src/engine/solver/techniques/roles.ts` — **new**: role enum,
  `roleLabels`, `mergeCellRoles`.
- `src/engine/solver/techniques/glossary.ts` — **new**:
  `GlossaryTermId`, `GlossaryEntry`, `GLOSSARY`, inline SVG
  diagrams.
- `src/engine/solver/techniques/catalog.ts` —
  `TechniqueFixture.roles`, `TechniqueCatalogEntry.glossaryTerms`,
  `FINDER_BY_ID` table.
- `src/engine/solver/techniques/<name>.fixture.ts` — **34
  files**: rewrite `description`, replace `patternCells` with
  `roles`, populate `glossaryTerms` on the matching catalog
  entry. Fixtures `hidden-single` and `medusa-3d` additionally
  receive new boards (§12).
- `src/engine/solver/techniques/<name>.ts` — **34 files**:
  rewrite the `explanation:` template strings under §5 / §8.
  Drop `R${...}C${...}` interpolations.
- `src/engine/solver/techniques/index.ts` — no expected
  changes, but verify the exhaustive switch in `nextStep`
  remains exhaustive after fixture/catalog edits.
- `src/engine/solver/techniques/fixtures-round-trip.test.ts`
  — **new**.
- `src/engine/solver/techniques/<name>.test.ts` — fix missing
  fixture imports in the five named files; verify other files
  still pass after `patternCells → roles` rename.
- `src/components/Board.tsx` — `cellHighlights` prop, role
  highlight precedence in `CellView`, `data-role` attribute.
- `src/components/Board.test.tsx` — assertion for
  `cellHighlights` prop, role precedence, `data-role` attribute.
- `src/components/Hint.tsx` — `HintHighlight` type,
  `cellsAndRolesFromResult`, updated `onHighlight` signature,
  rewritten in-panel explanation rendering.
- `src/components/Hint.test.tsx` — assertions for new
  `onHighlight` payload shape, plain-English explanation copy.
- `src/screens/TechniqueDetail.tsx` — drop `formatPosition` /
  `deductionSummary`, render legend strip, pass
  `cellHighlights` to Board, render "Terms used here" section,
  update walkthrough side-panel copy.
- `src/screens/TechniqueDetail.test.tsx` — update
  `walkthrough-pattern-cells` and `walkthrough-deduction`
  assertions to match new copy; add legend-strip and "Terms
  used here" assertions.
- `src/screens/Game.tsx` — wire `Hint`'s `onHighlight` to
  `Board`'s `cellHighlights`; clear on board mutation.
- `src/screens/Game.test.tsx` — verify hint-triggered
  highlights render and clear correctly.
- `src/themes/light.css` / `dark.css` / `notepad.css` /
  `space.css` — add `--role-*` variables tuned per theme.
- `package.json` — version `0.6.0 → 0.7.0`.
- `.devloop/archive/iteration-7/` — created during DevLoop's
  archive step.

Files **not** touched (verified during discovery):

- `src/engine/generator/*` — no rater or generator changes.
- `src/engine/solver/backtracking.ts`.
- `src/engine/variants/*.ts`.
- `src/store/save.ts`, `stats.ts`, `migration.ts`,
  `settings.ts` — no schema bump.
- `src/workers/*` — the worker doesn't see explanations.
- `scripts/tier-distribution.*` — no re-profile.
- `tests/e2e/difficulty-matrix.spec.ts` — unaffected by
  description / role changes.

## 16. Testing strategy

### Unit suites

- `src/engine/solver/techniques/fixtures-round-trip.test.ts` —
  the gate for every fixture being a valid demonstration of its
  technique. Failure here blocks the iteration.
- The 34 per-technique tests — each runs at least one finder
  invocation and asserts a result. The five tests previously
  missing fixture imports gain at least one fixture-driven
  case.
- `src/engine/solver/techniques/catalog.test.ts` — verify every
  catalog entry has either an empty / absent `glossaryTerms`
  array OR all listed terms exist in `GLOSSARY`. Verify every
  `TECHNIQUE_CATALOG[id].fixture.roles` array is non-empty for
  techniques with a non-trivial pattern.
- `src/engine/solver/techniques/index.test.ts` — unchanged
  except the exhaustive switch in `nextStep` may need an extra
  branch if `cellsAndRolesFromResult` is colocated with it.

### Component / screen suites

- `src/components/Board.test.tsx` — given `cellHighlights`,
  asserts:
  - the right cell gets `data-role="..."`;
  - role highlight wins over `completed` and `given` but loses
    to `selected` and `conflict`;
  - omitting `cellHighlights` keeps the existing rendering
    behaviour byte-for-byte.
- `src/components/Hint.test.tsx` — asserts:
  - clicking Hint with a known board emits an `onHighlight`
    array whose entries have both `pos` and `role` populated;
  - the hint panel text renders the rewritten plain-English
    explanation (the literal new wording is asserted as a
    regex on key phrases, not exact copy, to allow minor
    authoring tweaks).
- `src/screens/TechniqueDetail.test.tsx` — asserts:
  - the legend strip renders for at least one technique with
    multiple roles (e.g. xy-wing → pivot + pincer +
    elimination);
  - the "Terms used here" section renders for at least one
    technique with `glossaryTerms` (e.g. 3d-medusa → cluster +
    chain);
  - the walkthrough side panel no longer contains `r1c1`-style
    coordinates (regex `/[Rr]\d+[Cc]\d+/` returns no match in
    the panel's text content).
- `src/screens/Game.test.tsx` — asserts:
  - clicking Hint highlights cells on the live board with the
    correct `data-role` attributes;
  - placing a digit on the live board clears the hint
    highlights.

### Verification scope

Per CLAUDE.md, each TASK's verification runs only the tests
relevant to that task — `npm test -- --grep` patterns or
specific files. The full `npm test` sweep is the iteration
closing task.

The full E2E suite is unchanged by this iteration (no
generator changes, no advertised tier movement). A single
spot-check Playwright run on `tests/e2e/hint-learn-more.spec.ts`
(or the equivalent existing spec) verifies that the rewritten
hint explanation and the "Learn more" link still navigate
correctly. The full Chromium + WebKit sweep is a closing task
to confirm no regressions in unrelated areas.

## 17. Edge cases and failure modes

- **A fixture's round-trip test fails because the finder
  returns a different elimination set than the one documented.**
  Treated as a fixture bug per §12.3. The repair is a
  fixture-board rewrite, not a finder change — the finder is
  ground truth.
- **A fixture's round-trip test fails because the finder finds
  *additional* eliminations beyond the fixture's documented
  set.** This is acceptable: the assertion is "documented set
  ⊆ finder set", not equality. The fixture demonstrates one
  deduction; the finder may report several at once. If the
  fixture's *primary* deduction is missing from the finder's
  output, that's still a fail.
- **Two techniques' role mappings collide on the same cell at
  runtime** (e.g. an XY-wing pivot that also happens to be an
  elimination target — unlikely but constructable). The
  `mergeCellRoles` precedence chain in §4 makes this
  deterministic; tests cover the precedence.
- **A theme can't visually distinguish all 10 roles within its
  palette** (e.g. dark theme runs out of high-contrast warm
  hues). The role count is bounded; if a theme genuinely
  cannot accommodate 10 distinct backgrounds, two roles
  share a swatch but get differentiated by a small icon or
  border accent. This is per-theme authoring discretion.
  The minimum guarantee: `elimination` and `placement` are
  always visually distinct from every pattern role and from
  each other.
- **A player runs `npm test` mid-iteration and a fixture round-
  trip is failing** (e.g. mid-rewrite). Tasks are sequenced so
  fixture-rewrite tasks always come *after* the round-trip
  test infrastructure is in place; each fixture-rewrite task's
  verification is its own targeted round-trip case, so
  partial-iteration `npm test` runs surface only completed
  work.
- **The 3D Medusa replacement fixture turns out to be hard to
  hand-author.** Fallback: source the fixture from a
  generator run at the appropriate tier, recording the seed,
  board string, and the finder's output, then commit those as
  the fixture. The generator's first hits at Master tier
  produce real 3D Medusa puzzles; one of them can serve.
- **Glossary diagram authoring is more time than expected**
  (tiny SVGs are fiddly). Per-term diagrams can be deferred
  to a follow-up task; the glossary entry without a diagram
  still ships meaningful copy. The requirement is one
  diagram per entry by iteration close, but the iteration is
  not blocked by absent diagrams alone.
- **Some descriptions can't reasonably be rewritten in 12-yo
  English without losing precision** (forcing-chains is the
  hardest case). The fallback is a longer (4–5 sentence)
  description with a richer `glossaryTerms` list. The 3-
  sentence cap in §5 is a bar to aim for, not a hard limit
  for the most complex techniques.
- **A Hint result includes cells that don't fit any role
  cleanly.** The default fallback in `cellsAndRolesFromResult`
  is `pattern-primary`. The exhaustive switch on
  `result.technique` ensures every technique is covered, but
  the *interior* mapping inside each branch is per-author.

## 18. Success criteria

- Every fixture description is at most 3 sentences (5 for
  forcing-chains, ALS-XZ, 3D Medusa, multi-coloring, nice-loop)
  and uses no banned term from §5.1.
- Every runtime explanation template is rewritten under the
  same rules; no `R${row+1}C${col+1}` interpolations remain in
  any technique finder.
- `TechniqueFixture.roles` is populated on every fixture; every
  cell in every fixture's `roles` array has a valid `CellRole`
  (type-checked).
- `TECHNIQUE_CATALOG[id].glossaryTerms`, when present, lists
  only entries that exist in `GLOSSARY`.
- The `fixtures-round-trip.test.ts` test passes for all 37
  fixtures.
- The five previously-fixture-importless tests
  (`hidden-single`, `naked-single`, `x-wing`,
  `intersection`, `naked-subset`) now import their fixtures
  and pass at least one fixture-driven case.
- The hidden-single and 3d-medusa fixtures have new boards
  that pass their respective round-trip cases.
- `Board` accepts `cellHighlights` and renders `data-role` on
  affected cells; tests assert role precedence.
- `Hint.onHighlight` emits `HintHighlight[]` (cell + role); the
  Game screen wires it to `Board.cellHighlights`; tests
  assert end-to-end highlight + clear behaviour.
- `TechniqueDetail` renders the legend strip and the "Terms
  used here" section; the walkthrough side panel contains no
  `r1c1`-style cell references.
- Each of the four theme stylesheets defines all 10
  `--role-*` variables.
- `package.json.version === '0.7.0'`.
- Type-check, full unit-test sweep, and production build all
  pass cleanly.
- `tests/e2e/hint-learn-more.spec.ts` passes on Chromium and
  WebKit; the full E2E sweep (closing task) shows no
  regressions in tests outside the hint / learn surface.
- No regressions in v0.6.0 functionality at unrelated surface
  area: generator, save / stats, PWA update, new-game and
  resume flows, settings.

## 19. Future work

Items intentionally not in iteration 8:

- **Drawn arrows / lines for chain and cycle techniques.** The
  colour-only role highlighting is the iteration-8 floor; an
  SVG overlay layer over the Board with directional arrows
  showing chain order is a candidate for iteration 9.
- **Glossary as a top-level Learn nav tab.** If players ask
  for the glossary outside of a specific technique page, the
  inline-only design is replaced with a `/learn/glossary`
  route. Telemetry on collapse-section toggles in the inline
  glossary would inform whether this is needed.
- **Localisation.** All copy is plain English. A future
  iteration can extract strings for translation; the iteration-
  8 design keeps copy in the fixture / finder source files,
  which is friendly to a one-shot extraction pass.
- **Variant-specific glossary entries.** A 4×4 mini grid's
  "box" is a 2×2 region; the iteration-8 glossary entry
  covers all variants in one paragraph. A future iteration
  could swap the diagram per active variant.
- **Per-technique difficulty hints in the legend strip.**
  Showing which roles a technique uses ("this technique uses
  pivot, pincer, elimination") could become a player-facing
  index of "techniques I can already do".
- **Rater extension for small grids** — carried from
  iteration-7 §16.
- **`availableTiers` / `CLUE_BOUNDS` unification** — carried.
- **Candidate-grid duplication in `rate.ts`** — carried.
- **`useUpdate.checkForUpdates` resolution-timing race fix** —
  carried.
