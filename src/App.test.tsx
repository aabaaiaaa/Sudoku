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

describe('App migration prompt', () => {
  // A structurally-valid v2 save payload — the shape `src/store/save.ts`
  // emitted before the iteration-3 schema bump to v3. v2 stored a single
  // save per variant under one root key with `version`, `appVersion`, and
  // a `saved: SavedGame` entry. The migration detector matches on key alone,
  // so the tests pass with any string value — but seeding a real shape
  // protects against a future change to the load path that JSON-parses v2
  // entries before the detector runs.
  const VALID_V2_SAVE = JSON.stringify({
    version: 2,
    appVersion: '0.2.0',
    saved: {
      variant: 'classic',
      difficulty: 'Easy',
      cells: Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => ({ value: null, notes: [], given: false })),
      ),
      mistakes: 0,
      elapsedMs: 0,
      savedAt: 1700000000000,
    },
  });

  beforeEach(() => {
    window.location.hash = '';
    window.localStorage.clear();
  });

  afterEach(() => {
    window.location.hash = '';
    window.localStorage.clear();
  });

  it('renders the migration ConfirmDialog when a legacy v2 save key exists', () => {
    window.localStorage.setItem('sudoku.save.v2', VALID_V2_SAVE);

    render(<App />);

    expect(screen.getByTestId('confirm-dialog')).toBeTruthy();
  });

  it('renders the migration ConfirmDialog when a legacy v3 save key exists', () => {
    // v3 became legacy under iteration-7's tier rename — the
    // `OLD_SAVE_KEY_PATTERN` regex now matches v3 keys, so the existing
    // `App` migration prompt picks them up automatically. The detector
    // matches on key alone, so the value can be any string; a structurally-
    // valid v3 payload is seeded here for the same reason as the v2 case.
    const VALID_V3_SAVE = JSON.stringify({
      version: 3,
      appVersion: '0.5.0',
      saves: {
        'classic:diabolical': {
          variant: 'classic',
          difficulty: 'diabolical',
          cells: Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => ({ value: null, notes: [], given: false })),
          ),
          mistakes: 0,
          elapsedMs: 0,
          savedAt: 1700000000000,
        },
      },
    });
    window.localStorage.setItem('sudoku.save.v3', VALID_V3_SAVE);

    render(<App />);

    expect(screen.getByTestId('confirm-dialog')).toBeTruthy();
  });

  it('hides the dialog and leaves the v2 key in place when "Decide later" is clicked', () => {
    window.localStorage.setItem('sudoku.save.v2', VALID_V2_SAVE);

    render(<App />);

    expect(screen.getByTestId('confirm-dialog')).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    });

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(window.localStorage.getItem('sudoku.save.v2')).toBe(VALID_V2_SAVE);
  });

  it('re-renders the dialog on the next App mount after "Decide later" because dismissal is in-memory only', () => {
    window.localStorage.setItem('sudoku.save.v2', VALID_V2_SAVE);

    // First mount — user clicks "Decide later".
    const first = render(<App />);
    expect(first.getByTestId('confirm-dialog')).toBeTruthy();

    act(() => {
      fireEvent.click(first.getByTestId('confirm-dialog-cancel'));
    });

    expect(first.queryByTestId('confirm-dialog')).toBeNull();
    expect(window.localStorage.getItem('sudoku.save.v2')).toBe(VALID_V2_SAVE);

    // Per requirements §5.5, "Decide later" is held in memory only — no
    // localStorage write — so the next App launch re-prompts.
    first.unmount();

    const second = render(<App />);
    expect(second.getByTestId('confirm-dialog')).toBeTruthy();
    second.unmount();
  });

  it('hides the dialog and removes the v2 key when "Remove now" is clicked', () => {
    window.localStorage.setItem('sudoku.save.v2', VALID_V2_SAVE);

    render(<App />);

    expect(screen.getByTestId('confirm-dialog')).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    });

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(window.localStorage.getItem('sudoku.save.v2')).toBeNull();
  });

  it('does not re-render the dialog on subsequent App mounts after "Remove now"', () => {
    window.localStorage.setItem('sudoku.save.v2', VALID_V2_SAVE);

    const first = render(<App />);
    expect(first.getByTestId('confirm-dialog')).toBeTruthy();

    act(() => {
      fireEvent.click(first.getByTestId('confirm-dialog-confirm'));
    });

    expect(first.queryByTestId('confirm-dialog')).toBeNull();
    expect(window.localStorage.getItem('sudoku.save.v2')).toBeNull();
    first.unmount();

    // The keys are gone, so the detector returns false and the dialog never
    // re-appears.
    const second = render(<App />);
    expect(second.queryByTestId('confirm-dialog')).toBeNull();
    second.unmount();
  });

  it('does not render the migration dialog when no legacy keys exist', () => {
    render(<App />);

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });
});
