import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createGameStore } from '../store/game';
import { Game } from './Game';

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
});
