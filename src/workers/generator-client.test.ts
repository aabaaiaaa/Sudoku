import { describe, expect, it } from 'vitest';
import {
  generateInWorker,
  type WorkerLike,
} from './generator-client';
import type { WorkerMessage, WorkerRequest } from './generator.worker';
import type { Board, Variant } from '../engine/types';
import type { RateResult } from '../engine/generator/rate';

/**
 * Test double that records every `postMessage` call, exposes a `terminate`
 * flag, and lets the test push messages back to its registered listeners on
 * demand. Models the worker as a queue: messages are delivered synchronously
 * via `emit(...)`, mirroring the synchronous-on-this-microtask behaviour of
 * `MessageEvent` dispatch in tests.
 */
class FakeWorker implements WorkerLike {
  posted: WorkerRequest[] = [];
  terminated = false;
  private listeners = new Set<(event: { data: WorkerMessage }) => void>();

  postMessage(message: WorkerRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(
    _type: 'message',
    listener: (event: { data: WorkerMessage }) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: 'message',
    listener: (event: { data: WorkerMessage }) => void,
  ): void {
    this.listeners.delete(listener);
  }

  /** Test helper — dispatch a message back to every registered listener. */
  emit(message: WorkerMessage): void {
    for (const l of this.listeners) l({ data: message });
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

const fakeBoard: Board = { variant: { id: 'classic' } as Variant, cells: [] };
const fakeRating: RateResult = {
  difficulty: 'Easy',
  hardestTechnique: 'naked-single',
  techniquesUsed: ['naked-single'],
  solved: true,
  clueCount: 30,
};

describe('generateInWorker', () => {
  it('posts a generate request with the variant id and difficulty', () => {
    const fake = new FakeWorker();
    generateInWorker('classic', 'Master', { createWorker: () => fake });

    expect(fake.posted).toEqual([
      { type: 'generate', variantId: 'classic', difficulty: 'Master' },
    ]);
  });

  it('accepts a Variant object and extracts its id', () => {
    const fake = new FakeWorker();
    const variant = { id: 'six' } as Variant;
    generateInWorker(variant, 'Hard', { createWorker: () => fake });

    expect(fake.posted[0]).toMatchObject({ variantId: 'six', difficulty: 'Hard' });
  });

  it('forwards progress events to every registered listener', () => {
    const fake = new FakeWorker();
    const handle = generateInWorker('classic', 'Easy', { createWorker: () => fake });

    const a: Array<{ attempt: number; max: number }> = [];
    const b: Array<{ attempt: number; max: number }> = [];
    handle.onProgress((p) => a.push(p));
    handle.onProgress((p) => b.push(p));

    fake.emit({ type: 'progress', attempt: 1, max: 50 });
    fake.emit({ type: 'progress', attempt: 2, max: 50 });

    expect(a).toEqual([
      { attempt: 1, max: 50 },
      { attempt: 2, max: 50 },
    ]);
    expect(b).toEqual([
      { attempt: 1, max: 50 },
      { attempt: 2, max: 50 },
    ]);
  });

  it('resolves with success and terminates on a done message', async () => {
    const fake = new FakeWorker();
    const handle = generateInWorker('classic', 'Easy', { createWorker: () => fake });

    fake.emit({
      type: 'done',
      puzzle: fakeBoard,
      solution: fakeBoard,
      rating: fakeRating,
    });

    const result = await handle.promise;
    expect(result).toEqual({
      kind: 'success',
      puzzle: fakeBoard,
      solution: fakeBoard,
      rating: fakeRating,
    });
    expect(fake.terminated).toBe(true);
  });

  it('resolves with failure and terminates on a failed message', async () => {
    const fake = new FakeWorker();
    const handle = generateInWorker('classic', 'Master', {
      createWorker: () => fake,
    });

    fake.emit({
      type: 'failed',
      closestRating: fakeRating,
      attempts: 50,
      elapsedMs: 60_000,
    });

    const result = await handle.promise;
    expect(result).toEqual({
      kind: 'failed',
      closestRating: fakeRating,
      attempts: 50,
      elapsedMs: 60_000,
    });
    expect(fake.terminated).toBe(true);
  });

  it('resolves with error on an error message', async () => {
    const fake = new FakeWorker();
    const handle = generateInWorker('classic', 'Easy', { createWorker: () => fake });

    fake.emit({ type: 'error', message: 'Unknown variant: bogus' });

    const result = await handle.promise;
    expect(result).toEqual({ kind: 'error', message: 'Unknown variant: bogus' });
    expect(fake.terminated).toBe(true);
  });

  it('cancel() terminates the worker and resolves with cancelled', async () => {
    const fake = new FakeWorker();
    const handle = generateInWorker('classic', 'Nightmare', {
      createWorker: () => fake,
    });

    expect(fake.terminated).toBe(false);
    handle.cancel();

    const result = await handle.promise;
    expect(result).toEqual({ kind: 'cancelled' });
    expect(fake.terminated).toBe(true);
  });

  it('ignores worker messages received after cancel()', async () => {
    const fake = new FakeWorker();
    const handle = generateInWorker('classic', 'Easy', { createWorker: () => fake });

    const seen: Array<{ attempt: number; max: number }> = [];
    handle.onProgress((p) => seen.push(p));

    handle.cancel();
    // Simulate a message racing in after termination — should be ignored.
    fake.emit({ type: 'progress', attempt: 1, max: 50 });
    fake.emit({
      type: 'done',
      puzzle: fakeBoard,
      solution: fakeBoard,
      rating: fakeRating,
    });

    const result = await handle.promise;
    expect(result).toEqual({ kind: 'cancelled' });
    expect(seen).toEqual([]);
  });

  it('cancel() is a no-op once a terminal message has resolved the promise', async () => {
    const fake = new FakeWorker();
    const handle = generateInWorker('classic', 'Easy', { createWorker: () => fake });

    fake.emit({
      type: 'done',
      puzzle: fakeBoard,
      solution: fakeBoard,
      rating: fakeRating,
    });
    const result = await handle.promise;
    expect(result.kind).toBe('success');

    // terminate() was called once on the done path; cancel() must not throw
    // or change anything.
    expect(fake.terminated).toBe(true);
    handle.cancel();
    expect(fake.terminated).toBe(true);
  });

  it('removes its message listener once the promise has settled', async () => {
    const fake = new FakeWorker();
    const handle = generateInWorker('classic', 'Easy', { createWorker: () => fake });

    expect(fake.listenerCount).toBe(1);
    fake.emit({
      type: 'done',
      puzzle: fakeBoard,
      solution: fakeBoard,
      rating: fakeRating,
    });
    await handle.promise;
    expect(fake.listenerCount).toBe(0);
  });
});
