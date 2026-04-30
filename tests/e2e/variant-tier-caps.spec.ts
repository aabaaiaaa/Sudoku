import { test, expect } from '@playwright/test';

/**
 * E2E — Difficulty picker hides infeasible tiers per variant.
 *
 * Iteration-7 §4.3 collapses the ladder to six tiers. The picker only exposes
 * tiers each variant can realistically produce — see
 * `src/engine/generator/variant-tiers.ts`:
 *
 *   - Classic (9×9): Easy, Medium, Hard, Expert, Master, Nightmare
 *                    (all six tiers advertised)
 *   - Six (6×6):     Easy, Medium (iteration-6 lever-2 rescue at clueFloor=14;
 *                    Hard+ remain unreachable on the 6×6 grid)
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
  classic: ['easy', 'medium', 'hard', 'expert', 'master', 'nightmare'],
  six: ['easy', 'medium'],
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
