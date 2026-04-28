import { useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { getSavedGame, type SavedGame } from '../store/save';
import { variants } from '../engine/variants';
import { availableTiers } from '../engine/generator/variant-tiers';
import type { Difficulty } from '../engine/generator/rate';

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
  /** Invoked after a successful newGame/resume, so the parent can navigate. */
  onEnterGame?: () => void;
}

const variantOrder = ['classic', 'mini', 'six'] as const;
type VariantId = (typeof variantOrder)[number];

const variantLabels: Record<VariantId, string> = {
  classic: 'Classic',
  mini: 'Mini',
  six: 'Six',
};

function tierSlug(tier: Difficulty): string {
  return tier.toLowerCase();
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

export function Home({
  store = gameStore,
  confirmReplace,
  getSavedGameImpl = getSavedGame,
  onEnterGame,
}: HomeProps) {
  const newGame = useStore(store, (s) => s.newGame);
  const resumeSavedGame = useStore(store, (s) => s.resumeSavedGame);

  const [variantId, setVariantId] = useState<VariantId>('classic');
  const [difficulty, setDifficulty] = useState<string>('easy');

  // Re-read saves each time the game store changes (starting or completing a
  // game writes/clears saves through the store).
  const storeTick = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState(),
  );
  void storeTick;

  // Per requirements §4.1, the picker must hide tiers the generator cannot
  // realistically produce for the current variant. `availableTiers` returns
  // the supported tiers for `variantId` in ascending order.
  const tiers = availableTiers(variants[variantId] ?? variants.classic);
  const tierSlugs = tiers.map(tierSlug);
  const effectiveDifficulty = tierSlugs.includes(difficulty)
    ? difficulty
    : tierSlugs[tierSlugs.length - 1];

  const handleVariantChange = (id: VariantId) => {
    setVariantId(id);
    const v = variants[id];
    if (!v) return;
    // If the previously-selected tier is no longer available for the new
    // variant, fall back to the highest tier the variant supports.
    const newSlugs = availableTiers(v).map(tierSlug);
    if (!newSlugs.includes(difficulty)) {
      setDifficulty(newSlugs[newSlugs.length - 1]);
    }
  };

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
    newGame(v, effectiveDifficulty);
    onEnterGame?.();
  };

  const handleResume = (id: VariantId) => {
    const ok = resumeSavedGame(id);
    if (ok) onEnterGame?.();
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
                onChange={() => handleVariantChange(id)}
              />
              <span>{variantLabels[id]}</span>
            </label>
          ))}
        </div>
      </section>

      <section data-testid="home-difficulty-picker" className="space-y-2">
        <h2 className="text-lg font-medium">Difficulty</h2>
        <div role="radiogroup" aria-label="Difficulty" className="flex flex-wrap gap-2">
          {tiers.map((tier) => {
            const slug = tierSlug(tier);
            return (
              <label key={slug} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="home-difficulty"
                  data-testid={`home-difficulty-${slug}`}
                  value={slug}
                  checked={effectiveDifficulty === slug}
                  onChange={() => setDifficulty(slug)}
                />
                <span>{tier}</span>
              </label>
            );
          })}
        </div>
      </section>

      <div>
        <button
          type="button"
          data-testid="home-new-game"
          onClick={handleNewGame}
          className="btn btn-primary"
        >
          ➕ New Game
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
                  className="card w-full text-left p-3 transition-colors"
                >
                  <div className="font-medium">{variantLabels[id]}</div>
                  <div className="text-sm opacity-80">
                    <span data-testid={`home-resume-${id}-difficulty`} className="capitalize">
                      {save.difficulty}
                    </span>
                    {' · '}
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
