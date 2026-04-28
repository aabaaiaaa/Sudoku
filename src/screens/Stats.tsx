import { useState } from 'react';
import { useStore } from 'zustand';
import { statsStore, entryKey, type StatsEntry } from '../store/stats';
import { variants } from '../engine/variants';
import { DifficultyBadge } from '../components/DifficultyBadge';

interface StatsProps {
  store?: typeof statsStore;
}

const difficulties = ['easy', 'medium', 'hard', 'expert'] as const;
type Difficulty = (typeof difficulties)[number];

const EMPTY = '\u2014';

function formatTime(ms: number | null): string {
  if (ms == null) return EMPTY;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function averageTime(entry: StatsEntry | undefined): number | null {
  if (!entry || entry.gamesCompleted === 0) return null;
  return Math.round(entry.totalTimeMs / entry.gamesCompleted);
}

function statCellText(
  entry: StatsEntry | undefined,
  stat: 'games' | 'best' | 'current' | 'longest' | 'avg' | 'mistakes',
): string {
  if (!entry || entry.gamesCompleted === 0) return EMPTY;
  switch (stat) {
    case 'games':
      return String(entry.gamesCompleted);
    case 'best':
      return formatTime(entry.bestTimeMs);
    case 'current':
      return String(entry.currentStreak);
    case 'longest':
      return String(entry.longestStreak);
    case 'avg':
      return formatTime(averageTime(entry));
    case 'mistakes':
      return String(entry.totalMistakes);
  }
}

const statRows: Array<{
  key: 'games' | 'best' | 'current' | 'longest' | 'avg' | 'mistakes';
  label: string;
}> = [
  { key: 'games', label: 'Games completed' },
  { key: 'best', label: 'Best time' },
  { key: 'current', label: 'Current streak' },
  { key: 'longest', label: 'Longest streak' },
  { key: 'avg', label: 'Average time' },
  { key: 'mistakes', label: 'Total mistakes' },
];

export function Stats({ store = statsStore }: StatsProps) {
  const entries = useStore(store, (s) => s.entries);
  const resetStats = useStore(store, (s) => s.resetStats);
  const [confirming, setConfirming] = useState(false);

  const handleReset = () => setConfirming(true);
  const handleConfirm = () => {
    resetStats();
    setConfirming(false);
  };
  const handleCancel = () => setConfirming(false);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stats</h1>
        {confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="stats-reset-confirm"
              onClick={handleConfirm}
              className="btn"
            >
              Confirm reset
            </button>
            <button
              type="button"
              data-testid="stats-reset-cancel"
              onClick={handleCancel}
              className="btn"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="stats-reset"
            onClick={handleReset}
            className="btn"
          >
            Reset
          </button>
        )}
      </div>

      {Object.values(variants).map((variant) => (
        <section key={variant.id}>
          <h2 className="text-lg font-medium mb-2">{variant.id.toUpperCase()}</h2>
          <table
            data-testid={`stats-variant-${variant.id}`}
            className="w-full text-left border-collapse"
          >
            <thead>
              <tr>
                <th className="p-1 border-b" />
                {difficulties.map((d) => (
                  <th key={d} className="p-1 border-b font-normal">
                    <DifficultyBadge
                      difficulty={d}
                      data-testid={`stats-header-${variant.id}-${d}`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="p-1 font-normal">
                    {row.label}
                  </th>
                  {difficulties.map((d: Difficulty) => {
                    const entry = entries[entryKey(variant.id, d)];
                    return (
                      <td
                        key={d}
                        data-testid={`stats-cell-${variant.id}-${d}-${row.key}`}
                        className="p-1"
                      >
                        {statCellText(entry, row.key)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

export default Stats;
