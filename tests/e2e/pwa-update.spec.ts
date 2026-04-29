import { test, expect } from '@playwright/test';

/**
 * TASK-046: E2E — PWA "new version available" banner.
 *
 * Per requirements §8 + §9.4, the PWA must surface an update banner when a
 * newer Service Worker is installed in the background, and clicking the
 * banner's reload button must drive `updateSW(true)` so the new SW activates.
 *
 * Iteration 2 missed this entirely — the user had to use an incognito tab to
 * pick up new builds. This spec is a regression guard.
 *
 * The dev server does not emit a real SW manifest (Workbox treats dev as a
 * mock environment), so this spec runs against the `vite preview` server on
 * port 5180. `playwright.config.ts` starts that server alongside `vite dev`
 * for the rest of the suite.
 *
 * Strategy:
 *   1. Load the preview build and wait for the SW to register and reach
 *      the "controller" state.
 *   2. Install a `page.route` handler that bumps a Workbox-generated revision
 *      identifier in the next SW source fetch, so the browser sees the file
 *      as changed and starts installing a new SW.
 *   3. Trigger an update poll via the visibility-change handler (§8) — the
 *      app calls `r.update()` on `visibilityState === 'visible'`.
 *   4. Assert `[data-testid=update-banner]` becomes visible.
 *   5. Click `[data-testid=update-reload]` and assert that the click is
 *      wired to a real action (the page either reloads or we intercept the
 *      `updateSW(true)` call). We don't need to verify the new SW fully
 *      activates — only that the click path exists and fires.
 */

// Override the default dev baseURL — this whole file targets the preview
// server.
test.use({ baseURL: 'http://localhost:5180' });

const PREVIEW_BASE = 'http://localhost:5180';
// Vite is configured with `base: '/Sudoku/'` so the preview build lives under
// /Sudoku/ and the SW is registered at /Sudoku/sw.js.
const APP_PATH = '/Sudoku/';
const SW_URL = `${PREVIEW_BASE}${APP_PATH}sw.js`;

test('preview app shows update banner when SW source changes and reload click drives updateSW', async ({
  page,
}) => {
  test.setTimeout(60_000);

  // --- 1. Initial load + wait for SW to take control. ----------------------
  await page.goto(APP_PATH);
  await expect(page.getByTestId('home-new-game')).toBeVisible();

  // Wait for the SW to register and become the page's controller. Without
  // this, the update poll has nothing to compare against and the test races
  // the registration.
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('serviceWorker API unavailable in this browser context');
    }
    await navigator.serviceWorker.ready;
  });

  // --- 2. Intercept the next sw.js fetch and rewrite a revision marker. ----
  // Workbox embeds the precache manifest inline in sw.js with a `"revision":
  // "<hash>"` per asset. Bumping any revision is enough for the browser to
  // see the SW source as changed and start installing a new one. We rewrite
  // every revision string to the same fresh hash, which is a stronger change
  // than touching just one entry and avoids fragile per-asset matching.
  let interceptedSwBody = false;
  await page.route(SW_URL, async (route, request) => {
    const response = await page.request.fetch(request, {
      // Bypass the SW so we read the network copy, not a cached one.
      ignoreHTTPSErrors: true,
    });
    const status = response.status();
    if (status >= 400) {
      await route.fulfill({ response });
      return;
    }
    const original = await response.text();
    const bumped = original.replace(
      /"revision":"[^"]*"/g,
      `"revision":"playwright-bumped-${Date.now()}"`,
    );
    interceptedSwBody = bumped !== original;
    await route.fulfill({
      status,
      headers: response.headers(),
      body: bumped,
    });
  });

  // --- 3. Trigger an update poll. -----------------------------------------
  // `useUpdate.ts` calls `r.update()` on visibilitychange when the document
  // becomes visible. We toggle visibility off→on to drive that path. The
  // periodic 60s poll would also work, but waiting 60s in an E2E test is
  // wasteful when the same code path is exercised by the visibility handler.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // --- 4. Assert the banner appears. --------------------------------------
  // Generous timeout: SW install/waiting transitions are async and Workbox's
  // detection cycle can take a few seconds.
  const banner = page.getByTestId('update-banner');
  await expect(banner).toBeVisible({ timeout: 30_000 });
  expect(
    interceptedSwBody,
    'sw.js fetch was never intercepted; the route handler did not fire',
  ).toBe(true);

  // --- 5. Reload click is wired through. ----------------------------------
  // We don't rely on the page actually reloading — depending on the SW
  // lifecycle, `updateSW(true)` may activate the waiting SW and trigger a
  // reload, or it may complete silently. We instead capture that *something*
  // observable happens: either a `beforeunload` fires, or the page navigates
  // (load event), or the banner disappears once the worker takes over. Any
  // of those is sufficient evidence the click reached the wired handler.
  const reloadObserved = page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      const done = () => resolve(true);
      window.addEventListener('beforeunload', done, { once: true });
      window.addEventListener('pagehide', done, { once: true });
      // Fallback: if 8s elapse without a navigation event but the banner is
      // gone, that's still evidence the handler ran.
      setTimeout(() => resolve(false), 8_000);
    });
  });

  await page.getByTestId('update-reload').click();

  const sawReload = await reloadObserved;
  if (!sawReload) {
    // If neither navigation nor pagehide fired, the banner should at minimum
    // have been replaced with the post-update state.
    await expect(banner).toBeHidden({ timeout: 5_000 });
  }
});
