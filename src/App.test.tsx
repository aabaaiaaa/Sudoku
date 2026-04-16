import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

function setHash(next: string) {
  act(() => {
    window.location.hash = next;
    // jsdom does fire hashchange on assignment, but dispatch explicitly to
    // avoid relying on that and to ensure synchronous listener delivery.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('App navigation', () => {
  beforeEach(() => {
    window.location.hash = '';
    window.localStorage.clear();
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('renders Home by default', () => {
    render(<App />);
    expect(screen.getByTestId('home-new-game')).toBeTruthy();
  });

  it('navigates to Stats when hash changes to #/stats', () => {
    render(<App />);

    setHash('#/stats');
    expect(screen.getByTestId('stats-reset')).toBeTruthy();
  });

  it('navigates to Settings when hash changes to #/settings', () => {
    render(<App />);

    setHash('#/settings');
    expect(screen.getByTestId('settings-theme-picker')).toBeTruthy();
  });

  it('navigates via the bottom tab bar back to Home', () => {
    render(<App />);

    setHash('#/stats');
    expect(screen.getByTestId('stats-reset')).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByTestId('tab-home'));
    });
    expect(screen.getByTestId('home-new-game')).toBeTruthy();
  });

  it('hides the tab bar on the Game screen', () => {
    render(<App />);

    setHash('#/game');
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });
});
