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
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('home-new-game')).toBeTruthy();
  });

  it('hides the tab bar on the Game screen', () => {
    render(<App />);

    setHash('#/game');
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('navigates to Learn when hash changes to #/learn', () => {
    render(<App />);

    setHash('#/learn');
    expect(screen.getByTestId('techniques-screen')).toBeTruthy();
  });

  it('navigates to a technique detail page via #/learn/<id>', () => {
    render(<App />);

    setHash('#/learn/x-wing');
    expect(screen.getByTestId('technique-detail')).toBeTruthy();
    expect(
      screen.getByTestId('technique-detail').getAttribute('data-technique-id'),
    ).toBe('x-wing');
  });

  it('falls back to the Learn index when the technique id is unknown', () => {
    render(<App />);

    setHash('#/learn/not-a-real-technique');
    expect(screen.getByTestId('techniques-screen')).toBeTruthy();
    expect(screen.queryByTestId('technique-detail')).toBeNull();
  });

  it('shows a Learn tab in the bottom tab bar that navigates to #/learn', () => {
    render(<App />);

    const tab = screen.getByTestId('tab-learn');
    expect(tab.textContent).toContain('Learn');

    act(() => {
      fireEvent.click(tab);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('techniques-screen')).toBeTruthy();
  });

  it('marks the Learn tab as current on both the index and detail pages', () => {
    render(<App />);

    setHash('#/learn');
    expect(screen.getByTestId('tab-learn').getAttribute('aria-current')).toBe(
      'page',
    );

    setHash('#/learn/x-wing');
    expect(screen.getByTestId('tab-learn').getAttribute('aria-current')).toBe(
      'page',
    );
  });
});
