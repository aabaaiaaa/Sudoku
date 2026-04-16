import { gameStore } from '../store/game';
import { Board } from '../components/Board';
import { NumberPad } from '../components/NumberPad';
import { Timer } from '../components/Timer';
import { Hint } from '../components/Hint';
import { KeyboardHandler } from '../components/KeyboardHandler';

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

      <Board store={store} />

      <NumberPad store={store} />

      <Hint store={store} />
    </div>
  );
}

export default Game;
