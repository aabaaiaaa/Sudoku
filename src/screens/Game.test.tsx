import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { createGameStore, type GeneratorFactory } from '../store/game';
import type { GeneratorHandle } from '../workers/generator-client';
import { Game } from './Game';

/**
 * Generator factory whose handle never resolves. Lets tests hold the store's
 * `loading` flag true indefinitely without spinning up a real Web Worker.
 */
const pendingGenerator: GeneratorFactory = () => {
  const handle: GeneratorHandle = {
    promise: new Promise(() => {}),
    cancel: () => {},
    onProgress: () => {},
  };
  return handle;
};

describe('Game screen', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders Board, NumberPad, Timer, and Hint when a game is active', () => {
    const store = createGameStore();
    // Start an active game.
    store.getState().newGame('classic', 'easy');

    const { getByTestId } = render(<Game store={store} />);

    // Board present (Board renders a container with this testid).
    expect(getByTestId('sudoku-board')).toBeTruthy();
    // NumberPad renders at least one digit button.
    expect(getByTestId('pad-digit-1')).toBeTruthy();
    expect(getByTestId('pad-erase')).toBeTruthy();
    expect(getByTestId('pad-notes')).toBeTruthy();
    // Timer display present.
    expect(getByTestId('timer-display')).toBeTruthy();
    // Hint button present.
    expect(getByTestId('hint-button')).toBeTruthy();
    // Back-to-home button present.
    expect(getByTestId('game-back')).toBeTruthy();
  });

  it('clicking the back button invokes the onBack handler', () => {
    const store = createGameStore();
    store.getState().newGame('classic', 'easy');

    const onBack = vi.fn();
    const { getByTestId } = render(<Game store={store} onBack={onBack} />);

    fireEvent.click(getByTestId('game-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders without crashing when no onBack handler is provided', () => {
    const store = createGameStore();
    store.getState().newGame('classic', 'easy');

    const { getByTestId } = render(<Game store={store} />);
    // Clicking back with no handler is a no-op — should not throw.
    fireEvent.click(getByTestId('game-back'));
    expect(getByTestId('sudoku-board')).toBeTruthy();
  });

  describe('loading overlay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not render the loading overlay while loading is false', () => {
      const store = createGameStore('classic', { generator: pendingGenerator });
      const { queryByTestId } = render(<Game store={store} />);
      expect(queryByTestId('loading-overlay')).toBeNull();
    });

    it('does not render the loading overlay before the 200ms debounce elapses', () => {
      const store = createGameStore('classic', { generator: pendingGenerator });
      const { queryByTestId } = render(<Game store={store} />);

      act(() => {
        store.setState({ loading: true });
      });
      act(() => {
        vi.advanceTimersByTime(199);
      });

      expect(queryByTestId('loading-overlay')).toBeNull();
    });

    it('renders the loading overlay after 200ms of continuous loading', () => {
      const store = createGameStore('classic', { generator: pendingGenerator });
      const { queryByTestId } = render(<Game store={store} />);

      act(() => {
        store.setState({ loading: true });
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(queryByTestId('loading-overlay')).not.toBeNull();
    });

    it('does not flash the loading overlay when loading clears within 200ms', () => {
      const store = createGameStore('classic', { generator: pendingGenerator });
      const { queryByTestId } = render(<Game store={store} />);

      act(() => {
        store.setState({ loading: true });
      });
      act(() => {
        vi.advanceTimersByTime(150);
      });
      act(() => {
        store.setState({ loading: false });
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(queryByTestId('loading-overlay')).toBeNull();
    });

    it('hides the loading overlay immediately when loading clears', () => {
      const store = createGameStore('classic', { generator: pendingGenerator });
      const { queryByTestId } = render(<Game store={store} />);

      act(() => {
        store.setState({ loading: true });
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(queryByTestId('loading-overlay')).not.toBeNull();

      act(() => {
        store.setState({ loading: false });
      });
      expect(queryByTestId('loading-overlay')).toBeNull();
    });
  });
});
