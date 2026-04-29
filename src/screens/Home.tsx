import { useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { getSavedGame, listSavedGames, type SavedGame } from '../store/save';
import { variants } from '../engine/variants';
import { availableTiers } from '../engine/generator/variant-tiers';
import type { Difficulty } from '../engine/generator/rate';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface HomeProps {
  store?: typeof gameStore;
  /**
   * Optional override for the per-slot save lookup used by `handleNewGame`.
   * Defaults to a wrapper around `getSavedGame` from the save store.
   */
  getSavedGameImpl?: (variant: string, difficulty: string) => SavedGame | null;
  /**
   * Optional override for the resume list source. Defaults to `listSavedGames`
   * from the save store, which already returns saves sorted by `savedAt`
   * descending (most recent first).
   */
  listSavedGamesImpl?: () => SavedGame[];
  /** Invoked after a successful newGame/resume, so the parent can navigate. */
  onEnterGame?: () => void;
}

const variantOrder = ['classic', 'mini', 'six'] as const;
type VariantId = (typeof variantOrder)[number];

const variantLabels: Record<string, string> = {
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

/**
 * Formats a millisecond timestamp as `YYYY-MM-DD HH:MM:SS` in local time. The
 * format is fixed and locale-independent so the resume cards render the same
 * shape regardless of the user's locale.
 */
function formatSavedAt(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type ReplaceDialogState =
  | { open: true; variantId: VariantId; difficulty: string; existing: SavedGame }
  | { open: false };

export function Home({
  store = gameStore,
  getSavedGameImpl = (variant, difficulty) => getSavedGame(variant, difficulty),
  listSavedGamesImpl = () => listSavedGames(),
  onEnterGame,
}: HomeProps) {
  const newGame = useStore(store, (s) => s.newGame);
  const resumeSavedGame = useStore(store, (s) => s.resumeSavedGame);

  const [variantId, setVariantId] = useState<VariantId>('classic');
  const [difficulty, setDifficulty] = useState<string>('easy');
  const [replaceDialog, setReplaceDialog] = useState<ReplaceDialogState>({ open: false });

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

  // Per requirements §5.3, render one card per slot returned by
  // `listSavedGames()` (already sorted by `savedAt` desc).
  const resumeCards = listSavedGamesImpl();

  const handleNewGame = () => {
    const v = variants[variantId];
    if (!v) return;
    const existing = getSavedGameImpl(variantId, effectiveDifficulty);
    if (existing) {
      setReplaceDialog({
        open: true,
        variantId,
        difficulty: effectiveDifficulty,
        existing,
      });
      return;
    }
    newGame(v, effectiveDifficulty);
    onEnterGame?.();
  };

  const handleReplaceConfirm = () => {
    if (!replaceDialog.open) return;
    const v = variants[replaceDialog.variantId];
    const targetDifficulty = replaceDialog.difficulty;
    setReplaceDialog({ open: false });
    if (!v) return;
    newGame(v, targetDifficulty);
    onEnterGame?.();
  };

  const handleReplaceCancel = () => {
    setReplaceDialog({ open: false });
  };

  const handleResume = (save: SavedGame) => {
    const ok = resumeSavedGame(save.variant, save.difficulty);
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
            {resumeCards.map((save) => {
              const variantLabel = variantLabels[save.variant] ?? save.variant;
              const difficultySlug = save.difficulty.toLowerCase();
              const cardId = `home-resume-${save.variant}-${difficultySlug}`;
              return (
                <li key={cardId}>
                  <button
                    type="button"
                    data-testid={cardId}
                    onClick={() => handleResume(save)}
                    className="card w-full text-left p-3 transition-colors"
                  >
                    <div className="font-medium">{variantLabel}</div>
                    <div className="text-sm opacity-80 flex items-center gap-2">
                      <DifficultyBadge
                        difficulty={save.difficulty}
                        data-testid={`${cardId}-difficulty`}
                      />
                      <span data-testid={`${cardId}-elapsed`}>
                        {formatElapsed(save.elapsedMs)}
                      </span>
                      <span data-testid={`${cardId}-saved-at`}>
                        {formatSavedAt(save.savedAt)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={replaceDialog.open}
        title="Replace existing game?"
        body={
          replaceDialog.open ? (
            <>
              You have a {variantLabels[replaceDialog.variantId]}{' '}
              <DifficultyBadge difficulty={replaceDialog.difficulty} /> game in
              progress (elapsed {formatElapsed(replaceDialog.existing.elapsedMs)},
              saved at {formatSavedAt(replaceDialog.existing.savedAt)}). Start a
              new one and replace it?
            </>
          ) : null
        }
        confirmLabel="Replace"
        cancelLabel="Cancel"
        onConfirm={handleReplaceConfirm}
        onCancel={handleReplaceCancel}
      />
    </div>
  );
}

export default Home;
