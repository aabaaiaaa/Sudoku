import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface StatsEntry {
  gamesCompleted: number;
  bestTimeMs: number | null;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string | null;
  totalTimeMs: number;
  totalMistakes: number;
}

export interface StatsState {
  entries: Record<string, StatsEntry>;
}

export interface StatsActions {
  recordCompletion: (args: {
    variant: string;
    difficulty: string;
    timeMs: number;
    mistakes: number;
    now?: Date;
  }) => void;
  resetStats: () => void;
}

export type StatsStore = StatsState & StatsActions;

export function entryKey(variant: string, difficulty: string): string {
  return `${variant}:${difficulty}`;
}

function emptyEntry(): StatsEntry {
  return {
    gamesCompleted: 0,
    bestTimeMs: null,
    currentStreak: 0,
    longestStreak: 0,
    lastPlayedDate: null,
    totalTimeMs: 0,
    totalMistakes: 0,
  };
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(prevIso: string, todayIso: string): number {
  const [py, pm, pd] = prevIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const prev = Date.UTC(py, pm - 1, pd);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.round((today - prev) / 86_400_000);
}

function storage() {
  if (typeof window === 'undefined') return undefined;
  return createJSONStorage(() => window.localStorage);
}

export function createStatsStore() {
  return createStore<StatsStore>()(
    persist(
      (set) => ({
        entries: {},

        recordCompletion: ({ variant, difficulty, timeMs, mistakes, now = new Date() }) => {
          set((state) => {
            const key = entryKey(variant, difficulty);
            const prev = state.entries[key] ?? emptyEntry();
            const todayIso = formatLocalDate(now);

            let currentStreak: number;
            if (prev.lastPlayedDate == null) {
              currentStreak = 1;
            } else if (prev.lastPlayedDate === todayIso) {
              currentStreak = prev.currentStreak === 0 ? 1 : prev.currentStreak;
            } else {
              const gap = daysBetween(prev.lastPlayedDate, todayIso);
              if (gap === 1) {
                currentStreak = prev.currentStreak + 1;
              } else {
                currentStreak = 1;
              }
            }

            const bestTimeMs =
              prev.bestTimeMs == null || timeMs < prev.bestTimeMs ? timeMs : prev.bestTimeMs;

            const next: StatsEntry = {
              gamesCompleted: prev.gamesCompleted + 1,
              bestTimeMs,
              currentStreak,
              longestStreak: Math.max(prev.longestStreak, currentStreak),
              lastPlayedDate: todayIso,
              totalTimeMs: prev.totalTimeMs + timeMs,
              totalMistakes: prev.totalMistakes + mistakes,
            };

            return { entries: { ...state.entries, [key]: next } };
          });
        },

        resetStats: () => {
          set({ entries: {} });
        },
      }),
      {
        name: 'sudoku.stats.v1',
        storage: storage(),
      },
    ),
  );
}

export const statsStore = createStatsStore();
