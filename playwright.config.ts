import { defineConfig, devices } from '@playwright/test';

/**
 * The PWA update spec (`pwa-update.spec.ts`, requirements §9.4) needs a real
 * Service Worker manifest, which only the production build emits — `vite dev`
 * does not. We therefore start two servers in parallel:
 *
 *   - `vite dev` on :5179 for the rest of the suite (the default `baseURL`).
 *   - `vite build && vite preview` on :5180 for the PWA spec, which opts in
 *     via `test.use({ baseURL: ... })` at the top of the file.
 *
 * Both servers must be reachable before the suite runs. Playwright's array
 * form for `webServer` waits for every entry's `url` to respond before
 * dispatching tests.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5179',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5179',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build && npm run preview -- --port 5180 --strictPort',
      url: 'http://localhost:5180',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
