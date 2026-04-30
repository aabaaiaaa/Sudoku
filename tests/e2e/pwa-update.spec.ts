import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

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
 *   2. Write a modified sw.js to dist/ with bumped revision hashes. The
 *      preview server serves files from disk (no in-memory caching), so the
 *      next update-check fetch will receive the modified content. This is
 *      more reliable than `page.route()` / `context.route()`, because
 *      Chrome's SW self-update fetch goes through the browser's own SW
 *      network subsystem — it is not interceptable by Playwright's route
 *      handlers (which hook into the renderer's network stack only).
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

const APP_PATH = '/Sudoku/';

test('preview app shows update banner when SW source changes and reload click drives updateSW', async ({
  page,
}) => {
  test.setTimeout(60_000);

  // --- 1. Initial load + wait for SW to take control. ----------------------
  // Two-phase load: the first navigation installs and activates the SW, but
  // the SW does NOT call `clients.claim()`, so `navigator.serviceWorker.
  // controller` stays null for the lifetime of that page. A second navigation
  // to the same origin will be controlled immediately (the already-activated
  // SW intercepts the navigation before the page loads).
  //
  // This matters because Workbox's `messageSkipWaiting()` guards on
  // `registration.waiting` — if the current page has no controller, the new
  // bumped SW activates immediately without entering the "waiting" state, and
  // `messageSkipWaiting()` becomes a no-op. A reload after the first install
  // puts the SW in the controller seat so the bumped SW correctly waits.
  await page.goto(APP_PATH);
  await expect(page.getByTestId('home-new-game')).toBeVisible();
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('serviceWorker API unavailable in this browser context');
    }
    await navigator.serviceWorker.ready;
  });

  // Second navigation: SW is now the controller for this load.
  await page.goto(APP_PATH);
  await expect(page.getByTestId('home-new-game')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      throw new Error(
        'Expected SW to be the controller after second navigation — SW does not call clients.claim() so the controller is only set on subsequent navigations',
      );
    }
  });

  // --- 2. Write a modified sw.js to dist/ with bumped revision hashes. -----
  // Workbox embeds the precache manifest inline in sw.js using unquoted JS
  // object property keys: `revision:"<hash>"` (not `"revision":"<hash>"`).
  // Bumping every revision string ensures the browser sees the script as
  // changed and starts installing a new SW.
  const swDistPath = path.join(process.cwd(), 'dist', 'sw.js');
  const originalSw = fs.readFileSync(swDistPath, 'utf8');
  const bumpedSw = originalSw.replace(
    /revision:"[^"]*"/g,
    `revision:"playwright-bumped-${Date.now()}"`,
  );
  const didBump = bumpedSw !== originalSw;
  fs.writeFileSync(swDistPath, bumpedSw, 'utf8');

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
  expect(didBump, 'sw.js had no `revision` strings to bump').toBe(true);

  // --- 5. Reload click is wired through. ----------------------------------
  // Primary path: with a true SW controller established by the two-phase load,
  // Workbox's WorkboxWindow captures `isUpdate = true`. After
  // `messageSkipWaiting()` activates the new SW, the `controlling` event fires
  // with `isUpdate: true`, which drives `window.location.reload()`. We detect
  // that reload via `waitForNavigation`.
  //
  // Fallback path: in environments where `isUpdate` is false (e.g. the first
  // page load in a fresh SW install context), no reload fires. We verify the
  // click still dispatched the SKIP_WAITING message by spying on
  // `ServiceWorker.prototype.postMessage` — which IS writable in Chrome.

  // Register the navigation listener BEFORE clicking so we don't miss it.
  const navigationPromise = page
    .waitForNavigation({ timeout: 20_000, waitUntil: 'load' })
    .catch(() => null);

  // Install the SKIP_WAITING spy for the fallback path.
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__skipWaitingCalled = false;
    const orig = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function (
      this: ServiceWorker,
      message: unknown,
      ...rest: unknown[]
    ) {
      if (
        message !== null &&
        typeof message === 'object' &&
        (message as Record<string, unknown>).type === 'SKIP_WAITING'
      ) {
        (window as unknown as Record<string, unknown>).__skipWaitingCalled = true;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return orig.call(this, message, ...(rest as any[]));
    };
  });

  await page.getByTestId('update-reload').click();

  const navigated = await navigationPromise;
  if (navigated === null) {
    // No full-page reload within 20s (isUpdate was false in this context).
    // Verify the SKIP_WAITING message was at least dispatched to the waiting SW.
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).__skipWaitingCalled ===
        true,
      { timeout: 10_000 },
    );
  }
  // else: navigation happened — `window.location.reload()` fired as expected.

  // Restore sw.js after the click cycle. Restoring before this point would
  // cause the reloaded page to see a different sw.js and trigger another
  // update cycle, re-showing the banner.
  fs.writeFileSync(swDistPath, originalSw, 'utf8');
});
