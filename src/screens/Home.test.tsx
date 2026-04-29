import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createGameStore } from '../store/game';
import type { SavedGame } from '../store/save';
import { Home } from './Home';

function makeSavedGame(overrides: Partial<SavedGame> = {}): SavedGame {
  return {
    variant: 'classic',
    difficulty: 'medium',
    cells: [],
    mistakes: 0,
    elapsedMs: 0,
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

// Classic descopes Hard and Master (iteration-4 §6 lever 3). Six advertises
// Easy and Medium after the iteration-6 lever-2 rescue. Mini stays Easy-only.
// See variant-tiers.ts.
const CLASSIC_TIERS = [
  'easy',
  'medium',
  'expert',
  'diabolical',
  'demonic',
  'nightmare',
] as const;
const SIX_TIERS = ['easy', 'medium'] as const;
const MINI_TIERS = ['easy'] as const;

describe('Home screen', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the variant picker and the Classic difficulty tiers (6) by default', () => {
    const store = createGameStore();
    const { getByTestId, queryByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => []}
      />,
    );

    expect(getByTestId('home-variant-picker')).toBeTruthy();
    expect(getByTestId('home-variant-classic')).toBeTruthy();
    expect(getByTestId('home-variant-mini')).toBeTruthy();
    expect(getByTestId('home-variant-six')).toBeTruthy();

    expect(getByTestId('home-difficulty-picker')).toBeTruthy();
    for (const tier of CLASSIC_TIERS) {
      expect(getByTestId(`home-difficulty-${tier}`)).toBeTruthy();
    }
    // Hard and Master are descoped from Classic post-tuning.
    expect(queryByTestId('home-difficulty-hard')).toBeNull();
    expect(queryByTestId('home-difficulty-master')).toBeNull();
    expect(queryByTestId('home-difficulty-nightmare')).toBeTruthy();
  });

  it('shows Easy and Medium when Six is selected', () => {
    const store = createGameStore();
    const { getByTestId, queryByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => []}
      />,
    );

    fireEvent.click(getByTestId('home-variant-six'));

    for (const tier of SIX_TIERS) {
      expect(getByTestId(`home-difficulty-${tier}`)).toBeTruthy();
    }
    // Hard+ remain descoped from Six post-tuning.
    expect(queryByTestId('home-difficulty-hard')).toBeNull();
    expect(queryByTestId('home-difficulty-expert')).toBeNull();
    expect(queryByTestId('home-difficulty-diabolical')).toBeNull();
    expect(queryByTestId('home-difficulty-nightmare')).toBeNull();
  });

  it('shows only Easy when Mini is selected', () => {
    const store = createGameStore();
    const { getByTestId, queryByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => []}
      />,
    );

    fireEvent.click(getByTestId('home-variant-mini'));

    for (const tier of MINI_TIERS) {
      expect(getByTestId(`home-difficulty-${tier}`)).toBeTruthy();
    }
    // All harder tiers are descoped from Mini post-tuning.
    expect(queryByTestId('home-difficulty-medium')).toBeNull();
    expect(queryByTestId('home-difficulty-hard')).toBeNull();
    expect(queryByTestId('home-difficulty-expert')).toBeNull();
    expect(queryByTestId('home-difficulty-diabolical')).toBeNull();
    expect(queryByTestId('home-difficulty-nightmare')).toBeNull();
  });

  it('falls back to the highest available tier when switching to a smaller variant', () => {
    const store = createGameStore();
    const newGame = vi.fn();
    store.setState({ newGame });

    const { getByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => []}
      />,
    );

    // Pick a tier that exists for Classic but not for Mini.
    fireEvent.click(getByTestId('home-difficulty-nightmare'));
    expect((getByTestId('home-difficulty-nightmare') as HTMLInputElement).checked).toBe(true);

    // Switch to Mini — Nightmare disappears, selection falls back to Easy
    // (Mini's only advertised tier post-tuning).
    fireEvent.click(getByTestId('home-variant-mini'));
    expect((getByTestId('home-difficulty-easy') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(getByTestId('home-new-game'));
    expect(newGame).toHaveBeenCalledTimes(1);
    const [variantArg, difficultyArg] = newGame.mock.calls[0];
    expect(variantArg).toMatchObject({ id: 'mini' });
    expect(difficultyArg).toBe('easy');
  });

  it('keeps the selected tier when switching variants if still available', () => {
    const store = createGameStore();
    const { getByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => []}
      />,
    );

    // Easy is the only tier shared by all three variants post-tuning.
    fireEvent.click(getByTestId('home-difficulty-easy'));
    expect((getByTestId('home-difficulty-easy') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(getByTestId('home-variant-six'));
    // Easy is supported by Six — the selection should not change.
    expect((getByTestId('home-difficulty-easy') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(getByTestId('home-variant-mini'));
    // Easy is still supported by Mini — selection stays.
    expect((getByTestId('home-difficulty-easy') as HTMLInputElement).checked).toBe(true);
  });

  it('only renders a Resume card for variants that have a saved game', () => {
    const store = createGameStore();
    const saves: SavedGame[] = [
      makeSavedGame({ variant: 'classic', difficulty: 'hard', elapsedMs: 125_000 }),
    ];

    const { getByTestId, queryByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => saves}
      />,
    );

    expect(getByTestId('home-resume-classic-hard')).toBeTruthy();
    expect(queryByTestId('home-resume-mini-easy')).toBeNull();
    expect(queryByTestId('home-resume-six-easy')).toBeNull();

    expect(getByTestId('home-resume-classic-hard-difficulty').textContent).toBe('hard');
    expect(getByTestId('home-resume-classic-hard-elapsed').textContent).toBe('02:05');
    // Saved-at timestamp is rendered in `YYYY-MM-DD HH:MM:SS` (local time).
    expect(getByTestId('home-resume-classic-hard-saved-at').textContent).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('clicking a Resume card loads that save into the game store', () => {
    const store = createGameStore();
    const resumeSavedGame = vi.fn(() => true);
    // Replace the store action with a spy by wrapping setState.
    store.setState({ resumeSavedGame });

    const saves: SavedGame[] = [
      makeSavedGame({ variant: 'mini', difficulty: 'easy', elapsedMs: 0 }),
    ];

    const { getByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => saves}
      />,
    );

    fireEvent.click(getByTestId('home-resume-mini-easy'));
    expect(resumeSavedGame).toHaveBeenCalledWith('mini', 'easy');
  });

  it('renders multiple Resume cards for the same variant in savedAt desc order', () => {
    const store = createGameStore();
    // Provide saves already sorted desc — the component preserves the order
    // produced by `listSavedGames()` (the save store does the sort).
    const saves: SavedGame[] = [
      makeSavedGame({ variant: 'classic', difficulty: 'hard', savedAt: 2_000_000_000_000 }),
      makeSavedGame({ variant: 'classic', difficulty: 'easy', savedAt: 1_000_000_000_000 }),
    ];

    const { getByTestId, container } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => saves}
      />,
    );

    const hardCard = getByTestId('home-resume-classic-hard');
    const easyCard = getByTestId('home-resume-classic-easy');
    expect(hardCard).toBeTruthy();
    expect(easyCard).toBeTruthy();

    // The hard card (savedAt: 2e12) was saved more recently and must appear
    // before the easy card (savedAt: 1e12) in DOM order.
    const allCards = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="home-resume-classic-"]'),
    ).filter((el) => /^home-resume-classic-(hard|easy)$/.test(el.dataset.testid ?? ''));
    expect(allCards.map((el) => el.dataset.testid)).toEqual([
      'home-resume-classic-hard',
      'home-resume-classic-easy',
    ]);
  });

  it('clicking New Game with no existing save starts a new game without opening the dialog', () => {
    const store = createGameStore();
    const newGame = vi.fn();
    store.setState({ newGame });

    const { getByTestId, queryByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        listSavedGamesImpl={() => []}
      />,
    );

    // Default selection is classic/easy.
    fireEvent.click(getByTestId('home-new-game'));

    expect(newGame).toHaveBeenCalledTimes(1);
    const [variantArg, difficultyArg] = newGame.mock.calls[0];
    expect(variantArg).toMatchObject({ id: 'classic' });
    expect(difficultyArg).toBe('easy');
    // The dialog must never appear when there is no existing save.
    expect(queryByTestId('confirm-dialog')).toBeNull();
  });

  it('clicking New Game with an existing save opens a ConfirmDialog before replacing', () => {
    const store = createGameStore();
    const newGame = vi.fn();
    store.setState({ newGame });

    // Default selection is classic/easy — provide a save in that exact slot.
    const saves: Record<string, SavedGame | null> = {
      'classic:easy': makeSavedGame({ variant: 'classic', difficulty: 'easy' }),
    };

    const { getByTestId, queryByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={(id, d) => saves[`${id}:${d}`] ?? null}
        listSavedGamesImpl={() => Object.values(saves).filter((s): s is SavedGame => s != null)}
      />,
    );

    // Initially the dialog is closed.
    expect(queryByTestId('confirm-dialog')).toBeNull();

    // Clicking New Game opens the dialog and does NOT call newGame yet.
    fireEvent.click(getByTestId('home-new-game'));
    expect(getByTestId('confirm-dialog')).toBeTruthy();
    expect(newGame).not.toHaveBeenCalled();

    // Cancelling closes the dialog and still does NOT call newGame.
    fireEvent.click(getByTestId('confirm-dialog-cancel'));
    expect(queryByTestId('confirm-dialog')).toBeNull();
    expect(newGame).not.toHaveBeenCalled();

    // Reopen the dialog and confirm — newGame is called exactly once.
    fireEvent.click(getByTestId('home-new-game'));
    expect(getByTestId('confirm-dialog')).toBeTruthy();
    fireEvent.click(getByTestId('confirm-dialog-confirm'));
    expect(queryByTestId('confirm-dialog')).toBeNull();
    expect(newGame).toHaveBeenCalledTimes(1);
    const [variantArg, difficultyArg] = newGame.mock.calls[0];
    expect(variantArg).toMatchObject({ id: 'classic' });
    expect(difficultyArg).toBe('easy');
  });
});
