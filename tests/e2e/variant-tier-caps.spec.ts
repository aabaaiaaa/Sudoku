import { test, expect } from '@playwright/test';

/**
 * E2E — Difficulty picker hides infeasible tiers per variant.
 *
 * Iteration-7 §4.3 collapses the ladder to six tiers; the §11 contingency
 * then descoped classic:Master (solvedRate=0.04) and six:Medium (solvedRate=0.02)
 * in the final snapshot. The picker only exposes tiers each variant can
 * reliably produce — see `src/engine/generator/variant-tiers.ts`:
 *
 *   - Classic (9×9): Easy, Medium, Hard, Expert, Nightmare (5 tiers; Master
 *                    deferred to iteration 8)
 *   - Six (6×6):     Easy only (Medium descoped by §11; Hard+ unreachable)
 *   - Mini (4×4):    Easy only (harder tiers unreachable on the 4×4 grid)
 *
 * Switching the variant on Home must update the difficulty radio group to
 * match.
 */

const ALL_TIERS = [
  'easy',
  'medium',
  'hard',
  'expert',
  'master',
  'nightmare',
] as const;

const VARIANT_TIERS: Record<'classic' | 'six' | 'mini', readonly string[]> = {
  classic: ['easy', 'medium', 'hard', 'expert', 'nightmare'],
  six: ['easy'],
  mini: ['easy'],
};

test('Home difficulty picker hides infeasible tiers per variant', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  await expect(page.getByTestId('home-new-game')).toBeVisible();

  for (const variant of ['classic', 'six', 'mini'] as const) {
    await page.getByTestId(`home-variant-${variant}`).check();

    const expected = VARIANT_TIERS[variant];

    for (const tier of expected) {
      await expect(page.getByTestId(`home-difficulty-${tier}`)).toBeVisible();
    }

    for (const tier of ALL_TIERS) {
      if (expected.includes(tier)) continue;
      await expect(page.getByTestId(`home-difficulty-${tier}`)).toHaveCount(0);
    }
  }

  // --- Explicit Mini check: only Easy is exposed. ------------------------
  await page.getByTestId('home-variant-mini').check();
  for (const tier of [
    'medium',
    'hard',
    'expert',
    'master',
    'nightmare',
  ] as const) {
    await expect(page.getByTestId(`home-difficulty-${tier}`)).toHaveCount(0);
  }

  // Sanity: Mini exposes exactly 1 difficulty option.
  const miniRadios = page.locator(
    '[data-testid^="home-difficulty-"][type="radio"]',
  );
  await expect(miniRadios).toHaveCount(1);
});
