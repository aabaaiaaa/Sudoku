import { useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { getSavedGame, type SavedGame } from '../store/save';
import { variants } from '../engine/variants';

interface HomeProps {
  store?: typeof gameStore;
  /**
   * Optional override for the confirm prompt (used by tests). Defaults to
   * `window.confirm`. Must return true to proceed with replacing an existing
   * save.
   */
  confirmReplace?: (message: string) => boolean;
  /**
   * Optional hook that tests use to subscribe the component to save-store
   * changes. In production, save reads happen synchronously through
   * `getSavedGame` on each render; no external subscription is needed because
   * the component re-renders when the user triggers actions.
   */
  getSavedGameImpl?: (variant: string) => SavedGame | null;
}

const difficulties = ['easy', 'medium', 'hard', 'expert'] as const;
type Difficulty = (typeof difficulties)[number];

const variantOrder = ['classic', 'mini', 'six'] as const;
type VariantId = (typeof variantOrder)[number];

const variantLabels: Record<VariantId, string> = {
  classic: 'Classic',
  mini: 'Mini',
  six: 'Six',
};

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

export function Home({
  store = gameStore,
  confirmReplace,
  getSavedGameImpl = getSavedGame,
}: HomeProps) {
  const newGame = useStore(store, (s) => s.newGame);
  const resumeSavedGame = useStore(store, (s) => s.resumeSavedGame);

  const [variantId, setVariantId] = useState<VariantId>('classic');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  // Re-read saves each time the game store changes (starting or completing a
  // game writes/clears saves through the store).
  const storeTick = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState(),
  );
  void storeTick;

  const resumeCards = variantOrder
    .map((id) => ({ id, save: getSavedGameImpl(id) }))
    .filter((entry): entry is { id: VariantId; save: SavedGame } => entry.save != null);

  const handleNewGame = () => {
    const existing = getSavedGameImpl(variantId);
    if (existing) {
      const confirmFn = confirmReplace ?? ((msg: string) => window.confirm(msg));
      const ok = confirmFn(
        `You already have a ${variantLabels[variantId]} game in progress. Start a new one and replace it?`,
      );
      if (!ok) return;
    }
    const v = variants[variantId];
    if (!v) return;
    newGame(v, difficulty);
  };

  const handleResume = (id: VariantId) => {
    resumeSavedGame(id);
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">New game</h1>

      <section data-testid="home-variant-picker" className="space-y-2">
        <h2 className="text-lg font-medium">Variant</h2>
        <div role="radiogroup" aria-label="Variant" className="flex gap-2">
          {variantOrder.map((id) => (
            <label key={id} className="flex items-center gap-1">
              <input
                type="radio"
                name="home-variant"
                data-testid={`home-variant-${id}`}
                value={id}
                checked={variantId === id}
                onChange={() => setVariantId(id)}
              />
              <span>{variantLabels[id]}</span>
            </label>
          ))}
        </div>
      </section>

      <section data-testid="home-difficulty-picker" className="space-y-2">
        <h2 className="text-lg font-medium">Difficulty</h2>
        <div role="radiogroup" aria-label="Difficulty" className="flex gap-2">
          {difficulties.map((d) => (
            <label key={d} className="flex items-center gap-1 capitalize">
              <input
                type="radio"
                name="home-difficulty"
                data-testid={`home-difficulty-${d}`}
                value={d}
                checked={difficulty === d}
                onChange={() => setDifficulty(d)}
              />
              <span>{d}</span>
            </label>
          ))}
        </div>
      </section>

      <div>
        <button
          type="button"
          data-testid="home-new-game"
          onClick={handleNewGame}
          className="px-3 py-2 border rounded"
        >
          New Game
        </button>
      </div>

      {resumeCards.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Resume</h2>
          <ul className="space-y-2">
            {resumeCards.map(({ id, save }) => (
              <li key={id}>
                <button
                  type="button"
                  data-testid={`home-resume-${id}`}
                  onClick={() => handleResume(id)}
                  className="w-full text-left p-3 border rounded"
                >
                  <div className="font-medium">{variantLabels[id]}</div>
                  <div className="text-sm">
                    <span data-testid={`home-resume-${id}-difficulty`} className="capitalize">
                      {save.difficulty}
                    </span>
                    {' \u00b7 '}
                    <span data-testid={`home-resume-${id}-elapsed`}>
                      {formatElapsed(save.elapsedMs)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default Home;
