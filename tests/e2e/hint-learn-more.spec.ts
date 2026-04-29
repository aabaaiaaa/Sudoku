import { test, expect } from '@playwright/test';

/**
 * TASK-061: E2E — Hint "Learn more" navigates to the matching technique page.
 *
 * Starts a Classic Easy game (generation is near-instant, so no spinner is
 * involved), opens the Hint panel, and clicks the "Learn more about Naked
 * Single →" link. Asserts both the URL hash and the rendered Technique Detail
 * page reflect the Naked Single entry.
 *
 * Easy puzzles are guaranteed to surface a Naked Single as the first hint:
 * `nextStep` walks techniques in increasing difficulty order, and an Easy
 * puzzle's hardest required step is Naked Single, so it always fires first.
 */

test('Hint Learn-more link navigates to the Naked Single detail page', async ({
  page,
}) => {
  // Clean slate so no prior save triggers the "replace?" confirm.
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  // --- Start a Classic Easy game. ------------------------------------------
  await page.getByTestId('home-variant-classic').check();
  await page.getByTestId('home-difficulty-easy').check();
  await page.getByTestId('home-new-game').click();

  // Easy generation completes well under the 200ms loading-overlay debounce,
  // so the board appears directly without a spinner intercepting clicks. We
  // additionally wait for the loading flag to clear so the board has actual
  // givens before we ask for a hint — otherwise nextStep runs against the
  // empty placeholder board and returns null.
  await expect(page.getByTestId('sudoku-board')).toBeVisible();
  await page.waitForFunction(() => {
    const store = (window as unknown as {
      __sudokuGameStore?: { getState: () => { loading: boolean; board: { cells: Array<Array<{ given: boolean }>> } } };
    }).__sudokuGameStore;
    if (!store) return false;
    const state = store.getState();
    if (state.loading) return false;
    return state.board.cells.some((row) => row.some((cell) => cell.given));
  });

  // --- Click Hint and wait for the panel. ----------------------------------
  await page.getByTestId('hint-button').click();

  const learnMore = page.getByTestId('hint-learn-more');
  await expect(learnMore).toBeVisible();
  // For an Easy puzzle, Naked Single is always the first technique returned.
  await expect(learnMore).toHaveText('Learn more about Naked Single →');
  await expect(learnMore).toHaveAttribute('href', '#/learn/naked-single');

  // --- Follow the link to the technique detail page. -----------------------
  await learnMore.click();

  await expect(page).toHaveURL(/#\/learn\/naked-single$/);

  const detail = page.getByTestId('technique-detail');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-technique-id', 'naked-single');
});
