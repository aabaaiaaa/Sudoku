/**
 * profile-tiers.ts — diagnostic generator profiling harness.
 *
 * For each (variant, tier) cell, generates N puzzles seeded deterministically
 * from the tier's lower clue bound and reports the distribution of *rated*
 * tiers among the produced puzzles. Each cell records two rates:
 *
 *   - `rate`: fraction of attempts whose `result.difficulty === tier`,
 *     regardless of `result.solved`. Retained as a diagnostic so the
 *     divergence between rated-but-unsolved and rated-and-solved remains
 *     visible — a future regression that biases the counter (see
 *     iteration-5 review C1) shows up directly in the JSON.
 *   - `solvedRate`: fraction of attempts where `result.difficulty === tier
 *     AND result.solved === true`. This is the **load-bearing** rate —
 *     production (`generate-for-difficulty.ts`) rejects unsolved ratings, so
 *     `solvedRate` is what `MAX_ATTEMPTS_BY_TIER` budgets must be sized
 *     against. `firstHitSeed` and `firstHitBoard` likewise track the first
 *     solved-aware hit so any consumer (e.g. `tier-fixtures.ts`) gets a
 *     puzzle the production path would accept.
 *
 * Iteration history:
 *   - Iteration 5 §4 added the `--all-tiers` flag (profile descoped tiers
 *     too) and the `firstHitBoard` field (copy-paste fixture extraction).
 *   - Iteration 6 §4 added `solvedRate` (this file's load-bearing rate),
 *     the `Solved` / `Solved %` markdown columns, the `--out=<basename>`
 *     flag, and the repeatable `--clue-floor-override=variant:tier:N` flag
 *     for lever-2 exploration at floors below `CLUE_BOUNDS`.
 *
 * Run via `npm run profile-tiers -- --n=20` (defaults to N=20). With
 * N=1 the smoke run completes well under 60s.
 *
 * Outputs (default, overridable via `--out=<basename>`):
 *   - scripts/tier-distribution.md         human-readable histograms
 *   - scripts/tier-distribution.summary.json  flat summary keyed by
 *                                          `${variantId}:${tierName}` for
 *                                          canonical cells, or
 *                                          `${variantId}:${tierName}@${floor}`
 *                                          for synthetic
 *                                          `--clue-floor-override` cells.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generate } from '../src/engine/generator/generate';
import {
  rate,
  DIFFICULTY_ORDER,
  CLUE_BOUNDS,
  type Difficulty,
} from '../src/engine/generator/rate';
import { availableTiers } from '../src/engine/generator/variant-tiers';
import {
  classicVariant,
  miniVariant,
  sixVariant,
} from '../src/engine/variants';
import type { Board, Variant } from '../src/engine/types';

interface CellResult {
  variantId: string;
  tier: Difficulty;
  clueFloor: number;
  histogram: Record<Difficulty, number>;
  solvedHistogram: Record<Difficulty, number>;
  firstHitSeed: number | null;
  firstHitBoard: string | null;
  matchCount: number;
  matchCountSolved: number;
  sampleSize: number;
  advertised: boolean;
  /** Synthetic cells (from `--clue-floor-override`) carry their own floor in
   *  the summary key (`variant:tier@floor`) so multiple floors for a single
   *  (variant, tier) don't collide. Null for canonical cells. */
  synthetic: boolean;
}

interface SummaryEntry {
  rate: number;
  solvedRate: number;
  advertised: boolean;
  sampleSize: number;
  firstHitSeed: number | null;
  firstHitBoard: string | null;
}

interface CluefloorOverride {
  variantId: string;
  tier: Difficulty;
  floor: number;
}

function parseN(argv: readonly string[]): number {
  for (const arg of argv) {
    const m = /^--n=(\d+)$/.exec(arg);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return 20;
}

function parseAllTiers(argv: readonly string[]): boolean {
  return argv.includes('--all-tiers');
}

function parseOut(argv: readonly string[]): string {
  for (const arg of argv) {
    const m = /^--out=(.+)$/.exec(arg);
    if (m) {
      const basename = m[1].trim();
      if (basename.length > 0) return basename;
    }
  }
  return 'tier-distribution';
}

function parseClueFloorOverrides(
  argv: readonly string[],
  knownVariantIds: readonly string[],
): CluefloorOverride[] {
  const overrides: CluefloorOverride[] = [];
  for (const arg of argv) {
    const m = /^--clue-floor-override=([^:]+):([^:]+):(\d+)$/.exec(arg);
    if (!m) continue;
    const [, variantId, tierStr, nStr] = m;
    if (!knownVariantIds.includes(variantId)) {
      throw new Error(
        `--clue-floor-override: unknown variant '${variantId}' (expected one of: ${knownVariantIds.join(
          ', ',
        )})`,
      );
    }
    if (!(DIFFICULTY_ORDER as readonly string[]).includes(tierStr)) {
      throw new Error(
        `--clue-floor-override: unknown tier '${tierStr}' (expected one of: ${DIFFICULTY_ORDER.join(
          ', ',
        )})`,
      );
    }
    const floor = Number.parseInt(nStr, 10);
    if (!Number.isFinite(floor) || floor <= 0) {
      throw new Error(
        `--clue-floor-override: floor must be a positive integer, got '${nStr}'`,
      );
    }
    overrides.push({
      variantId,
      tier: tierStr as Difficulty,
      floor,
    });
  }
  return overrides;
}

function emptyHistogram(): Record<Difficulty, number> {
  const h = {} as Record<Difficulty, number>;
  for (const tier of DIFFICULTY_ORDER) h[tier] = 0;
  return h;
}

/**
 * Encode a Board as the row-major dotted-digit string convention used by the
 * test fixtures (and parsed by each `parseBoardString` helper): '.' for empty,
 * '1'..'9' for filled cells. Givens-only boards (like the puzzle returned from
 * `generate()`) are the typical input — non-given filled cells are still
 * encoded as their digit, matching `parseBoardString`'s round-trip behaviour.
 */
function boardToDottedString(board: Board): string {
  const { variant, cells } = board;
  let out = '';
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      const cell = cells[r][c];
      out += cell.value == null ? '.' : String(cell.value);
    }
  }
  return out;
}

const ARGV = process.argv.slice(2);
const N = parseN(ARGV);
const ALL_TIERS = parseAllTiers(ARGV);
const OUT_BASENAME = parseOut(ARGV);
const startedAt = Date.now();

const VARIANTS_IN_ORDER: readonly Variant[] = [
  classicVariant,
  sixVariant,
  miniVariant,
];

const KNOWN_VARIANT_IDS = VARIANTS_IN_ORDER.map((v) => v.id);
const CLUE_FLOOR_OVERRIDES = parseClueFloorOverrides(ARGV, KNOWN_VARIANT_IDS);
const HAS_OVERRIDES = CLUE_FLOOR_OVERRIDES.length > 0;

interface ProfileTarget {
  variant: Variant;
  variantIndex: number;
  tier: Difficulty;
  clueFloor: number;
  advertised: boolean;
  synthetic: boolean;
}

const targets: ProfileTarget[] = [];

if (HAS_OVERRIDES) {
  // Synthetic-only mode: profile *exactly* the override cells; the canonical
  // loop driven by `--all-tiers` / advertised tiers is suppressed for this
  // run. This keeps lever-2 exploration cleanly separate from canonical
  // baseline runs.
  for (const override of CLUE_FLOOR_OVERRIDES) {
    const variantIndex = VARIANTS_IN_ORDER.findIndex(
      (v) => v.id === override.variantId,
    );
    if (variantIndex < 0) {
      throw new Error(
        `--clue-floor-override: variant '${override.variantId}' not in VARIANTS_IN_ORDER`,
      );
    }
    const variant = VARIANTS_IN_ORDER[variantIndex];
    const advertised = availableTiers(variant).includes(override.tier);
    targets.push({
      variant,
      variantIndex,
      tier: override.tier,
      clueFloor: override.floor,
      advertised,
      synthetic: true,
    });
  }
} else {
  for (
    let variantIndex = 0;
    variantIndex < VARIANTS_IN_ORDER.length;
    variantIndex++
  ) {
    const variant = VARIANTS_IN_ORDER[variantIndex];
    const advertisedTiers = availableTiers(variant);
    const tiersForVariant = ALL_TIERS ? DIFFICULTY_ORDER : advertisedTiers;
    for (const tier of tiersForVariant) {
      const bounds = CLUE_BOUNDS[variant.id]?.[tier];
      if (!bounds) continue; // skip if no clue window defined for this cell
      const clueFloor = bounds[0];
      const advertised = advertisedTiers.includes(tier);
      targets.push({
        variant,
        variantIndex,
        tier,
        clueFloor,
        advertised,
        synthetic: false,
      });
    }
  }
}

const cells: CellResult[] = [];

for (const target of targets) {
  const { variant, variantIndex, tier, clueFloor, advertised, synthetic } =
    target;

  const histogram = emptyHistogram();
  const solvedHistogram = emptyHistogram();
  let firstHitSeed: number | null = null;
  let firstHitBoard: string | null = null;
  let matchCount = 0;
  let matchCountSolved = 0;

  // Seed offset is keyed on the tier's *position in `DIFFICULTY_ORDER`*,
  // not the local index inside `availableTiers(variant)`. Local indexing
  // shifts every time a tier is descoped (lever 3 in requirements §6),
  // which causes already-profiled tiers to silently sample a *different*
  // seed range — a classic source of false-positive verification failures
  // when the natural rate at a given (variant, tier, clueFloor) is itself
  // healthy but the new seed range happens to be unlucky. Keying on the
  // global tier rank keeps each tier's seed range stable across iterations.
  // Synthetic (`--clue-floor-override`) cells share the same scheme —
  // multiple floors for a single (variant, tier) sample the same seed range
  // but generate at different `clueFloor`s, so produce different puzzles.
  const tierRank = DIFFICULTY_ORDER.indexOf(tier);
  for (let i = 0; i < N; i++) {
    const seed = variantIndex * 1000 + tierRank * 100 + i;
    const generated = generate(variant, { seed, clueFloor });
    const result = rate(generated.puzzle);
    const rated = result.difficulty;
    histogram[rated] += 1;
    if (result.solved) {
      solvedHistogram[rated] += 1;
    }
    if (rated === tier) {
      matchCount += 1;
      if (result.solved) {
        matchCountSolved += 1;
        // `firstHit*` tracks the first *solved-aware* hit. The production
        // path (`generate-for-difficulty.ts`) rejects unsolved ratings, so
        // any downstream consumer (notably `TIER_FIXTURES`) needs a seed
        // whose puzzle would actually survive the production filter.
        if (firstHitSeed === null) {
          firstHitSeed = seed;
          firstHitBoard = boardToDottedString(generated.puzzle);
        }
      }
    }
    process.stdout.write(`${variant.id} ${tier} ${i + 1}/${N}\r`);
  }
  // Newline after the inline progress for this cell.
  process.stdout.write(`${variant.id} ${tier} ${N}/${N} done\n`);

  cells.push({
    variantId: variant.id,
    tier,
    clueFloor,
    histogram,
    solvedHistogram,
    firstHitSeed,
    firstHitBoard,
    matchCount,
    matchCountSolved,
    sampleSize: N,
    advertised,
    synthetic,
  });
}

const totalRuntimeSec = (Date.now() - startedAt) / 1000;
const totalPuzzles = cells.reduce((sum, c) => sum + c.sampleSize, 0);
const generatedAt = new Date().toISOString();

// ---------------------------------------------------------------------------
// Markdown output
// ---------------------------------------------------------------------------

const mdLines: string[] = [];
mdLines.push('# Tier distribution');
mdLines.push('');
mdLines.push(`- Variants: ${VARIANTS_IN_ORDER.map((v) => v.id).join(', ')}`);
mdLines.push(`- Generated: ${generatedAt}`);
mdLines.push(`- Total runtime: ${totalRuntimeSec.toFixed(1)}s`);
mdLines.push(`- N per cell: ${N}`);
mdLines.push('');

for (const cell of cells) {
  if (cell.synthetic) {
    mdLines.push(
      `## ${cell.variantId}:${cell.tier}@${cell.clueFloor} — synthetic clueFloor=${cell.clueFloor} override`,
    );
  } else {
    mdLines.push(
      `## ${cell.variantId} — clueFloor=${cell.clueFloor} (${cell.tier}.lower)`,
    );
  }
  mdLines.push('');
  mdLines.push('| Rated tier | Count | %     | Solved | Solved % |');
  mdLines.push('|------------|-------|-------|--------|----------|');
  for (const tier of DIFFICULTY_ORDER) {
    const count = cell.histogram[tier];
    const solvedCount = cell.solvedHistogram[tier];
    const pct = cell.sampleSize > 0 ? (count / cell.sampleSize) * 100 : 0;
    const solvedPct =
      cell.sampleSize > 0 ? (solvedCount / cell.sampleSize) * 100 : 0;
    const tierCol = tier.padEnd(10, ' ');
    const countCol = String(count).padEnd(5, ' ');
    const pctCol = `${pct.toFixed(1)}%`.padEnd(5, ' ');
    const solvedCol = String(solvedCount).padEnd(6, ' ');
    const solvedPctCol = `${solvedPct.toFixed(1)}%`.padEnd(8, ' ');
    mdLines.push(
      `| ${tierCol} | ${countCol} | ${pctCol} | ${solvedCol} | ${solvedPctCol} |`,
    );
  }
  mdLines.push('');
}

const mdPath = resolve(
  import.meta.dirname ?? '.',
  `${OUT_BASENAME}.md`,
);
writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

// ---------------------------------------------------------------------------
// JSON summary output
// ---------------------------------------------------------------------------

const summary: Record<string, SummaryEntry> = {};
for (const cell of cells) {
  const key = cell.synthetic
    ? `${cell.variantId}:${cell.tier}@${cell.clueFloor}`
    : `${cell.variantId}:${cell.tier}`;
  summary[key] = {
    rate: cell.sampleSize > 0 ? cell.matchCount / cell.sampleSize : 0,
    solvedRate:
      cell.sampleSize > 0 ? cell.matchCountSolved / cell.sampleSize : 0,
    advertised: cell.advertised,
    sampleSize: cell.sampleSize,
    firstHitSeed: cell.firstHitSeed,
    firstHitBoard: cell.firstHitBoard,
  };
}

const jsonPath = resolve(
  import.meta.dirname ?? '.',
  `${OUT_BASENAME}.summary.json`,
);
writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log(
  `Wrote scripts/${OUT_BASENAME}.md and scripts/${OUT_BASENAME}.summary.json (${totalRuntimeSec.toFixed(
    1,
  )}s, ${totalPuzzles} puzzles).`,
);
