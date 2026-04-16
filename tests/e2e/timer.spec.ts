import { test, expect } from '@playwright/test';

/**
 * TASK-044: E2E — timer advances, manual pause/resume, and visibility
 * auto-pause.
 *
 * Flow:
 *  1. Start a Mini easy game from Home.
 *  2. Resume the timer (it starts paused after newGame) and verify the
 *     display advances past 00:00.
 *  3. Click Pause and verify the display freezes and the board is hidden.
 *  4. Click Resume and verify the board is visible again and the display
 *     resumes ticking.
 *  5. Dispatch a `visibilitychange` event while `document.hidden` returns
 *     true and verify the timer auto-pauses.
 */

const SAVE_STORAGE_KEY = 'sudoku.save.v1';

/** Reads the timer display text, trimmed. */
async function readDisplay(page: import('@playwright/test').Page): Promise<string> {
  const text = await page.getByTestId('timer-display').textContent();
  return (text ?? '').trim();
}

test('timer advances, pauses, resumes, and auto-pauses on visibility', async ({
  page,
}) => {
  // --- Clean slate so no prior save leaks between runs. --------------------
  await page.goto('/');
  await page.evaluate((key) => {
    window.localStorage.removeItem(key);
  }, SAVE_STORAGE_KEY);
  await page.reload();

  // --- Start a Mini easy game. ---------------------------------------------
  await page.getByTestId('home-variant-mini').check();
  await page.getByTestId('home-difficulty-easy').check();
  await page.getByTestId('home-new-game').click();

  const board = page.getByTestId('sudoku-board');
  await expect(board).toBeVisible();

  const toggle = page.getByTestId('timer-toggle');
  const display = page.getByTestId('timer-display');

  // --- Timer starts paused after newGame; kick it off. ---------------------
  await expect(toggle).toHaveText(/resume/i);
  await expect(display).toHaveText('00:00');
  await toggle.click();
  await expect(toggle).toHaveText(/pause/i);

  // --- Wait long enough for the once-per-second tick to advance. -----------
  await expect(display).not.toHaveText('00:00', { timeout: 3000 });
  const runningText = await readDisplay(page);
  expect(runningText).toMatch(/^\d{2}:\d{2}(:\d{2})?$/);
  expect(runningText).not.toBe('00:00');

  // --- Manual pause freezes the timer and hides the board. -----------------
  await toggle.click();
  await expect(toggle).toHaveText(/resume/i);
  await expect(board).toBeHidden();

  const pausedSnapshot = await readDisplay(page);
  await page.waitForTimeout(1200);
  const pausedAgain = await readDisplay(page);
  expect(pausedAgain).toBe(pausedSnapshot);

  // --- Resume restores the board. ------------------------------------------
  await toggle.click();
  await expect(toggle).toHaveText(/pause/i);
  await expect(board).toBeVisible();

  // Confirm the display starts ticking again.
  await expect.poll(() => readDisplay(page), { timeout: 3000 }).not.toBe(
    pausedSnapshot,
  );

  // --- Simulate the tab going hidden — timer should auto-pause. -----------
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(toggle).toHaveText(/resume/i);

  // The display should now be frozen (timer is paused).
  const autoPausedSnapshot = await readDisplay(page);
  await page.waitForTimeout(1200);
  const autoPausedAgain = await readDisplay(page);
  expect(autoPausedAgain).toBe(autoPausedSnapshot);
});
