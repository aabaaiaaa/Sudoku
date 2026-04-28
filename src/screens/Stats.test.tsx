import { beforeEach, describe, expect, it } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createStatsStore, entryKey } from '../store/stats';
import { Stats } from './Stats';

describe('Stats screen', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders a table for each registered variant', () => {
    const store = createStatsStore();
    const { getByTestId } = render(<Stats store={store} />);

    expect(getByTestId('stats-variant-classic')).toBeTruthy();
    expect(getByTestId('stats-variant-mini')).toBeTruthy();
    expect(getByTestId('stats-variant-six')).toBeTruthy();
  });

  it('renders the per-variant tier columns', () => {
    const store = createStatsStore();
    const { getByTestId, queryByTestId } = render(<Stats store={store} />);

    // Classic exposes all eight tiers.
    const classicTiers = [
      'easy',
      'medium',
      'hard',
      'expert',
      'master',
      'diabolical',
      'demonic',
      'nightmare',
    ];
    for (const slug of classicTiers) {
      expect(getByTestId(`stats-header-classic-${slug}`)).toBeTruthy();
      expect(getByTestId(`stats-cell-classic-${slug}-games`)).toBeTruthy();
    }

    // Six caps at Diabolical (six tiers).
    const sixTiers = ['easy', 'medium', 'hard', 'expert', 'master', 'diabolical'];
    for (const slug of sixTiers) {
      expect(getByTestId(`stats-header-six-${slug}`)).toBeTruthy();
      expect(getByTestId(`stats-cell-six-${slug}-games`)).toBeTruthy();
    }
    expect(queryByTestId('stats-header-six-demonic')).toBeNull();
    expect(queryByTestId('stats-header-six-nightmare')).toBeNull();

    // Mini caps at Hard (three tiers).
    const miniTiers = ['easy', 'medium', 'hard'];
    for (const slug of miniTiers) {
      expect(getByTestId(`stats-header-mini-${slug}`)).toBeTruthy();
      expect(getByTestId(`stats-cell-mini-${slug}-games`)).toBeTruthy();
    }
    expect(queryByTestId('stats-header-mini-expert')).toBeNull();
    expect(queryByTestId('stats-header-mini-master')).toBeNull();
  });

  it('renders dashes in unpopulated cells across all tiers', () => {
    const store = createStatsStore();
    const { getByTestId } = render(<Stats store={store} />);

    const dash = '—';
    // Top-tier cells with no completions should still render gracefully.
    expect(getByTestId('stats-cell-classic-nightmare-games').textContent).toBe(dash);
    expect(getByTestId('stats-cell-classic-demonic-best').textContent).toBe(dash);
    expect(getByTestId('stats-cell-six-diabolical-avg').textContent).toBe(dash);
    expect(getByTestId('stats-cell-mini-hard-mistakes').textContent).toBe(dash);
  });

  it('displays formatted stats for a populated entry and dashes for empty ones', () => {
    const store = createStatsStore();
    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'easy',
      timeMs: 65_000,
      mistakes: 2,
      now: new Date('2026-04-15'),
    });

    const { getByTestId } = render(<Stats store={store} />);

    expect(getByTestId('stats-cell-classic-easy-games').textContent).toBe('1');
    expect(getByTestId('stats-cell-classic-easy-best').textContent).toBe('01:05');
    expect(getByTestId('stats-cell-classic-easy-current').textContent).toBe('1');
    expect(getByTestId('stats-cell-classic-easy-longest').textContent).toBe('1');
    expect(getByTestId('stats-cell-classic-easy-avg').textContent).toBe('01:05');
    expect(getByTestId('stats-cell-classic-easy-mistakes').textContent).toBe('2');

    // Empty cells show an em dash.
    const dash = '\u2014';
    expect(getByTestId('stats-cell-classic-medium-games').textContent).toBe(dash);
    expect(getByTestId('stats-cell-classic-hard-best').textContent).toBe(dash);
    expect(getByTestId('stats-cell-mini-easy-games').textContent).toBe(dash);
    expect(getByTestId('stats-cell-six-expert-avg').textContent).toBe(dash);
  });

  it('resets stats after click-then-confirm', () => {
    const store = createStatsStore();
    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'easy',
      timeMs: 65_000,
      mistakes: 2,
      now: new Date('2026-04-15'),
    });

    const { getByTestId } = render(<Stats store={store} />);

    expect(store.getState().entries[entryKey('classic', 'easy')]).toBeDefined();

    fireEvent.click(getByTestId('stats-reset'));
    fireEvent.click(getByTestId('stats-reset-confirm'));

    expect(store.getState().entries).toEqual({});

    const dash = '\u2014';
    expect(getByTestId('stats-cell-classic-easy-games').textContent).toBe(dash);
    expect(getByTestId('stats-cell-classic-easy-best').textContent).toBe(dash);
    expect(getByTestId('stats-cell-classic-easy-avg').textContent).toBe(dash);
  });

  it('cancelling the reset leaves stats untouched', () => {
    const store = createStatsStore();
    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'easy',
      timeMs: 65_000,
      mistakes: 2,
      now: new Date('2026-04-15'),
    });

    const before = store.getState().entries[entryKey('classic', 'easy')];
    expect(before).toBeDefined();

    const { getByTestId } = render(<Stats store={store} />);

    fireEvent.click(getByTestId('stats-reset'));
    fireEvent.click(getByTestId('stats-reset-cancel'));

    const after = store.getState().entries[entryKey('classic', 'easy')];
    expect(after).toEqual(before);

    // Back to initial button state.
    expect(getByTestId('stats-reset')).toBeTruthy();
    // Displayed stats still show populated values.
    expect(getByTestId('stats-cell-classic-easy-games').textContent).toBe('1');
    expect(getByTestId('stats-cell-classic-easy-best').textContent).toBe('01:05');
  });
});
