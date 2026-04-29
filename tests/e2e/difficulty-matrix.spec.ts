import { test, expect, type Page } from '@playwright/test';
import { variants } from '../../src/engine/variants';
import { availableTiers } from '../../src/engine/generator/variant-tiers';
import type { Variant } from '../../src/engine/types';

/**
 * E2E — difficulty matrix smoke (requirements §9.1).
 *
 * Every advertised (variant × tier) combination MUST reliably load a playable
 * board within the existing 50-attempt / 60-second budget. Each tier runs as
 * its own `test()` so a single regression points at the exact slot rather than
 * burying every tier under one combined assertion.
 *
 * For each tier we:
 *   1. Clear localStorage so a stale save doesn't trigger a replace prompt.
 *   2. Navigate Home, select the variant + the tier, click New Game.
 *   3. Within 75s assert that the board renders with at least one given cell.
 *      The §7.3 failure dialog appearing — for *any* reason — is a hard test
 *      failure. Anything else (blank screen, hung overlay) is also a hard
 *      failure.
 *
 * Variant blocks use the lowercase variant id (`classic`, `six`, `mini`) in
 * their describe and test titles so the verification grep filters
 * (`--grep classic`, `--grep six`, `--grep mini`) cleanly partition the suite.
 *
 * Strict-success contract: after iteration-4 descoped tier coverage in
 * `variant-tiers.ts` to only those tiers the generator can reliably hit
 * under strict matching, the failure dialog branch is no longer an
 * acceptable outcome here. Any failure-dialog appearance signals a real
 * regression in either the generator's reliability or the advertised tier
 * list — both warrant a hard test failure rather than a soft "diagnostic
 * fields populated" pass.
 */

// 60s hard cap inside the worker + spin-up + render headroom.
const PER_TIER_TIMEOUT_MS = 75_000;

async function runTierCase(
  page: Page,
  variant: Variant,
  tier: string,
): Promise<void> {
  const slug = tier.toLowerCase();

  // --- Clean slate so no stale save short-circuits the new-game flow. ---
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  await expect(page.getByTestId('home-new-game')).toBeVisible();

  // --- Pick the variant + this tier and start. -------------------------
  await page.getByTestId(`home-variant-${variant.id}`).check();
  await page.getByTestId(`home-difficulty-${slug}`).check();
  await page.getByTestId('home-new-game').click();

  // --- Wait for the board to render. -----------------------------------
  // Strict-success contract: only the board appearing counts as a pass.
  // The 60s hard cap inside the worker means it must appear within ~70s.
  const board = page.getByTestId('sudoku-board');
  const failureDialog = page.getByTestId('generation-failed-dialog');

  await expect
    .poll(
      async () => {
        if (await board.isVisible()) return 'success';
        return 'pending';
      },
      { timeout: PER_TIER_TIMEOUT_MS - 5_000, intervals: [200, 500, 1_000] },
    )
    .toBe('success');

  // Success path: at least one given cell is rendered. We sample the
  // top-left 3×3 region — every variant has multiple givens, so finding
  // *any* non-empty cell here is a strong indicator the generator
  // produced a real board. (Mini's grid is 4×4 so a 3×3 sample is still
  // safely in-bounds.)
  let givenCount = 0;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const text = (await page.getByTestId(`cell-r${r}-c${c}`).textContent())
        ?.trim();
      if (text && text.length > 0) givenCount += 1;
    }
  }
  expect(
    givenCount,
    `${variant.id} ${tier}: board rendered but no given cells found in the top-left region`,
  ).toBeGreaterThan(0);

  // The failure dialog must NOT be visible at the end of the flow — its
  // appearance for any reason is a hard regression under the strict
  // success contract.
  await expect(
    failureDialog,
    `${variant.id} ${tier}: generation-failed-dialog appeared — strict-success contract violated`,
  ).not.toBeVisible();
}

function describeVariantMatrix(variant: Variant): void {
  const tiers = availableTiers(variant);

  test.describe.parallel(`${variant.id} difficulty matrix`, () => {
    for (const tier of tiers) {
      test(`${variant.id} + ${tier} loads a playable board`, async ({
        page,
      }) => {
        test.setTimeout(PER_TIER_TIMEOUT_MS);
        await runTierCase(page, variant, tier);
      });
    }
  });
}

// TASK-045a: Classic — advertised tiers per `variant-tiers.ts`.
describeVariantMatrix(variants.classic);

// TASK-045b: Six — advertised tiers per `variant-tiers.ts`.
describeVariantMatrix(variants.six);

// TASK-045c: Mini — advertised tiers per `variant-tiers.ts`.
describeVariantMatrix(variants.mini);
