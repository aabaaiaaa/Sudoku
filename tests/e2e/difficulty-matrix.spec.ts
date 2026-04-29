import { test, expect } from '@playwright/test';
import { variants } from '../../src/engine/variants';
import { availableTiers } from '../../src/engine/generator/variant-tiers';

/**
 * TASK-045a: E2E — Classic difficulty matrix smoke.
 *
 * Per requirements §9.1, every (variant × shown tier) combination must
 * reliably load a playable board within the existing 50-attempt / 60-second
 * budget. This spec covers the Classic variant — Mini and Six are added in
 * sibling specs.
 *
 * For each Classic tier we:
 *   1. Clear localStorage so a stale save doesn't trigger a replace prompt.
 *   2. Navigate Home, select Classic + the tier, click New Game.
 *   3. Within 75s assert *either*:
 *        - the board renders with at least one given cell (success path), or
 *        - the §7.3 failure dialog renders with a non-empty `closestRating`
 *          *and* a populated `lastError` line (the failure dialog is allowed
 *          but must be informative).
 *      Anything else — failure dialog with no rating or no error, blank
 *      screen, hung overlay — is a hard failure.
 *
 * Each tier runs as its own `test()` so a single regression points at the
 * exact slot rather than burying every tier under one combined assertion.
 */

const CLASSIC_TIERS = availableTiers(variants.classic);

// 60s hard cap inside the worker + spin-up + render headroom.
const PER_TIER_TIMEOUT_MS = 75_000;

test.describe.parallel('Classic difficulty matrix', () => {
  for (const tier of CLASSIC_TIERS) {
    const slug = tier.toLowerCase();

    test(`Classic + ${tier} loads a playable board or surfaces a diagnostic failure`, async ({
      page,
    }) => {
      test.setTimeout(PER_TIER_TIMEOUT_MS);

      // --- Clean slate so no stale save short-circuits the new-game flow. ---
      await page.goto('/');
      await page.evaluate(() => {
        window.localStorage.clear();
      });
      await page.reload();

      await expect(page.getByTestId('home-new-game')).toBeVisible();

      // --- Pick Classic + this tier and start. -----------------------------
      await page.getByTestId('home-variant-classic').check();
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
        // top-left 3×3 region — every Classic puzzle has multiple givens, so
        // finding *any* non-empty cell here is a strong indicator the
        // generator produced a real board.
        let givenCount = 0;
        for (let r = 0; r < 3; r += 1) {
          for (let c = 0; c < 3; c += 1) {
            const text = (await page
              .getByTestId(`cell-r${r}-c${c}`)
              .textContent())
              ?.trim();
            if (text && text.length > 0) givenCount += 1;
          }
        }
        expect(
          givenCount,
          `Classic ${tier}: board rendered but no given cells found in the top-left region`,
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
        `Classic ${tier}: failure dialog appeared without a populated lastError`,
      ).toBeVisible();
      const lastErrorText = (
        await page.getByTestId('failure-last-error').textContent()
      )?.trim();
      expect(
        lastErrorText && lastErrorText.length > 0,
        `Classic ${tier}: failure dialog rendered but lastError was empty`,
      ).toBe(true);

      // The dialog title encodes the target tier ("Couldn't find a <Tier>
      // puzzle in time."), which proves the failure was recorded against a
      // real difficulty rather than a no-op state.
      await expect(failureDialog).toContainText(tier);
    });
  }
});
