import type { Difficulty, RateResult } from '../engine/generator/rate';
import type { Board, Variant } from '../engine/types';
import type { WorkerMessage, WorkerRequest } from './generator.worker';

/**
 * Progress payload mirrored from the worker's `progress` message
 * (requirements §6.3).
 */
export interface GeneratorProgress {
  attempt: number;
  max: number;
}

export interface GeneratorSuccess {
  kind: 'success';
  puzzle: Board;
  solution: Board;
  rating: RateResult;
}

export interface GeneratorFailure {
  kind: 'failed';
  closestRating: RateResult | null;
  attempts: number;
  elapsedMs: number;
  /**
   * Best-effort message from the most recent attempt that threw inside
   * `generateForDifficulty`. Mirrored from the worker's `failed` message so
   * the UI can surface finder bugs without crashing generation.
   */
  lastError?: string;
}

/** Worker reported a malformed request or an unexpected exception. */
export interface GeneratorError {
  kind: 'error';
  message: string;
}

/** The caller invoked `cancel()` before the worker produced a terminal result. */
export interface GeneratorCancelled {
  kind: 'cancelled';
}

export type GenResult =
  | GeneratorSuccess
  | GeneratorFailure
  | GeneratorError
  | GeneratorCancelled;

export interface GeneratorHandle {
  /** Resolves when the worker reports a terminal result or the caller cancels. */
  promise: Promise<GenResult>;
  /** Terminate the worker immediately and resolve `promise` with `kind: 'cancelled'`. */
  cancel: () => void;
  /**
   * Register a callback to receive `progress` events from the worker. Multiple
   * callbacks may be registered. Callbacks registered after a progress event
   * has already fired do not receive that event retroactively — register
   * before consuming the promise.
   */
  onProgress: (cb: (progress: GeneratorProgress) => void) => void;
}

/**
 * Minimal subset of the DOM `Worker` interface this module needs. Declared as
 * an interface so tests can supply a fake implementation (a queueing mock)
 * without instantiating a real worker.
 */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: WorkerMessage }) => void,
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: { data: WorkerMessage }) => void,
  ): void;
}

export interface GenerateInWorkerOptions {
  /**
   * Factory used to construct the worker. Tests pass a fake-worker factory;
   * production code uses the default which spins up the real generator
   * worker via Vite's `new URL(...)` worker pattern.
   */
  createWorker?: () => WorkerLike;
}

/**
 * Spawn a generator worker for the given variant + difficulty (requirements
 * §6.3). The returned handle exposes a Promise that resolves once the worker
 * reports a terminal result, a `cancel()` that terminates the worker
 * immediately, and an `onProgress` registrar for incremental UI updates.
 *
 * The worker is automatically terminated once a terminal result is received,
 * so callers do not need to call `cancel()` after `await`-ing the promise.
 */
export function generateInWorker(
  variant: Variant | string,
  difficulty: Difficulty,
  options: GenerateInWorkerOptions = {},
): GeneratorHandle {
  const variantId = typeof variant === 'string' ? variant : variant.id;
  const worker = (options.createWorker ?? defaultCreateWorker)();

  const progressListeners = new Set<(p: GeneratorProgress) => void>();
  let settled = false;
  let cancel: () => void = () => {};

  const promise = new Promise<GenResult>((resolve) => {
    const handler = (event: { data: WorkerMessage }): void => {
      if (settled) return;
      const msg = event.data;
      switch (msg.type) {
        case 'progress':
          for (const cb of progressListeners) cb({ attempt: msg.attempt, max: msg.max });
          break;
        case 'done':
          finish({
            kind: 'success',
            puzzle: msg.puzzle,
            solution: msg.solution,
            rating: msg.rating,
          });
          break;
        case 'failed':
          finish({
            kind: 'failed',
            closestRating: msg.closestRating,
            attempts: msg.attempts,
            elapsedMs: msg.elapsedMs,
            lastError: msg.lastError,
          });
          break;
        case 'error':
          finish({ kind: 'error', message: msg.message });
          break;
      }
    };

    const finish = (result: GenResult): void => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('message', handler);
      worker.terminate();
      resolve(result);
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'generate', variantId, difficulty });

    cancel = () => finish({ kind: 'cancelled' });
  });

  return {
    promise,
    cancel: () => cancel(),
    onProgress: (cb) => {
      progressListeners.add(cb);
    },
  };
}

function defaultCreateWorker(): WorkerLike {
  const w = new Worker(new URL('./generator.worker.ts', import.meta.url), {
    type: 'module',
  });
  return w as unknown as WorkerLike;
}
