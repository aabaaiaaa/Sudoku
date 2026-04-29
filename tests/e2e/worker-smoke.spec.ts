import { test, expect } from '@playwright/test';

/**
 * TASK-019: real-worker plumbing smoke.
 *
 * Locks in the
 * `new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' })`
 * import URL in `src/workers/generator-client.ts` end-to-end. A regression
 * here (e.g. a typo in the URL, a build-config change that breaks Vite's
 * worker plugin) would otherwise surface only via the matrix E2E, which is
 * far slower and noisier.
 *
 * Pairs with `src/workers/generator-client.real-worker.test.ts`, which would
 * run the same smoke under vitest if jsdom implemented Web Workers — it
 * doesn't, so this Playwright spec is the canonical evidence the URL works.
 *
 * The smoke picks Mini + Easy because that combination is the fastest to
 * generate across all (variant, difficulty) pairs, keeping the spec well
 * under the 30s budget below.
 */
test('real worker plumbing — Mini Easy generates a board', async ({ page }) => {
  await page.goto('/');

  // Clear any prior save so the new-game flow runs unconditionally rather
  // than prompting a replace-confirmation dialog.
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  await page.getByTestId('home-variant-mini').check();
  await page.getByTestId('home-difficulty-easy').check();
  await page.getByTestId('home-new-game').click();

  // The board only renders once the worker posts a `done` message, so this
  // assertion exercises the full request → worker → response path and
  // proves the import URL resolves.
  await expect(page.getByTestId('sudoku-board')).toBeVisible({ timeout: 30_000 });
});
