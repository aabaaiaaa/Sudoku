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

const CLASSIC_TIERS = [
  'easy',
  'medium',
  'hard',
  'expert',
  'master',
  'diabolical',
  'demonic',
  'nightmare',
] as const;
const SIX_TIERS = ['easy', 'medium', 'hard', 'expert', 'master', 'diabolical'] as const;
const MINI_TIERS = ['easy', 'medium', 'hard'] as const;

describe('Home screen', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the variant picker and the Classic difficulty tiers (8) by default', () => {
    const store = createGameStore();
    const { getByTestId, queryByTestId } = render(
      <Home store={store} getSavedGameImpl={() => null} confirmReplace={() => true} />,
    );

    expect(getByTestId('home-variant-picker')).toBeTruthy();
    expect(getByTestId('home-variant-classic')).toBeTruthy();
    expect(getByTestId('home-variant-mini')).toBeTruthy();
    expect(getByTestId('home-variant-six')).toBeTruthy();

    expect(getByTestId('home-difficulty-picker')).toBeTruthy();
    for (const tier of CLASSIC_TIERS) {
      expect(getByTestId(`home-difficulty-${tier}`)).toBeTruthy();
    }
    // Classic shows all 8; nothing else is filtered out.
    expect(queryByTestId('home-difficulty-master')).toBeTruthy();
    expect(queryByTestId('home-difficulty-nightmare')).toBeTruthy();
  });

  it('shows only the Six tiers (Easy → Diabolical) when Six is selected', () => {
    const store = createGameStore();
    const { getByTestId, queryByTestId } = render(
      <Home store={store} getSavedGameImpl={() => null} confirmReplace={() => true} />,
    );

    fireEvent.click(getByTestId('home-variant-six'));

    for (const tier of SIX_TIERS) {
      expect(getByTestId(`home-difficulty-${tier}`)).toBeTruthy();
    }
    // Tiers above Diabolical are hidden for Six.
    expect(queryByTestId('home-difficulty-demonic')).toBeNull();
    expect(queryByTestId('home-difficulty-nightmare')).toBeNull();
  });

  it('shows only the Mini tiers (Easy → Hard) when Mini is selected', () => {
    const store = createGameStore();
    const { getByTestId, queryByTestId } = render(
      <Home store={store} getSavedGameImpl={() => null} confirmReplace={() => true} />,
    );

    fireEvent.click(getByTestId('home-variant-mini'));

    for (const tier of MINI_TIERS) {
      expect(getByTestId(`home-difficulty-${tier}`)).toBeTruthy();
    }
    // Tiers above Hard are hidden for Mini.
    expect(queryByTestId('home-difficulty-expert')).toBeNull();
    expect(queryByTestId('home-difficulty-master')).toBeNull();
    expect(queryByTestId('home-difficulty-diabolical')).toBeNull();
    expect(queryByTestId('home-difficulty-demonic')).toBeNull();
    expect(queryByTestId('home-difficulty-nightmare')).toBeNull();
  });

  it('falls back to the highest available tier when switching to a smaller variant', () => {
    const store = createGameStore();
    const newGame = vi.fn();
    store.setState({ newGame });

    const { getByTestId } = render(
      <Home store={store} getSavedGameImpl={() => null} confirmReplace={() => true} />,
    );

    // Pick a tier that exists for Classic but not for Mini.
    fireEvent.click(getByTestId('home-difficulty-nightmare'));
    expect((getByTestId('home-difficulty-nightmare') as HTMLInputElement).checked).toBe(true);

    // Switch to Mini — Nightmare disappears, selection falls back to Hard.
    fireEvent.click(getByTestId('home-variant-mini'));
    expect((getByTestId('home-difficulty-hard') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(getByTestId('home-new-game'));
    expect(newGame).toHaveBeenCalledTimes(1);
    const [variantArg, difficultyArg] = newGame.mock.calls[0];
    expect(variantArg).toMatchObject({ id: 'mini' });
    expect(difficultyArg).toBe('hard');
  });

  it('keeps the selected tier when switching variants if still available', () => {
    const store = createGameStore();
    const { getByTestId } = render(
      <Home store={store} getSavedGameImpl={() => null} confirmReplace={() => true} />,
    );

    fireEvent.click(getByTestId('home-difficulty-hard'));
    expect((getByTestId('home-difficulty-hard') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(getByTestId('home-variant-six'));
    // Hard is supported by Six — the selection should not change.
    expect((getByTestId('home-difficulty-hard') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(getByTestId('home-variant-mini'));
    // Hard is still supported (it's the cap for Mini) — selection stays.
    expect((getByTestId('home-difficulty-hard') as HTMLInputElement).checked).toBe(true);
  });

  it('only renders a Resume card for variants that have a saved game', () => {
    const store = createGameStore();
    const saves: Record<string, SavedGame | null> = {
      classic: makeSavedGame({ variant: 'classic', difficulty: 'hard', elapsedMs: 125_000 }),
      mini: null,
      six: null,
    };

    const { getByTestId, queryByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={(id) => saves[id] ?? null}
        confirmReplace={() => true}
      />,
    );

    expect(getByTestId('home-resume-classic')).toBeTruthy();
    expect(queryByTestId('home-resume-mini')).toBeNull();
    expect(queryByTestId('home-resume-six')).toBeNull();

    expect(getByTestId('home-resume-classic-difficulty').textContent).toBe('hard');
    expect(getByTestId('home-resume-classic-elapsed').textContent).toBe('02:05');
  });

  it('clicking a Resume card loads that save into the game store', () => {
    const store = createGameStore();
    const resumeSavedGame = vi.fn(() => true);
    // Replace the store action with a spy by wrapping setState.
    store.setState({ resumeSavedGame });

    const saves: Record<string, SavedGame | null> = {
      classic: null,
      mini: makeSavedGame({ variant: 'mini', difficulty: 'easy', elapsedMs: 0 }),
      six: null,
    };

    const { getByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={(id) => saves[id] ?? null}
        confirmReplace={() => true}
      />,
    );

    fireEvent.click(getByTestId('home-resume-mini'));
    expect(resumeSavedGame).toHaveBeenCalledWith('mini');
  });

  it('clicking New Game with no existing save starts a new game', () => {
    const store = createGameStore();
    const newGame = vi.fn();
    store.setState({ newGame });

    const { getByTestId } = render(
      <Home
        store={store}
        getSavedGameImpl={() => null}
        confirmReplace={() => {
          throw new Error('confirm should not be called when no save exists');
        }}
      />,
    );

    // Default selection is classic/easy.
    fireEvent.click(getByTestId('home-new-game'));

    expect(newGame).toHaveBeenCalledTimes(1);
    const [variantArg, difficultyArg] = newGame.mock.calls[0];
    expect(variantArg).toMatchObject({ id: 'classic' });
    expect(difficultyArg).toBe('easy');
  });

  it('clicking New Game with an existing save prompts a confirm before replacing', () => {
    const store = createGameStore();
    const newGame = vi.fn();
    store.setState({ newGame });

    const saves: Record<string, SavedGame | null> = {
      classic: makeSavedGame({ variant: 'classic', difficulty: 'easy' }),
      mini: null,
      six: null,
    };

    const confirmReplace = vi.fn(() => false);

    const { getByTestId, rerender } = render(
      <Home
        store={store}
        getSavedGameImpl={(id) => saves[id] ?? null}
        confirmReplace={confirmReplace}
      />,
    );

    // Cancelled confirm => newGame not called.
    fireEvent.click(getByTestId('home-new-game'));
    expect(confirmReplace).toHaveBeenCalledTimes(1);
    expect(newGame).not.toHaveBeenCalled();

    // Now accept the confirm and it should proceed.
    const confirmReplaceAccept = vi.fn(() => true);
    rerender(
      <Home
        store={store}
        getSavedGameImpl={(id) => saves[id] ?? null}
        confirmReplace={confirmReplaceAccept}
      />,
    );

    fireEvent.click(getByTestId('home-new-game'));
    expect(confirmReplaceAccept).toHaveBeenCalledTimes(1);
    expect(newGame).toHaveBeenCalledTimes(1);
  });
});
