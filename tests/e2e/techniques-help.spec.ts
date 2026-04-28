import { test, expect } from '@playwright/test';

/**
 * TASK-060: E2E — Learn tab walkthrough.
 *
 * Opens the Learn tab from the bottom tab bar, navigates into the Hidden Single
 * detail page, drives the three walkthrough buttons in order, resets, and
 * returns to the techniques index.
 *
 * The Hidden Single fixture places digit 9 at (0,0); pre-`Apply` the cell is
 * empty and post-`Apply` it shows "9", which is the cleanest "visible board
 * change" Playwright can observe. Earlier steps surface their state through the
 * walkthrough panel and the `data-walkthrough-step` attribute on the detail
 * container — both are user-visible signals of state advancement.
 *
 * The bottom tab bar is `sm:hidden` (visible only below Tailwind's 640px sm
 * breakpoint), so a mobile-sized viewport is set explicitly to make the Learn
 * tab clickable. The default Desktop Chrome viewport would hide it.
 */

test.use({ viewport: { width: 390, height: 844 } });

test('Learn tab → Hidden Single walkthrough → reset → back to index', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  // --- Open the Learn tab from the bottom tab bar. -------------------------
  const learnTab = page.getByTestId('tab-learn');
  await expect(learnTab).toBeVisible();
  await learnTab.click();

  await expect(page.getByTestId('techniques-screen')).toBeVisible();

  // --- Click into Hidden Single. -------------------------------------------
  await page.getByTestId('technique-row-hidden-single').click();

  const detail = page.getByTestId('technique-detail');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-technique-id', 'hidden-single');
  await expect(detail).toHaveAttribute('data-walkthrough-step', 'initial');

  // The fixture places 9 at (0,0); confirm the starting cell is empty.
  const target = page.getByTestId('cell-r0-c0');
  await expect(target).toHaveText('');

  const stepText = page.getByTestId('walkthrough-step');
  await expect(stepText).toContainText('Tap Highlight pattern to begin.');

  // --- Step 1: Highlight pattern. ------------------------------------------
  await page.getByTestId('walkthrough-highlight').click();
  await expect(detail).toHaveAttribute('data-walkthrough-step', 'pattern');
  await expect(page.getByTestId('walkthrough-pattern-cells')).toContainText(
    'r1c1',
  );

  // --- Step 2: Show deduction. ---------------------------------------------
  await page.getByTestId('walkthrough-show-deduction').click();
  await expect(detail).toHaveAttribute('data-walkthrough-step', 'deduction');
  // Hidden Single is a placement deduction; the panel should announce it.
  await expect(page.getByTestId('walkthrough-deduction')).toContainText(
    'Place 9 at r1c1',
  );

  // --- Step 3: Apply. ------------------------------------------------------
  await page.getByTestId('walkthrough-apply').click();
  await expect(detail).toHaveAttribute('data-walkthrough-step', 'applied');
  // The placement is now visible on the live mini-board.
  await expect(target).toHaveText('9');

  // --- Reset returns the board to the initial fixture state. ---------------
  await page.getByTestId('walkthrough-reset').click();
  await expect(detail).toHaveAttribute('data-walkthrough-step', 'initial');
  await expect(target).toHaveText('');
  await expect(stepText).toContainText('Tap Highlight pattern to begin.');

  // --- Back navigation returns to the index. -------------------------------
  await page.getByTestId('technique-detail-back').click();
  await expect(page.getByTestId('techniques-screen')).toBeVisible();
  await expect(page.getByTestId('technique-row-hidden-single')).toBeVisible();
});
