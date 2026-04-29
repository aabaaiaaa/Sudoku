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

    // Classic post-tuning advertises 6 tiers (Hard, Master descoped per
    // iteration-4 §6 lever 3 — see variant-tiers.ts).
    const classicTiers = ['easy', 'medium', 'expert', 'diabolical', 'demonic', 'nightmare'];
    for (const slug of classicTiers) {
      expect(getByTestId(`stats-header-classic-${slug}`)).toBeTruthy();
      expect(getByTestId(`stats-cell-classic-${slug}-games`)).toBeTruthy();
    }
    expect(queryByTestId('stats-header-classic-hard')).toBeNull();
    expect(queryByTestId('stats-header-classic-master')).toBeNull();

    // Six and Mini are descoped to Easy only (harder tiers were unreachable
    // on the smaller grids — variant-tiers.ts).
    expect(getByTestId('stats-header-six-easy')).toBeTruthy();
    expect(getByTestId('stats-cell-six-easy-games')).toBeTruthy();
    expect(queryByTestId('stats-header-six-medium')).toBeNull();
    expect(queryByTestId('stats-header-six-diabolical')).toBeNull();

    expect(getByTestId('stats-header-mini-easy')).toBeTruthy();
    expect(getByTestId('stats-cell-mini-easy-games')).toBeTruthy();
    expect(queryByTestId('stats-header-mini-medium')).toBeNull();
    expect(queryByTestId('stats-header-mini-hard')).toBeNull();
  });

  it('renders dashes in unpopulated cells across all tiers', () => {
    const store = createStatsStore();
    const { getByTestId } = render(<Stats store={store} />);

    const dash = '—';
    // Top-tier cells with no completions should still render gracefully.
    expect(getByTestId('stats-cell-classic-nightmare-games').textContent).toBe(dash);
    expect(getByTestId('stats-cell-classic-demonic-best').textContent).toBe(dash);
    expect(getByTestId('stats-cell-six-easy-avg').textContent).toBe(dash);
    expect(getByTestId('stats-cell-mini-easy-mistakes').textContent).toBe(dash);
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
    expect(getByTestId('stats-cell-classic-expert-best').textContent).toBe(dash);
    expect(getByTestId('stats-cell-mini-easy-games').textContent).toBe(dash);
    expect(getByTestId('stats-cell-six-easy-avg').textContent).toBe(dash);
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

    expect(store.getState().entries[entryKey('classic', 'easy')].gamesCompleted).toBe(0);
    expect(store.getState().entries[entryKey('classic', 'easy')].bestTimeMs).toBeNull();

    const dash = '\u2014';
    expect(getByTestId('stats-cell-classic-easy-games').textContent).toBe(dash);
    expect(getByTestId('stats-cell-classic-easy-best').textContent).toBe(dash);
    expect(getByTestId('stats-cell-classic-easy-avg').textContent).toBe(dash);
  });

  it('hides the filter pill row for single-tier variants but shows it for multi-tier variants', () => {
    const store = createStatsStore();
    const { getByTestId, queryByTestId } = render(<Stats store={store} />);

    // Classic advertises multiple tiers — the pill row (and its All pill) should render.
    expect(getByTestId('stats-filter-row-classic')).toBeTruthy();
    expect(getByTestId('stats-filter-classic-all')).toBeTruthy();

    // Six and Mini advertise only Easy — the pill row should be omitted, but
    // the table itself must still render below.
    expect(queryByTestId('stats-filter-row-six')).toBeNull();
    expect(queryByTestId('stats-filter-six-all')).toBeNull();
    expect(getByTestId('stats-variant-six')).toBeTruthy();
    expect(getByTestId('stats-header-six-easy')).toBeTruthy();

    expect(queryByTestId('stats-filter-row-mini')).toBeNull();
    expect(queryByTestId('stats-filter-mini-all')).toBeNull();
    expect(getByTestId('stats-variant-mini')).toBeTruthy();
    expect(getByTestId('stats-header-mini-easy')).toBeTruthy();
  });

  it('filters tier columns when a per-variant filter pill is clicked', () => {
    const store = createStatsStore();
    const { getByTestId, queryByTestId } = render(<Stats store={store} />);

    // Default: all advertised classic tiers visible (Hard/Master descoped).
    const classicTiers = ['easy', 'medium', 'expert', 'diabolical', 'demonic', 'nightmare'];
    for (const slug of classicTiers) {
      expect(getByTestId(`stats-header-classic-${slug}`)).toBeTruthy();
    }

    // Click the Expert filter pill.
    fireEvent.click(getByTestId('stats-filter-classic-expert'));

    // Only Expert column should remain for classic.
    expect(getByTestId('stats-header-classic-expert')).toBeTruthy();
    expect(getByTestId('stats-cell-classic-expert-games')).toBeTruthy();
    for (const slug of classicTiers.filter((s) => s !== 'expert')) {
      expect(queryByTestId(`stats-header-classic-${slug}`)).toBeNull();
      expect(queryByTestId(`stats-cell-classic-${slug}-games`)).toBeNull();
    }

    // Other variants should be unaffected — six and mini still show their
    // single advertised tier because each variant section has independent state.
    expect(getByTestId('stats-header-six-easy')).toBeTruthy();
    expect(getByTestId('stats-header-mini-easy')).toBeTruthy();

    // Click All to restore.
    fireEvent.click(getByTestId('stats-filter-classic-all'));

    for (const slug of classicTiers) {
      expect(getByTestId(`stats-header-classic-${slug}`)).toBeTruthy();
      expect(getByTestId(`stats-cell-classic-${slug}-games`)).toBeTruthy();
    }
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
