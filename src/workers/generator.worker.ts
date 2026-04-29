import {
  generateForDifficulty,
  type GenerateForDifficultyResult,
} from '../engine/generator/generate-for-difficulty';
import type { Difficulty, RateResult } from '../engine/generator/rate';
import type { Board } from '../engine/types';
import { getVariant } from '../engine/variants';

/**
 * Inbound request: ask the worker to generate a puzzle of the given variant
 * at the given difficulty tier (requirements §6.3).
 */
export interface GenerateRequest {
  type: 'generate';
  variantId: string;
  difficulty: Difficulty;
}

export type WorkerRequest = GenerateRequest;

/** Emitted after each rejected attempt (1-based `attempt`). */
export interface ProgressMessage {
  type: 'progress';
  attempt: number;
  max: number;
}

/** Terminal success message — generation produced a puzzle at the target tier. */
export interface DoneMessage {
  type: 'done';
  puzzle: Board;
  solution: Board;
  rating: RateResult;
}

/** Terminal failure message — retry cap or hard timeout was hit. */
export interface FailedMessage {
  type: 'failed';
  closestRating: RateResult | null;
  attempts: number;
  elapsedMs: number;
  /**
   * Best-effort message from the most recent attempt that threw. Mirrors
   * `GenerationFailed.lastError` from `generate-for-difficulty.ts` so the UI
   * can surface finder bugs to users without crashing generation.
   */
  lastError?: string;
}

/** Posted when a request is malformed or generation throws unexpectedly. */
export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WorkerMessage =
  | ProgressMessage
  | DoneMessage
  | FailedMessage
  | ErrorMessage;

// Minimal shape of the dedicated worker global. Declared locally so this file
// type-checks without the `webworker` lib (which conflicts with `dom` if both
// are loaded). At runtime in a real worker, `self` exposes these methods.
interface WorkerScope {
  postMessage(message: WorkerMessage): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: WorkerRequest }) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

// One-at-a-time semantics (per task spec): JS in a worker is single-threaded
// and `generateForDifficulty` is synchronous, so a request runs to completion
// before the next queued `message` event fires. The flag below is a defensive
// guard against re-entrancy if generation is ever made async in the future.
let busy = false;

ctx.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'generate') {
    const received = (data as { type?: unknown } | null | undefined)?.type;
    ctx.postMessage({
      type: 'error',
      message: `Unknown request type: ${String(received ?? 'unknown')}`,
    });
    return;
  }

  if (busy) {
    ctx.postMessage({
      type: 'error',
      message: 'Worker is already processing a generation request',
    });
    return;
  }

  const variant = getVariant(data.variantId);
  if (!variant) {
    ctx.postMessage({
      type: 'error',
      message: `Unknown variant: ${data.variantId}`,
    });
    return;
  }

  busy = true;
  try {
    const result: GenerateForDifficultyResult = generateForDifficulty(
      variant,
      data.difficulty,
      {
        onProgress: ({ attempt, max }) => {
          ctx.postMessage({ type: 'progress', attempt, max });
        },
      },
    );

    if (result.kind === 'success') {
      ctx.postMessage({
        type: 'done',
        puzzle: result.puzzle,
        solution: result.solution,
        rating: result.rating,
      });
    } else {
      ctx.postMessage({
        type: 'failed',
        closestRating: result.closestRating,
        attempts: result.attempts,
        elapsedMs: result.elapsedMs,
        lastError: result.lastError,
      });
    }
  } catch (err) {
    // Diagnostic warn so a developer running locally can identify the
    // offender. Per-attempt errors are already contained inside
    // `generateForDifficulty`; reaching this catch indicates an unexpected
    // exception escaped — log message and stack before posting to the host.
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.warn('[generator.worker] unhandled exception:', message, stack);
    ctx.postMessage({
      type: 'error',
      message,
    });
  } finally {
    busy = false;
  }
});
