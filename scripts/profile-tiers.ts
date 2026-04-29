/**
 * profile-tiers.ts — diagnostic generator profiling harness.
 *
 * For each (variant, advertised tier) cell, generates N puzzles seeded
 * deterministically from the tier's lower clue bound and reports the
 * distribution of *rated* tiers among the produced puzzles. Used to
 * surface tier-window misalignment surfaced during iteration 3 manual
 * testing — see requirements §4.2 (rater hardening) and §4.3 (per-tier
 * attempt budgets / clue-bound heuristics).
 *
 * Run via `npm run profile-tiers -- --n=20` (defaults to N=20). With
 * N=1 the smoke run completes well under 60s.
 *
 * Outputs:
 *   - scripts/tier-distribution.md         human-readable histograms
 *   - scripts/tier-distribution.summary.json  flat summary keyed by
 *                                          `${variantId}:${tierName}`
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
  firstHitSeed: number | null;
  firstHitBoard: string | null;
  matchCount: number;
  sampleSize: number;
  advertised: boolean;
}

interface SummaryEntry {
  rate: number;
  advertised: boolean;
  sampleSize: number;
  firstHitSeed: number | null;
  firstHitBoard: string | null;
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
const startedAt = Date.now();

const VARIANTS_IN_ORDER: readonly Variant[] = [
  classicVariant,
  sixVariant,
  miniVariant,
];

const cells: CellResult[] = [];

for (let variantIndex = 0; variantIndex < VARIANTS_IN_ORDER.length; variantIndex++) {
  const variant = VARIANTS_IN_ORDER[variantIndex];
  const advertisedTiers = availableTiers(variant);
  const tiersForVariant = ALL_TIERS ? DIFFICULTY_ORDER : advertisedTiers;
  for (let tierIndex = 0; tierIndex < tiersForVariant.length; tierIndex++) {
    const tier = tiersForVariant[tierIndex];
    const bounds = CLUE_BOUNDS[variant.id]?.[tier];
    if (!bounds) continue; // skip if no clue window defined for this cell
    const clueFloor = bounds[0];
    const advertised = advertisedTiers.includes(tier);

    const histogram = emptyHistogram();
    let firstHitSeed: number | null = null;
    let firstHitBoard: string | null = null;
    let matchCount = 0;

    // Seed offset is keyed on the tier's *position in `DIFFICULTY_ORDER`*,
    // not the local index inside `availableTiers(variant)`. Local indexing
    // shifts every time a tier is descoped (lever 3 in requirements §6),
    // which causes already-profiled tiers to silently sample a *different*
    // seed range — a classic source of false-positive verification failures
    // when the natural rate at a given (variant, tier, clueFloor) is itself
    // healthy but the new seed range happens to be unlucky. Keying on the
    // global tier rank keeps each tier's seed range stable across iterations.
    const tierRank = DIFFICULTY_ORDER.indexOf(tier);
    for (let i = 0; i < N; i++) {
      const seed = variantIndex * 1000 + tierRank * 100 + i;
      const generated = generate(variant, { seed, clueFloor });
      const result = rate(generated.puzzle);
      const rated = result.difficulty;
      histogram[rated] += 1;
      if (rated === tier) {
        matchCount += 1;
        if (firstHitSeed === null) {
          firstHitSeed = seed;
          firstHitBoard = boardToDottedString(generated.puzzle);
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
      firstHitSeed,
      firstHitBoard,
      matchCount,
      sampleSize: N,
      advertised,
    });
  }
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
  mdLines.push(
    `## ${cell.variantId} — clueFloor=${cell.clueFloor} (${cell.tier}.lower)`,
  );
  mdLines.push('');
  mdLines.push('| Rated tier | Count | %     |');
  mdLines.push('|------------|-------|-------|');
  for (const tier of DIFFICULTY_ORDER) {
    const count = cell.histogram[tier];
    const pct = cell.sampleSize > 0 ? (count / cell.sampleSize) * 100 : 0;
    const tierCol = tier.padEnd(10, ' ');
    const countCol = String(count).padEnd(5, ' ');
    const pctCol = `${pct.toFixed(1)}%`.padEnd(5, ' ');
    mdLines.push(`| ${tierCol} | ${countCol} | ${pctCol} |`);
  }
  mdLines.push('');
}

const mdPath = resolve(import.meta.dirname ?? '.', 'tier-distribution.md');
writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

// ---------------------------------------------------------------------------
// JSON summary output
// ---------------------------------------------------------------------------

const summary: Record<string, SummaryEntry> = {};
for (const cell of cells) {
  const key = `${cell.variantId}:${cell.tier}`;
  summary[key] = {
    rate: cell.sampleSize > 0 ? cell.matchCount / cell.sampleSize : 0,
    advertised: cell.advertised,
    sampleSize: cell.sampleSize,
    firstHitSeed: cell.firstHitSeed,
    firstHitBoard: cell.firstHitBoard,
  };
}

const jsonPath = resolve(
  import.meta.dirname ?? '.',
  'tier-distribution.summary.json',
);
writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log(
  `Wrote scripts/tier-distribution.md and scripts/tier-distribution.summary.json (${totalRuntimeSec.toFixed(
    1,
  )}s, ${totalPuzzles} puzzles).`,
);
