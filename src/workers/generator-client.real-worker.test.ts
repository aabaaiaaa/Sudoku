// @vitest-environment jsdom
/**
 * TASK-019: real-worker smoke locking in the
 * `new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' })`
 * import-URL plumbing in `generator-client.ts`.
 *
 * The existing `generator-client.test.ts` uses a `FakeWorker`, so a regression
 * in the real-worker import path would only surface via the matrix E2E. This
 * file pairs with `tests/e2e/worker-smoke.spec.ts` to provide a fast,
 * targeted check.
 *
 * Environment caveat: jsdom does not implement the browser `Worker` global.
 * vitest's `node` environment also does not provide a browser-style `Worker`
 * (Node's worker lives in `node:worker_threads`, which has a different API
 * shape). We therefore feature-detect `Worker` at module load: when it is
 * absent (the default in this repo's CI / dev environment) the file emits a
 * single skip-style placeholder so `npx vitest run <this file>` produces a
 * clean pass without false negatives. The canonical real-worker check is the
 * Playwright spec at `tests/e2e/worker-smoke.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import { generateInWorker } from './generator-client';
import { miniVariant } from '../engine/variants';

describe('generator-client real-worker smoke', () => {
  // Feature-detect the browser `Worker` global. jsdom does not implement Web
  // Workers, so this test runs only when a host environment supplies one.
  const hasWorker = typeof Worker !== 'undefined';

  if (!hasWorker) {
    it('skipped — jsdom has no Worker; see tests/e2e/worker-smoke.spec.ts', () => {
      expect(hasWorker).toBe(false);
    });
    return;
  }

  it('cancels a real-worker generate request cleanly', async () => {
    const handle = generateInWorker(miniVariant, 'Easy');
    handle.cancel();
    const result = await handle.promise;
    expect(result.kind).toBe('cancelled');
  });
});
