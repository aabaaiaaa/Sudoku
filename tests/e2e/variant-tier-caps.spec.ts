import { test, expect } from '@playwright/test';

/**
 * TASK-062: E2E — Difficulty picker hides infeasible tiers per variant.
 *
 * Per requirements §4.1, smaller grids cannot mathematically require advanced
 * techniques, so the Home picker only exposes the tiers each variant can
 * realistically produce:
 *
 *   - Classic (9×9): Easy → Nightmare (8 tiers)
 *   - Six (6×6):     Easy → Diabolical (6 tiers)
 *   - Mini (4×4):    Easy → Hard (3 tiers)
 *
 * Switching the variant on Home must update the difficulty radio group to
 * match the cap, hiding "Master" and above on Mini and Six (Six only hides
 * Demonic+).
 */

const ALL_TIERS = [
  'easy',
  'medium',
  'hard',
  'expert',
  'master',
  'diabolical',
  'demonic',
  'nightmare',
] as const;

const VARIANT_TIERS: Record<'classic' | 'six' | 'mini', readonly string[]> = {
  classic: ['easy', 'medium', 'hard', 'expert', 'master', 'diabolical', 'demonic', 'nightmare'],
  six: ['easy', 'medium', 'hard', 'expert', 'master', 'diabolical'],
  mini: ['easy', 'medium', 'hard'],
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

  // --- Explicit Mini check: no "Master+" buttons are exposed. --------------
  await page.getByTestId('home-variant-mini').check();
  for (const tier of ['master', 'diabolical', 'demonic', 'nightmare'] as const) {
    await expect(page.getByTestId(`home-difficulty-${tier}`)).toHaveCount(0);
  }

  // Sanity: Mini exposes exactly 3 difficulty options.
  const miniRadios = page.locator(
    '[data-testid^="home-difficulty-"][type="radio"]',
  );
  await expect(miniRadios).toHaveCount(3);
});
