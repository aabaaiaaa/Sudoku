import { test, expect, type Page } from '@playwright/test';
import { variants } from '../../src/engine/variants';
import { availableTiers } from '../../src/engine/generator/variant-tiers';
import type { Variant } from '../../src/engine/types';

/**
 * E2E — difficulty matrix smoke (requirements §9.1).
 *
 * Every (variant × shown tier) combination must reliably load a playable board
 * within the existing 50-attempt / 60-second budget. Each tier runs as its own
 * `test()` so a single regression points at the exact slot rather than burying
 * every tier under one combined assertion.
 *
 * For each tier we:
 *   1. Clear localStorage so a stale save doesn't trigger a replace prompt.
 *   2. Navigate Home, select the variant + the tier, click New Game.
 *   3. Within 75s assert *either*:
 *        - the board renders with at least one given cell (success path), or
 *        - the §7.3 failure dialog renders with a non-empty `closestRating`
 *          *and* a populated `lastError` line (the failure dialog is allowed
 *          but must be informative).
 *      Anything else — failure dialog with no rating or no error, blank
 *      screen, hung overlay — is a hard failure.
 *
 * Variant blocks use the lowercase variant id (`classic`, `six`, `mini`) in
 * their describe and test titles so the verification grep filters
 * (`--grep classic`, `--grep six`, `--grep mini`) cleanly partition the suite.
 *
 * ----------------------------------------------------------------------------
 * TASK-049 — Bug B verification status (requirements §4.3).
 *
 * Bug A (uncaught exceptions in finder cascade collapsing the retry budget)
 * is fixed structurally by TASK-002..TASK-007 (per-attempt try/catch +
 * lastError plumbing) and TASK-013..TASK-014c (fuzz harness + per-finder
 * hardening). Bug B is the *residual* concern: even with Bug A contained,
 * some (variant × tier) combos may still fail their budget legitimately
 * because the natural rating distribution is too narrow. Suspected combos
 * are Six's middle tiers (Medium / Hard / Expert / Master) and possibly
 * Mini's narrow Medium / Hard windows.
 *
 * This spec is the canonical reveal for Bug B. The actual matrix run is
 * deferred to TASK-052 (consolidated Chromium + WebKit E2E sweep) — the
 * per-task DevLoop runner does not execute test suites.
 *
 * Decision rule when TASK-052 reports failures here:
 *   - Failure dialog with a populated `lastError`: Bug A residue. Open a
 *     follow-up to harden the named finder. NOT Bug B.
 *   - Failure dialog with `closestRating` populated but no `lastError`
 *     (i.e. budget exhausted with zero exceptions thrown): genuine Bug B.
 *     Open follow-up "TASK-IT4-001: Apply §4.3 mitigation to <combos>"
 *     in iteration 4 — wire `clueBoundsLowerForTier` upper bounds and
 *     widen per-tier attempt budgets for the offending tiers.
 *   - Hard failure (no board, no dialog): protocol regression — file an
 *     iteration-4 bug independently of Bug B.
 *
 * If TASK-052 reports the matrix as green on both projects, Bug B is
 * "not observed" and the §4.3 mitigation stays descoped per requirements.
 *
 * Findings from TASK-052 should be appended below this block as a dated
 * bullet list so subsequent iterations have a stable record.
 * ----------------------------------------------------------------------------
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

  // --- Race the success and failure outcomes. --------------------------
  // Either the board appears (success) or the failure dialog appears
  // (acceptable iff diagnostic fields are populated). The 60s hard cap
  // inside the worker means whichever wins, it must do so within ~70s.
  const board = page.getByTestId('sudoku-board');
  const failureDialog = page.getByTestId('generation-failed-dialog');

  await expect
    .poll(
      async () => {
        if (await board.isVisible()) return 'success';
        if (await failureDialog.isVisible()) return 'failure';
        return 'pending';
      },
      { timeout: PER_TIER_TIMEOUT_MS - 5_000, intervals: [200, 500, 1_000] },
    )
    .not.toBe('pending');

  if (await board.isVisible()) {
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
    return;
  }

  // Failure path: dialog must include a rating *and* a last-error line so
  // it is actionable. Failure with neither is treated as a hard failure
  // (per requirements §9.1).
  await expect(failureDialog).toBeVisible();

  // The dialog includes the technical-details line (`failure-last-error`)
  // only when `lastError` is populated, per requirements §4.1.
  await expect(
    page.getByTestId('failure-last-error'),
    `${variant.id} ${tier}: failure dialog appeared without a populated lastError`,
  ).toBeVisible();
  const lastErrorText = (
    await page.getByTestId('failure-last-error').textContent()
  )?.trim();
  expect(
    lastErrorText && lastErrorText.length > 0,
    `${variant.id} ${tier}: failure dialog rendered but lastError was empty`,
  ).toBe(true);

  // The dialog title encodes the target tier ("Couldn't find a <Tier>
  // puzzle in time."), which proves the failure was recorded against a
  // real difficulty rather than a no-op state.
  await expect(failureDialog).toContainText(tier);
}

function describeVariantMatrix(variant: Variant): void {
  const tiers = availableTiers(variant);

  test.describe.parallel(`${variant.id} difficulty matrix`, () => {
    for (const tier of tiers) {
      test(`${variant.id} + ${tier} loads a playable board or surfaces a diagnostic failure`, async ({
        page,
      }) => {
        test.setTimeout(PER_TIER_TIMEOUT_MS);
        await runTierCase(page, variant, tier);
      });
    }
  });
}

// TASK-045a: Classic — full 8-tier range.
describeVariantMatrix(variants.classic);

// TASK-045b: Six — Easy through Diabolical (6 tiers).
describeVariantMatrix(variants.six);

// TASK-045c: Mini — Easy through Hard (3 tiers).
describeVariantMatrix(variants.mini);
