import { beforeEach, describe, expect, it } from 'vitest';
import { createStatsStore, entryKey } from './stats';

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

  it('resetStats() clears all entries', () => {
    const store = createStatsStore();

    store.getState().recordCompletion({
      variant: 'classic',
      difficulty: 'easy',
      timeMs: 1000,
      mistakes: 0,
      now: new Date('2026-04-15'),
    });
    expect(Object.keys(store.getState().entries).length).toBe(1);

    store.getState().resetStats();
    expect(store.getState().entries).toEqual({});
  });
});
