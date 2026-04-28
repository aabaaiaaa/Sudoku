import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { variants } from '../engine/variants';
import { Board } from '../components/Board';
import { NumberPad } from '../components/NumberPad';
import { Timer } from '../components/Timer';
import { Hint } from '../components/Hint';
import { KeyboardHandler } from '../components/KeyboardHandler';
import { WinModal } from '../components/WinModal';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { GenerationFailedDialog } from '../components/GenerationFailedDialog';
import { useDebouncedFlag } from '../hooks/useDebouncedFlag';

interface GameProps {
  store?: typeof gameStore;
  /**
   * Invoked when the user clicks the back-to-home button. The Game screen
   * itself doesn't own navigation — the parent (App shell) decides what
   * "going back" means.
   */
  onBack?: () => void;
}

export function Game({ store = gameStore, onBack }: GameProps) {
  const newGame = useStore(store, (s) => s.newGame);
  const variantId = useStore(store, (s) => s.board.variant.id);
  const difficulty = useStore(store, (s) => s.difficulty);
  const timer = useStore(store, (s) => s.timer);

  const handleNewGame = () => {
    const v = variants[variantId];
    if (v) newGame(v, difficulty);
  };

  // Show the board behind a blur overlay while paused (after the clock has
  // run at least once). The pre-start state (first game, untouched) keeps
  // the board crisp.
  const resume = useStore(store, (s) => s.resume);
  const hasRun = timer.accumulatedMs > 0 || timer.startTs != null;
  const showPauseOverlay = timer.paused && hasRun;

  const loading = useStore(store, (s) => s.loading);
  const cancelGeneration = useStore(store, (s) => s.cancelGeneration);
  const showLoadingOverlay = useDebouncedFlag(loading, 200);

  const handleCancelGeneration = () => {
    cancelGeneration();
    onBack?.();
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <KeyboardHandler store={store} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          data-testid="game-back"
          onClick={() => onBack?.()}
          className="btn"
        >
          ← Back
        </button>
        <Timer store={store} />
      </div>

      <div className="relative">
        <div
          data-testid="board-wrapper"
          style={{
            filter: showPauseOverlay ? 'blur(8px)' : undefined,
            pointerEvents: showPauseOverlay ? 'none' : undefined,
            transition: 'filter 150ms',
          }}
          aria-hidden={showPauseOverlay}
        >
          <Board store={store} />
        </div>
        {showPauseOverlay && (
          <div
            data-testid="pause-overlay"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-4"
            style={{
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '0.5rem',
            }}
          >
            <div
              className="card px-4 py-3"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
            >
              <div className="font-semibold mb-1">⏸ Paused</div>
              <div className="text-sm opacity-80 mb-3">
                Tap Resume to continue
              </div>
              <button
                type="button"
                data-testid="pause-resume"
                onClick={() => resume()}
                className="btn btn-primary w-full"
              >
                ▶ Resume
              </button>
            </div>
          </div>
        )}
      </div>

      <NumberPad store={store} />

      <Hint store={store} />

      <WinModal store={store} onNewGame={handleNewGame} onHome={() => onBack?.()} />

      <LoadingOverlay
        visible={showLoadingOverlay}
        onCancel={handleCancelGeneration}
      />

      <GenerationFailedDialog store={store} onCancel={() => onBack?.()} />
    </div>
  );
}

export default Game;
