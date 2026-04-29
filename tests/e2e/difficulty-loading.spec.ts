import { test, expect } from '@playwright/test';

/**
 * TASK-059 / TASK-037: E2E — observe spinner and cancel via the slow-generate
 * test hatch.
 *
 * Picks Classic + Demonic on Home and starts a new game with the
 * `?slowGenerate=15000` query param, which the worker client honours in DEV
 * builds (see `src/workers/generator-client.ts`) by pausing the worker for the
 * configured number of milliseconds before generating. That gives us a
 * deterministic 15-second window — well past the 200ms overlay debounce and
 * the 10s Cancel-button reveal threshold — during which the loading overlay
 * is observable and the Cancel button can be exercised.
 *
 * The hatch is a DEV-only branch (`import.meta.env.DEV`) and is stripped from
 * production bundles by Vite. `playwright.config.ts` runs the dev server, so
 * the hatch is active here.
 */

// 15s slow-generate + ~10s cancel-button wait + overhead. 30s is plenty.
const TEST_TIMEOUT_MS = 30_000;

test('Classic + Demonic shows spinner, reveals Cancel after delay, returns Home on cancel', async ({
  page,
}) => {
  test.setTimeout(TEST_TIMEOUT_MS);

  // Clean slate so an existing save doesn't trigger the "replace?" confirm.
  // We clear localStorage on a plain navigation first, then reload with the
  // slow-generate query param so the worker client picks it up.
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.goto('/?slowGenerate=15000');

  await expect(page.getByTestId('home-new-game')).toBeVisible();

  // --- Pick Classic + Demonic and start. -----------------------------------
  await page.getByTestId('home-variant-classic').check();
  await page.getByTestId('home-difficulty-demonic').check();
  await page.getByTestId('home-new-game').click();

  // --- Spinner overlay appears (after the 200ms debounce). -----------------
  const overlay = page.getByTestId('loading-overlay');
  await expect(overlay).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('loading-spinner')).toBeVisible();
  // The blurred grid behind the spinner is the empty board the Game screen
  // renders while generation runs in the worker.
  await expect(page.getByTestId('board-wrapper')).toBeVisible();

  // --- Cancel button fades in 10 seconds after the overlay appears. --------
  // Generous timeout because Demonic generation can keep running well past
  // 10s and we just need the threshold to elapse.
  const cancelButton = page.getByTestId('loading-cancel');
  await expect(cancelButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('loading-cancel-note')).toContainText(
    'Higher difficulties can take longer to generate.',
  );

  // --- Cancel terminates the worker and returns to Home. -------------------
  await cancelButton.click();

  await expect(page.getByTestId('home-new-game')).toBeVisible({ timeout: 5_000 });
  await expect(overlay).toHaveCount(0);
});
