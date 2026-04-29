# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa-update.spec.ts >> preview app shows update banner when SW source changes and reload click drives updateSW
- Location: tests\e2e\pwa-update.spec.ts:43:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('update-banner')
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for getByTestId('update-banner')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - heading "New game" [level=1] [ref=e5]
    - generic [ref=e6]:
      - heading "Variant" [level=2] [ref=e7]
      - radiogroup "Variant" [ref=e8]:
        - generic [ref=e9]:
          - radio "Classic" [checked] [ref=e10]
          - generic [ref=e11]: Classic
        - generic [ref=e12]:
          - radio "Mini" [ref=e13]
          - generic [ref=e14]: Mini
        - generic [ref=e15]:
          - radio "Six" [ref=e16]
          - generic [ref=e17]: Six
    - generic [ref=e18]:
      - heading "Difficulty" [level=2] [ref=e19]
      - radiogroup "Difficulty" [ref=e20]:
        - generic [ref=e21]:
          - radio "Easy" [checked] [ref=e22]
          - generic [ref=e23]: Easy
        - generic [ref=e24]:
          - radio "Medium" [ref=e25]
          - generic [ref=e26]: Medium
        - generic [ref=e27]:
          - radio "Expert" [ref=e28]
          - generic [ref=e29]: Expert
        - generic [ref=e30]:
          - radio "Diabolical" [ref=e31]
          - generic [ref=e32]: Diabolical
        - generic [ref=e33]:
          - radio "Demonic" [ref=e34]
          - generic [ref=e35]: Demonic
        - generic [ref=e36]:
          - radio "Nightmare" [ref=e37]
          - generic [ref=e38]: Nightmare
    - button "➕ New Game" [ref=e40] [cursor=pointer]
  - navigation "Primary" [ref=e41]:
    - button "Home" [ref=e42] [cursor=pointer]
    - button "Stats" [ref=e43] [cursor=pointer]
    - button "Learn" [ref=e44] [cursor=pointer]
    - button "Settings" [ref=e45] [cursor=pointer]
```

# Test source

```ts
  14  |  * mock environment), so this spec runs against the `vite preview` server on
  15  |  * port 5180. `playwright.config.ts` starts that server alongside `vite dev`
  16  |  * for the rest of the suite.
  17  |  *
  18  |  * Strategy:
  19  |  *   1. Load the preview build and wait for the SW to register and reach
  20  |  *      the "controller" state.
  21  |  *   2. Install a `page.route` handler that bumps a Workbox-generated revision
  22  |  *      identifier in the next SW source fetch, so the browser sees the file
  23  |  *      as changed and starts installing a new SW.
  24  |  *   3. Trigger an update poll via the visibility-change handler (§8) — the
  25  |  *      app calls `r.update()` on `visibilityState === 'visible'`.
  26  |  *   4. Assert `[data-testid=update-banner]` becomes visible.
  27  |  *   5. Click `[data-testid=update-reload]` and assert that the click is
  28  |  *      wired to a real action (the page either reloads or we intercept the
  29  |  *      `updateSW(true)` call). We don't need to verify the new SW fully
  30  |  *      activates — only that the click path exists and fires.
  31  |  */
  32  | 
  33  | // Override the default dev baseURL — this whole file targets the preview
  34  | // server.
  35  | test.use({ baseURL: 'http://localhost:5180' });
  36  | 
  37  | const PREVIEW_BASE = 'http://localhost:5180';
  38  | // Vite is configured with `base: '/Sudoku/'` so the preview build lives under
  39  | // /Sudoku/ and the SW is registered at /Sudoku/sw.js.
  40  | const APP_PATH = '/Sudoku/';
  41  | const SW_URL = `${PREVIEW_BASE}${APP_PATH}sw.js`;
  42  | 
  43  | test('preview app shows update banner when SW source changes and reload click drives updateSW', async ({
  44  |   page,
  45  | }) => {
  46  |   test.setTimeout(60_000);
  47  | 
  48  |   // --- 1. Initial load + wait for SW to take control. ----------------------
  49  |   await page.goto(APP_PATH);
  50  |   await expect(page.getByTestId('home-new-game')).toBeVisible();
  51  | 
  52  |   // Wait for the SW to register and become the page's controller. Without
  53  |   // this, the update poll has nothing to compare against and the test races
  54  |   // the registration.
  55  |   await page.evaluate(async () => {
  56  |     if (!('serviceWorker' in navigator)) {
  57  |       throw new Error('serviceWorker API unavailable in this browser context');
  58  |     }
  59  |     await navigator.serviceWorker.ready;
  60  |   });
  61  | 
  62  |   // --- 2. Intercept the next sw.js fetch and rewrite a revision marker. ----
  63  |   // Workbox embeds the precache manifest inline in sw.js with a `"revision":
  64  |   // "<hash>"` per asset. Bumping any revision is enough for the browser to
  65  |   // see the SW source as changed and start installing a new one. We rewrite
  66  |   // every revision string to the same fresh hash, which is a stronger change
  67  |   // than touching just one entry and avoids fragile per-asset matching.
  68  |   let interceptedSwBody = false;
  69  |   await page.route(SW_URL, async (route, request) => {
  70  |     const response = await page.request.fetch(request, {
  71  |       // Bypass the SW so we read the network copy, not a cached one.
  72  |       ignoreHTTPSErrors: true,
  73  |     });
  74  |     const status = response.status();
  75  |     if (status >= 400) {
  76  |       await route.fulfill({ response });
  77  |       return;
  78  |     }
  79  |     const original = await response.text();
  80  |     const bumped = original.replace(
  81  |       /"revision":"[^"]*"/g,
  82  |       `"revision":"playwright-bumped-${Date.now()}"`,
  83  |     );
  84  |     interceptedSwBody = bumped !== original;
  85  |     await route.fulfill({
  86  |       status,
  87  |       headers: response.headers(),
  88  |       body: bumped,
  89  |     });
  90  |   });
  91  | 
  92  |   // --- 3. Trigger an update poll. -----------------------------------------
  93  |   // `useUpdate.ts` calls `r.update()` on visibilitychange when the document
  94  |   // becomes visible. We toggle visibility off→on to drive that path. The
  95  |   // periodic 60s poll would also work, but waiting 60s in an E2E test is
  96  |   // wasteful when the same code path is exercised by the visibility handler.
  97  |   await page.evaluate(() => {
  98  |     Object.defineProperty(document, 'visibilityState', {
  99  |       configurable: true,
  100 |       get: () => 'hidden',
  101 |     });
  102 |     document.dispatchEvent(new Event('visibilitychange'));
  103 |     Object.defineProperty(document, 'visibilityState', {
  104 |       configurable: true,
  105 |       get: () => 'visible',
  106 |     });
  107 |     document.dispatchEvent(new Event('visibilitychange'));
  108 |   });
  109 | 
  110 |   // --- 4. Assert the banner appears. --------------------------------------
  111 |   // Generous timeout: SW install/waiting transitions are async and Workbox's
  112 |   // detection cycle can take a few seconds.
  113 |   const banner = page.getByTestId('update-banner');
> 114 |   await expect(banner).toBeVisible({ timeout: 30_000 });
      |                        ^ Error: expect(locator).toBeVisible() failed
  115 |   expect(
  116 |     interceptedSwBody,
  117 |     'sw.js fetch was never intercepted; the route handler did not fire',
  118 |   ).toBe(true);
  119 | 
  120 |   // --- 5. Reload click is wired through. ----------------------------------
  121 |   // We don't rely on the page actually reloading — depending on the SW
  122 |   // lifecycle, `updateSW(true)` may activate the waiting SW and trigger a
  123 |   // reload, or it may complete silently. We instead capture that *something*
  124 |   // observable happens: either a `beforeunload` fires, or the page navigates
  125 |   // (load event), or the banner disappears once the worker takes over. Any
  126 |   // of those is sufficient evidence the click reached the wired handler.
  127 |   const reloadObserved = page.evaluate(() => {
  128 |     return new Promise<boolean>((resolve) => {
  129 |       const done = () => resolve(true);
  130 |       window.addEventListener('beforeunload', done, { once: true });
  131 |       window.addEventListener('pagehide', done, { once: true });
  132 |       // Fallback: if 8s elapse without a navigation event but the banner is
  133 |       // gone, that's still evidence the handler ran.
  134 |       setTimeout(() => resolve(false), 8_000);
  135 |     });
  136 |   });
  137 | 
  138 |   await page.getByTestId('update-reload').click();
  139 | 
  140 |   const sawReload = await reloadObserved;
  141 |   if (!sawReload) {
  142 |     // If neither navigation nor pagehide fired, the banner should at minimum
  143 |     // have been replaced with the post-update state.
  144 |     await expect(banner).toBeHidden({ timeout: 5_000 });
  145 |   }
  146 | });
  147 | 
```