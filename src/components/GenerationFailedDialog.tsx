import { useRef } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { DIFFICULTY_ORDER, type Difficulty } from '../engine/generator/rate';
import { useFocusTrap } from './useFocusTrap';

interface GenerationFailedDialogProps {
  /** Optional game store override, primarily for tests. */
  store?: typeof gameStore;
  /**
   * Invoked when the user clicks Cancel. The dialog itself clears
   * `generationFailure` before calling this; the parent typically navigates
   * back to Home.
   */
  onCancel?: () => void;
}

/**
 * Case-insensitive lookup against {@link DIFFICULTY_ORDER}. Returns -1 when
 * the input doesn't match any known tier — needed because the game store
 * occasionally holds a lowercase string (Home picker convention) even though
 * the static type is the capitalized {@link Difficulty} union.
 */
function findTierIndex(d: string): number {
  const norm = d.toLowerCase();
  return DIFFICULTY_ORDER.findIndex((t) => t.toLowerCase() === norm);
}

function tierLabel(d: string): string {
  const idx = findTierIndex(d);
  return idx >= 0 ? DIFFICULTY_ORDER[idx] : d;
}

/**
 * Modal surfaced when the generator worker exhausts its retry budget
 * (requirements §7.3). Offers Try-again / Try-easier-tier / Cancel actions.
 * Try-easier is hidden when the failed target was already the lowest tier.
 */
export function GenerationFailedDialog({
  store = gameStore,
  onCancel,
}: GenerationFailedDialogProps) {
  const failure = useStore(store, (s) => s.generationFailure);
  const variant = useStore(store, (s) => s.board.variant);
  const difficulty = useStore(store, (s) => s.difficulty);
  const newGame = useStore(store, (s) => s.newGame);

  const dialogRef = useRef<HTMLDivElement>(null);

  const handleCancel = () => {
    store.setState({ generationFailure: null });
    onCancel?.();
  };

  // Hook must run unconditionally; pass `failure != null` so it activates
  // exactly when the dialog is rendered.
  useFocusTrap(failure != null, dialogRef, handleCancel);

  if (!failure) return null;

  const targetLabel = tierLabel(failure.difficulty);
  const idx = findTierIndex(failure.difficulty);
  const easierTier: Difficulty | null = idx > 0 ? DIFFICULTY_ORDER[idx - 1] : null;

  const handleTryAgain = () => {
    newGame(variant, difficulty);
  };

  const handleTryEasier = () => {
    if (easierTier == null) return;
    // Match the Home picker's lowercase convention so the saved-game label
    // stays consistent with new-game flows from the home screen.
    newGame(variant, easierTier.toLowerCase());
  };

  return (
    <div
      ref={dialogRef}
      data-testid="generation-failed-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-failed-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        className="card p-6 min-w-[260px] max-w-sm shadow-xl"
        style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
      >
        <h2 id="generation-failed-title" className="text-lg font-semibold mb-3">
          Couldn't find a {targetLabel} puzzle in time.
        </h2>
        <p className="text-sm mb-4 opacity-90">
          Top-tier puzzles can take many attempts to find. You can retry the
          same difficulty, drop down a tier, or cancel and pick something else.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="generation-failed-try-again"
            onClick={handleTryAgain}
            className="btn btn-primary"
          >
            Try again
          </button>
          {easierTier && (
            <button
              type="button"
              data-testid="generation-failed-try-easier"
              onClick={handleTryEasier}
              className="btn"
            >
              Try {easierTier}
            </button>
          )}
          <button
            type="button"
            data-testid="generation-failed-cancel"
            onClick={handleCancel}
            className="btn"
          >
            Cancel
          </button>
        </div>
        {failure.lastError != null && (
          <p
            data-testid="failure-last-error"
            className="text-xs opacity-70 mt-2 break-words"
          >
            {failure.lastError}
          </p>
        )}
      </div>
    </div>
  );
}

export default GenerationFailedDialog;
