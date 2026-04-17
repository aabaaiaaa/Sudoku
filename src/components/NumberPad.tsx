import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { completedDigits } from '../engine/board';
import type { Digit } from '../engine/types';

interface NumberPadProps {
  store?: typeof gameStore;
}

export function NumberPad({ store = gameStore }: NumberPadProps) {
  const notesMode = useStore(store, (s) => s.notesMode);
  const board = useStore(store, (s) => s.board);
  const placeDigit = useStore(store, (s) => s.placeDigit);
  const toggleNote = useStore(store, (s) => s.toggleNote);
  const erase = useStore(store, (s) => s.erase);
  const toggleNotesMode = useStore(store, (s) => s.toggleNotesMode);

  const variant = board.variant;
  const completed = completedDigits(board);

  const handleDigitClick = (d: Digit) => {
    if (notesMode) {
      toggleNote(d);
    } else {
      placeDigit(d);
    }
  };

  return (
    <div className="grid grid-cols-5 gap-2">
      {variant.digits.map((d) => {
        const isDone = completed.has(d);
        return (
          <button
            key={d}
            type="button"
            data-testid={`pad-digit-${d}`}
            onClick={() => handleDigitClick(d)}
            disabled={isDone && !notesMode}
            aria-label={isDone ? `${d} (complete)` : String(d)}
            className={`btn text-lg font-semibold aspect-square ${
              isDone ? 'opacity-40 line-through' : ''
            }`}
          >
            {d}
          </button>
        );
      })}
      <button
        type="button"
        data-testid="pad-erase"
        onClick={() => erase()}
        className="btn col-span-2"
      >
        ⌫ Erase
      </button>
      <button
        type="button"
        data-testid="pad-notes"
        onClick={() => toggleNotesMode()}
        aria-pressed={notesMode}
        className="btn col-span-3 font-medium"
      >
        {notesMode ? '✏️ Notes: ON' : '✏️ Notes'}
      </button>
    </div>
  );
}

export default NumberPad;
