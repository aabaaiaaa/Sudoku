import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { variants } from '../engine/variants';
import { Board } from '../components/Board';
import { NumberPad } from '../components/NumberPad';
import { Timer } from '../components/Timer';
import { Hint } from '../components/Hint';
import { KeyboardHandler } from '../components/KeyboardHandler';
import { WinModal } from '../components/WinModal';

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

  // Hide the board while paused *after* the timer has actually run so the
  // player can't peek while the clock is stopped. The initial pre-start state
  // (accumulatedMs === 0 and startTs === null) keeps the board visible.
  const hasRun = timer.accumulatedMs > 0 || timer.startTs != null;
  const hideBoard = timer.paused && hasRun;

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <KeyboardHandler store={store} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          data-testid="game-back"
          onClick={() => onBack?.()}
          className="px-3 py-2 border rounded"
        >
          Back
        </button>
        <Timer store={store} />
      </div>

      <div hidden={hideBoard}>
        <Board store={store} />
      </div>

      <NumberPad store={store} />

      <Hint store={store} />

      <WinModal store={store} onNewGame={handleNewGame} onHome={() => onBack?.()} />
    </div>
  );
}

export default Game;
