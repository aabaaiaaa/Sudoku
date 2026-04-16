import { test, expect } from '@playwright/test';

/**
 * TASK-045: E2E — resume saved game after reload.
 *
 * Flow:
 *  1. Open Home, start a new Classic Sudoku game.
 *  2. Place a few digits on the board (onto empty cells).
 *  3. Reload the page.
 *  4. Confirm a "Resume" card appears for Classic on Home.
 *  5. Click the Resume card.
 *  6. Assert previously-placed digits are restored on the board.
 *
 * Selectors: prefer accessible/role-based selectors plus the existing
 * `data-testid` attributes already present in Home, Board, and NumberPad
 * components (e.g. `home-new-game`, `home-variant-classic`, `cell-r{r}-c{c}`,
 * `pad-digit-{d}`, `home-resume-classic`).
 */

type Placement = { row: number; col: number; digit: number };

/**
 * Finds up to `count` empty, non-given cells in the current board and returns
 * placements that assign digit 1..count to them in order. Empty cells are
 * detected by checking that the cell button has no visible number (text is
 * empty after trimming).
 *
 * We avoid picking cells that already contain a given digit or pencil marks.
 */
async function pickEmptyCells(
  page: import('@playwright/test').Page,
  size: number,
  count: number,
): Promise<Placement[]> {
  const placements: Placement[] = [];
  let digit = 1;
  for (let r = 0; r < size && placements.length < count; r++) {
    for (let c = 0; c < size && placements.length < count; c++) {
      const cell = page.getByTestId(`cell-r${r}-c${c}`);
      const text = (await cell.textContent())?.trim() ?? '';
      if (text === '') {
        placements.push({ row: r, col: c, digit });
        // Increment digit but keep it within 1..9. If we run out, reuse 1 —
        // the engine may reject duplicates but that's fine for this test
        // because we only assert cells that we successfully placed.
        digit = digit >= 9 ? 1 : digit + 1;
      }
    }
  }
  return placements;
}

test('resumes a saved Classic game after page reload', async ({ page }) => {
  // Ensure a clean slate so no prior save leaks between tests.
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('sudoku.save.v1');
  });
  await page.reload();

  // --- Step 1: start a new Classic game. ------------------------------------
  // Select the Classic variant radio (it's the default, but click for safety).
  const classicRadio = page.getByTestId('home-variant-classic');
  await classicRadio.check();

  // Pick an easy difficulty to keep the test deterministic-ish.
  await page.getByTestId('home-difficulty-easy').check();

  // Start the game.
  await page.getByTestId('home-new-game').click();

  // Wait for the board to appear.
  const board = page.getByTestId('sudoku-board');
  await expect(board).toBeVisible();

  // --- Step 2: place a few digits into empty cells. -------------------------
  const CLASSIC_SIZE = 9;
  const placements = await pickEmptyCells(page, CLASSIC_SIZE, 3);
  expect(placements.length).toBeGreaterThan(0);

  for (const { row, col, digit } of placements) {
    await page.getByTestId(`cell-r${row}-c${col}`).click();
    await page.getByTestId(`pad-digit-${digit}`).click();
    // Sanity check that the digit landed in the cell before we reload.
    await expect(page.getByTestId(`cell-r${row}-c${col}`)).toContainText(String(digit));
  }

  // --- Step 3: reload the page. --------------------------------------------
  await page.reload();
  // The app auto-navigates to the Game screen via the hash (`#/game`) when a
  // game is active, and reload preserves that hash. Return to Home so the
  // Resume card is visible.
  await page.evaluate(() => {
    window.location.hash = '#/home';
  });
  const resumeHeading = page.getByRole('heading', { name: 'Resume' });
  await expect(resumeHeading).toBeVisible();

  const resumeCard = page.getByTestId('home-resume-classic');
  await expect(resumeCard).toBeVisible();
  await expect(resumeCard).toContainText('Classic');
  await expect(
    page.getByTestId('home-resume-classic-difficulty'),
  ).toHaveText(/easy/i);

  // --- Step 5: click the Resume card. --------------------------------------
  await resumeCard.click();

  // Board should be visible again.
  await expect(board).toBeVisible();

  // --- Step 6: previously-placed digits should still be present. -----------
  for (const { row, col, digit } of placements) {
    await expect(page.getByTestId(`cell-r${row}-c${col}`)).toContainText(
      String(digit),
    );
  }
});
