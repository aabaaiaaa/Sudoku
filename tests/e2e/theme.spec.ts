import { test, expect } from '@playwright/test';

/**
 * TASK-046: E2E — theme switch persists.
 *
 * Flow:
 *  1. Open the app and clear any previously-persisted settings so the test
 *     starts from a known baseline.
 *  2. Navigate to the Settings screen.
 *  3. Select the Notepad theme.
 *  4. Assert `document.documentElement` has `data-theme="notepad"`.
 *  5. Reload the page and assert the attribute is still `notepad`.
 *
 * The settings store persists under the key `sudoku.settings.v1`
 * (see `src/store/settings.ts`). The ThemeProvider writes the current theme
 * to the `data-theme` attribute on the root `<html>` element.
 */

const SETTINGS_STORAGE_KEY = 'sudoku.settings.v1';

test('selecting the Notepad theme persists across reload', async ({ page }) => {
  // --- Step 1: reset persisted settings. -----------------------------------
  await page.goto('/');
  await page.evaluate((key) => {
    window.localStorage.removeItem(key);
  }, SETTINGS_STORAGE_KEY);
  await page.reload();

  // --- Step 2: navigate to Settings. ---------------------------------------
  await page.goto('/settings');

  // --- Step 3: select the Notepad theme. -----------------------------------
  const notepadRadio = page.getByTestId('settings-theme-notepad');
  await notepadRadio.check();

  // --- Step 4: <html> element has data-theme="notepad". --------------------
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'notepad');

  // --- Step 5: reload and confirm persistence. -----------------------------
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'notepad');
});
