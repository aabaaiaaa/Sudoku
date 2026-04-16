import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameStore } from '../store/game';
import { Timer } from './Timer';

function setVisibility(value: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('Timer', () => {
  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('pauses on visibilitychange hidden and resumes on visible', () => {
    const store = createGameStore('classic');
    act(() => {
      store.getState().resume();
    });
    render(<Timer store={store} />);

    act(() => {
      setVisibility('hidden');
    });
    expect(store.getState().timer.paused).toBe(true);

    act(() => {
      setVisibility('visible');
    });
    expect(store.getState().timer.paused).toBe(false);
  });

  it('manual pause overrides visibility resume', () => {
    const store = createGameStore('classic');
    act(() => {
      store.getState().resume();
    });
    render(<Timer store={store} />);

    const button = screen.getByTestId('timer-toggle');
    act(() => {
      fireEvent.click(button);
    });
    expect(store.getState().timer.paused).toBe(true);

    act(() => {
      setVisibility('hidden');
    });
    act(() => {
      setVisibility('visible');
    });

    expect(store.getState().timer.paused).toBe(true);
  });

  it('formats elapsed time as mm:ss', () => {
    const store = createGameStore('classic');
    act(() => {
      store.setState({
        timer: { startTs: null, accumulatedMs: 65000, paused: true },
      });
    });
    render(<Timer store={store} />);

    expect(screen.getByTestId('timer-display').textContent).toBe('01:05');
  });
});
