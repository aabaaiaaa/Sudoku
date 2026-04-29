import { test, expect, type Page } from '@playwright/test';

/**
 * TASK-044: E2E — desktop navigation reachability.
 *
 * Iteration 2 hid the bottom tab bar at the Tailwind `sm` breakpoint so it was
 * unreachable at desktop viewports. Per requirements §7, the fix is to show
 * the bar at every viewport — the mobile UX is canonical, and the tab bar is
 * the only top-level nav.
 *
 * This test runs at the Playwright project's default desktop viewport (Chrome
 * and WebKit). It asserts:
 *   1. The tab bar is visible on Home.
 *   2. Clicking each of `tab-home`, `tab-stats`, `tab-learn`, `tab-settings`
 *      changes the URL hash and reveals the corresponding screen.
 *   3. The tab bar remains visible across all four screens.
 */

interface TabExpectation {
  tabId: string;
  hash: string;
  screenTestId: string;
}

const TABS: readonly TabExpectation[] = [
  { tabId: 'tab-home', hash: '#/home', screenTestId: 'home-new-game' },
  { tabId: 'tab-stats', hash: '#/stats', screenTestId: 'stats-reset' },
  { tabId: 'tab-learn', hash: '#/learn', screenTestId: 'techniques-screen' },
  { tabId: 'tab-settings', hash: '#/settings', screenTestId: 'settings-theme-picker' },
];

async function expectTabBarVisible(page: Page) {
  await expect(page.getByTestId('tab-bar')).toBeVisible();
}

test('bottom tab bar is reachable on desktop and navigates between top-level screens', async ({
  page,
}) => {
  // Clean slate so a stale save does not redirect or trigger the migration
  // dialog over the Home screen.
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  // Tab bar visible on Home from the very first paint.
  await expect(page.getByTestId('home-new-game')).toBeVisible();
  await expectTabBarVisible(page);

  for (const { tabId, hash, screenTestId } of TABS) {
    await page.getByTestId(tabId).click();

    // URL hash updates to the matching route.
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(hash);

    // Target screen renders — sniffed via a representative test id from each.
    await expect(page.getByTestId(screenTestId)).toBeVisible();

    // Tab bar must remain visible on every non-game screen so the player can
    // continue navigating.
    await expectTabBarVisible(page);
  }
});
