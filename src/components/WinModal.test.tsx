import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameStore } from '../store/game';
import { createStatsStore } from '../store/stats';
import { generate } from '../engine/generator/generate';
import { miniVariant } from '../engine/variants';
import {
  clearSavedGame,
  getSavedGame,
  putSavedGame,
  type SavedGame,
} from '../store/save';
import { WinModal } from './WinModal';

/**
 * Returns a stats store wrapper where `recordCompletion` is a vi.fn() spy.
 * The underlying store is real; we just patch the action via setState so
 * that components calling `statsStore.getState().recordCompletion(...)`
 * invoke the spy.
 */
function makeSpiedStatsStore() {
  const stats = createStatsStore();
  const spy = vi.fn();
  stats.setState({ recordCompletion: spy });
  return { stats, spy };
}

/**
 * Builds a completed game store: uses `generate` to get a solution board,
 * then installs it directly via setState with a frozen timer.
 */
function makeCompletedStore(opts: {
  accumulatedMs: number;
  mistakes: number;
  difficulty: string;
}) {
  const { solution } = generate(miniVariant, { seed: 42 });
  const store = createGameStore(miniVariant);
  store.setState({
    board: solution,
    timer: { startTs: null, accumulatedMs: opts.accumulatedMs, paused: true },
    mistakes: opts.mistakes,
    difficulty: opts.difficulty,
  });
  return { store, variantId: miniVariant.id };
}

describe('WinModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing when the board is not complete', () => {
    const store = createGameStore(miniVariant);
    const { stats } = makeSpiedStatsStore();
    const { queryByTestId } = render(
      <WinModal store={store} statsStore={stats} />,
    );
    expect(queryByTestId('win-modal')).toBeNull();
  });

  it('opens on completion, records stats once, and clears the save', () => {
    const { store, variantId } = makeCompletedStore({
      accumulatedMs: 65_000,
      mistakes: 2,
      difficulty: 'easy',
    });
    const { stats, spy } = makeSpiedStatsStore();

    // Seed a save for this variant so we can verify it gets cleared.
    const savedGame: SavedGame = {
      variant: variantId,
      difficulty: 'easy',
      cells: store
        .getState()
        .board.cells.map((row) =>
          row.map((c) => ({
            value: c.value,
            notes: [...c.notes].sort((a, b) => a - b),
            given: c.given,
          })),
        ),
      mistakes: 2,
      elapsedMs: 65_000,
      savedAt: Date.now(),
    };
    putSavedGame(savedGame);
    expect(getSavedGame(variantId)).not.toBeNull();

    const { getByTestId } = render(
      <WinModal store={store} statsStore={stats} />,
    );

    expect(getByTestId('win-modal')).toBeTruthy();
    expect(getByTestId('win-time').textContent).toBe('01:05');
    expect(getByTestId('win-mistakes').textContent).toBe('2');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      variant: variantId,
      difficulty: 'easy',
      timeMs: 65_000,
      mistakes: 2,
    });

    expect(getSavedGame(variantId)).toBeNull();
  });

  it('does not double-record when the component re-renders', () => {
    const { store } = makeCompletedStore({
      accumulatedMs: 30_000,
      mistakes: 0,
      difficulty: 'medium',
    });
    const { stats, spy } = makeSpiedStatsStore();

    const { rerender } = render(
      <WinModal store={store} statsStore={stats} />,
    );
    rerender(<WinModal store={store} statsStore={stats} />);
    rerender(<WinModal store={store} statsStore={stats} />);

    // Also trigger an unrelated state change — the board is still complete so
    // still no new recordings should happen.
    act(() => {
      store.setState({ selection: { row: 0, col: 0 } });
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fires onNewGame and onHome when their buttons are clicked', () => {
    const { store } = makeCompletedStore({
      accumulatedMs: 1000,
      mistakes: 0,
      difficulty: 'easy',
    });
    const { stats } = makeSpiedStatsStore();

    const onNewGame = vi.fn();
    const onHome = vi.fn();

    const { getByTestId } = render(
      <WinModal
        store={store}
        statsStore={stats}
        onNewGame={onNewGame}
        onHome={onHome}
      />,
    );

    fireEvent.click(getByTestId('win-new-game'));
    expect(onNewGame).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId('win-home'));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('ensures clearSavedGame removes only the current variant save', () => {
    // Sanity check that the completeGame path in the store targets the right
    // variant id and does not disturb unrelated saves.
    const { store, variantId } = makeCompletedStore({
      accumulatedMs: 1000,
      mistakes: 0,
      difficulty: 'easy',
    });
    const { stats } = makeSpiedStatsStore();

    const otherSave: SavedGame = {
      variant: 'classic',
      difficulty: 'easy',
      cells: [],
      mistakes: 0,
      elapsedMs: 0,
      savedAt: Date.now(),
    };
    putSavedGame(otherSave);

    render(<WinModal store={store} statsStore={stats} />);
    expect(getSavedGame(variantId)).toBeNull();
    expect(getSavedGame('classic')).not.toBeNull();
    clearSavedGame('classic');
  });
});
