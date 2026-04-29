import { beforeEach, describe, expect, it } from 'vitest';
import {
  STATS_SCHEMA_VERSION,
  STATS_STORAGE_KEY,
  createStatsStore,
  entryKey,
  initialStatsEntries,
} from './stats';

describe('stats store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('bestTimeMs updates only when the new time is strictly faster', () => {
    const store = createStatsStore();
    const base = { variant: 'classic', difficulty: 'easy' };
    const key = entryKey(base.variant, base.difficulty);

    store.getState().recordCompletion({ ...base, timeMs: 5000, mistakes: 0, now: new Date('2026-04-10') });
    expect(store.getState().entries[key].bestTimeMs).toBe(5000);

    // Equal time should NOT update.
    store.getState().recordCompletion({ ...base, timeMs: 5000, mistakes: 0, now: new Date('2026-04-11') });
    expect(store.getState().entries[key].bestTimeMs).toBe(5000);

    // Slower time should NOT update.
    store.getState().recordCompletion({ ...base, timeMs: 9000, mistakes: 0, now: new Date('2026-04-12') });
    expect(store.getState().entries[key].bestTimeMs).toBe(5000);

    // Faster time SHOULD update.
    store.getState().recordCompletion({ ...base, timeMs: 3000, mistakes: 0, now: new Date('2026-04-13') });
    expect(store.getState().entries[key].bestTimeMs).toBe(3000);
  });

  it('increments currentStreak when lastPlayedDate is the day before', () => {
    const store = createStatsStore();
    const base = { variant: 'classic', difficulty: 'easy' };
    const key = entryKey(base.variant, base.difficulty);

    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-15T10:00:00') });
    expect(store.getState().entries[key].currentStreak).toBe(1);

    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-16T10:00:00') });
    expect(store.getState().entries[key].currentStreak).toBe(2);

    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-17T10:00:00') });
    expect(store.getState().entries[key].currentStreak).toBe(3);
  });

  it('resets streak to 1 if there is a gap of more than 1 day', () => {
    const store = createStatsStore();
    const base = { variant: 'classic', difficulty: 'easy' };
    const key = entryKey(base.variant, base.difficulty);

    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-10T10:00:00') });
    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-11T10:00:00') });
    expect(store.getState().entries[key].currentStreak).toBe(2);

    // Skip a day.
    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-13T10:00:00') });
    expect(store.getState().entries[key].currentStreak).toBe(1);
  });

  it('keeps streak the same when another game is completed the same day', () => {
    const store = createStatsStore();
    const base = { variant: 'classic', difficulty: 'easy' };
    const key = entryKey(base.variant, base.difficulty);

    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-15T09:00:00') });
    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-16T09:00:00') });
    expect(store.getState().entries[key].currentStreak).toBe(2);

    // Second game same day — streak unchanged.
    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-16T20:00:00') });
    expect(store.getState().entries[key].currentStreak).toBe(2);
  });

  it('longestStreak tracks the maximum observed streak', () => {
    const store = createStatsStore();
    const base = { variant: 'classic', difficulty: 'easy' };
    const key = entryKey(base.variant, base.difficulty);

    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-10T10:00:00') });
    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-11T10:00:00') });
    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-12T10:00:00') });
    expect(store.getState().entries[key].longestStreak).toBe(3);

    // Break the streak; longestStreak should remain 3.
    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 0, now: new Date('2026-04-20T10:00:00') });
    expect(store.getState().entries[key].currentStreak).toBe(1);
    expect(store.getState().entries[key].longestStreak).toBe(3);
  });

  it('accumulates gamesCompleted, totalTimeMs, and totalMistakes', () => {
    const store = createStatsStore();
    const base = { variant: 'classic', difficulty: 'hard' };
    const key = entryKey(base.variant, base.difficulty);

    store.getState().recordCompletion({ ...base, timeMs: 1000, mistakes: 2, now: new Date('2026-04-15') });
    store.getState().recordCompletion({ ...base, timeMs: 2000, mistakes: 3, now: new Date('2026-04-16') });
    store.getState().recordCompletion({ ...base, timeMs: 4000, mistakes: 1, now: new Date('2026-04-17') });

    const entry = store.getState().entries[key];
    expect(entry.gamesCompleted).toBe(3);
    expect(entry.totalTimeMs).toBe(7000);
    expect(entry.totalMistakes).toBe(6);
  });

  it('tracks separate entries for different (variant, difficulty) pairs', () => {
    const store = createStatsStore();

    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'easy',
      timeMs: 1000,
      mistakes: 0,
      now: new Date('2026-04-15'),
    });
    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'hard',
      timeMs: 9000,
      mistakes: 5,
      now: new Date('2026-04-15'),
    });

    const easy = store.getState().entries[entryKey('classic', 'easy')];
    const hard = store.getState().entries[entryKey('classic', 'hard')];

    expect(easy.gamesCompleted).toBe(1);
    expect(easy.bestTimeMs).toBe(1000);
    expect(hard.gamesCompleted).toBe(1);
    expect(hard.bestTimeMs).toBe(9000);
  });

  it('resetStats() clears all populated entries back to the initialised shape', () => {
    const store = createStatsStore();

    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'easy',
      timeMs: 1000,
      mistakes: 0,
      now: new Date('2026-04-15'),
    });
    expect(store.getState().entries[entryKey('classic', 'easy')].gamesCompleted).toBe(1);

    store.getState().resetStats();

    // Every key still exists, but each entry is back to an empty record.
    expect(store.getState().entries).toEqual(initialStatsEntries());
    expect(store.getState().entries[entryKey('classic', 'easy')].gamesCompleted).toBe(0);
    expect(store.getState().entries[entryKey('classic', 'easy')].bestTimeMs).toBeNull();
  });

  it('initialises entry keys for every (variant, tier) combination the UI exposes', () => {
    const store = createStatsStore();
    const entries = store.getState().entries;

    // Classic iteration-7 ladder advertises all six tiers (Easy/Medium/Hard/
    // Expert/Master/Nightmare). The old Diabolical/Demonic tiers are collapsed.
    for (const slug of ['easy', 'medium', 'hard', 'expert', 'master', 'nightmare']) {
      expect(entries[entryKey('classic', slug)]).toBeDefined();
      expect(entries[entryKey('classic', slug)].gamesCompleted).toBe(0);
    }
    expect(entries[entryKey('classic', 'diabolical')]).toBeUndefined();
    expect(entries[entryKey('classic', 'demonic')]).toBeUndefined();

    // Six advertises Easy and Medium; harder tiers remain descoped on the 6×6
    // grid. Mini stays Easy-only. Total: 6 + 2 + 1 = 9 entries.
    expect(entries[entryKey('six', 'easy')]).toBeDefined();
    expect(entries[entryKey('six', 'medium')]).toBeDefined();
    expect(entries[entryKey('six', 'hard')]).toBeUndefined();

    expect(entries[entryKey('mini', 'easy')]).toBeDefined();
    expect(entries[entryKey('mini', 'medium')]).toBeUndefined();
    expect(entries[entryKey('mini', 'hard')]).toBeUndefined();

    expect(Object.keys(entries)).toHaveLength(9);
  });

  it('entryKey lowercases the difficulty before composing the key', () => {
    expect(entryKey('classic', 'Hard')).toBe('classic:hard');
  });

  it('records completions for the new tier names without losing prior keys', () => {
    const store = createStatsStore();

    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'nightmare',
      timeMs: 600_000,
      mistakes: 0,
      now: new Date('2026-04-20'),
    });

    const entries = store.getState().entries;
    expect(entries[entryKey('classic', 'nightmare')].gamesCompleted).toBe(1);
    expect(entries[entryKey('classic', 'nightmare')].bestTimeMs).toBe(600_000);

    // Other pre-initialised keys are unaffected.
    expect(entries[entryKey('classic', 'easy')].gamesCompleted).toBe(0);
    expect(entries[entryKey('mini', 'easy')].gamesCompleted).toBe(0);
  });

  it('uses the v4 storage key and bumped schema version', () => {
    expect(STATS_STORAGE_KEY).toBe('sudoku.stats.v4');
    expect(STATS_SCHEMA_VERSION).toBe(4);
  });

  it('silently ignores legacy v1 entries on load', () => {
    window.localStorage.setItem(
      'sudoku.stats.v1',
      JSON.stringify({
        state: {
          entries: {
            'classic:easy': {
              gamesCompleted: 99,
              bestTimeMs: 1234,
              currentStreak: 9,
              longestStreak: 9,
              lastPlayedDate: '2025-01-01',
              totalTimeMs: 99_000,
              totalMistakes: 9,
            },
          },
        },
        version: 0,
      }),
    );

    const store = createStatsStore();
    const easy = store.getState().entries[entryKey('classic', 'easy')];

    // The v1 payload is sitting under the old key, but the v4 store starts fresh.
    expect(easy.gamesCompleted).toBe(0);
    expect(easy.bestTimeMs).toBeNull();
  });

  it('stamps writes with the current appVersion under the v4 key', () => {
    const store = createStatsStore();
    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'easy',
      timeMs: 1000,
      mistakes: 0,
      now: new Date('2026-04-15'),
    });

    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(STATS_SCHEMA_VERSION);
    expect(typeof parsed.state.appVersion).toBe('string');
    expect(parsed.state.appVersion.length).toBeGreaterThan(0);
    expect(parsed.state.appVersion).toBe(__APP_VERSION__);

    expect(store.getState().appVersion).toBe(__APP_VERSION__);
  });

  it('refreshes the appVersion stamp on resetStats', () => {
    const store = createStatsStore();
    store.getState().resetStats();

    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.appVersion).toBe(__APP_VERSION__);
  });

  it('preserves persisted entries across store re-creation', () => {
    const first = createStatsStore();
    first.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'master',
      timeMs: 4242,
      mistakes: 1,
      now: new Date('2026-04-20'),
    });

    const second = createStatsStore();
    expect(second.getState().entries[entryKey('classic', 'master')].gamesCompleted).toBe(1);
    expect(second.getState().entries[entryKey('classic', 'master')].bestTimeMs).toBe(4242);
    // Pre-initialised keys for tiers that were never played still exist.
    expect(second.getState().entries[entryKey('classic', 'nightmare')].gamesCompleted).toBe(0);
  });
});
