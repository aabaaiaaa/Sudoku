import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { statsStore } from '../store/stats';
import { isComplete } from '../engine/board';

interface WinModalProps {
  /** Optional game store override, primarily for tests. */
  store?: typeof gameStore;
  /** Optional stats store override, primarily for tests. */
  statsStore?: typeof statsStore;
  /** Invoked when the user clicks "New Game". */
  onNewGame?: () => void;
  /** Invoked when the user clicks "Home". */
  onHome?: () => void;
}

/** Frozen snapshot of the stats captured when the modal first opened. */
interface FrozenSnapshot {
  timeMs: number;
  mistakes: number;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function elapsedMsOf(timer: {
  startTs: number | null;
  accumulatedMs: number;
}): number {
  return (
    timer.accumulatedMs + (timer.startTs == null ? 0 : Date.now() - timer.startTs)
  );
}

export function WinModal({
  store = gameStore,
  statsStore: statsStoreProp = statsStore,
  onNewGame,
  onHome,
}: WinModalProps) {
  const board = useStore(store, (s) => s.board);
  const timer = useStore(store, (s) => s.timer);
  const mistakes = useStore(store, (s) => s.mistakes);
  const difficulty = useStore(store, (s) => s.difficulty);

  const complete = isComplete(board);

  // Tracks whether we've already recorded stats for this completion instance.
  // Reset when the board transitions back to non-complete (i.e. new game).
  const recordedRef = useRef<boolean>(false);
  const [snapshot, setSnapshot] = useState<FrozenSnapshot | null>(null);

  useEffect(() => {
    if (!complete) {
      // Reset so a subsequent completion (e.g. next puzzle) records again.
      recordedRef.current = false;
      if (snapshot !== null) setSnapshot(null);
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;

    const timeMs = elapsedMsOf(timer);
    const frozen: FrozenSnapshot = { timeMs, mistakes };
    setSnapshot(frozen);

    statsStoreProp.getState().recordCompletion({
      variant: board.variant.id,
      difficulty,
      timeMs,
      mistakes,
    });
    store.getState().completeGame();
    // We intentionally only depend on `complete` — the snapshot must be
    // captured at the transition moment and remain stable afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  if (!complete) return null;

  // Fall back to a live read if the snapshot hasn't been set yet (shouldn't
  // happen in practice since the effect runs synchronously after render).
  const displayTimeMs = snapshot?.timeMs ?? elapsedMsOf(timer);
  const displayMistakes = snapshot?.mistakes ?? mistakes;

  return (
    <div
      data-testid="win-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="win-modal-title"
      className="fixed inset-0 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded shadow-lg p-6 min-w-[260px] max-w-sm">
        <h2
          id="win-modal-title"
          className="text-lg font-semibold mb-3 text-gray-900"
        >
          Puzzle Complete!
        </h2>
        <dl className="text-sm text-gray-700 mb-4 space-y-1">
          <div className="flex justify-between">
            <dt>Time</dt>
            <dd data-testid="win-time">{formatElapsed(displayTimeMs)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Mistakes</dt>
            <dd data-testid="win-mistakes">{displayMistakes}</dd>
          </div>
        </dl>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            data-testid="win-home"
            onClick={() => onHome?.()}
            className="px-3 py-2 border rounded"
          >
            Home
          </button>
          <button
            type="button"
            data-testid="win-new-game"
            onClick={() => onNewGame?.()}
            className="px-3 py-2 border rounded bg-blue-600 text-white"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}

export default WinModal;
