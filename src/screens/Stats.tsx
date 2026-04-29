import { useState } from 'react';
import { useStore } from 'zustand';
import { statsStore, entryKey, type StatsEntry } from '../store/stats';
import { variants } from '../engine/variants';
import { availableTiers } from '../engine/generator/variant-tiers';
import type { Variant } from '../engine/types';
import type { Difficulty } from '../engine/generator/rate';
import { DifficultyBadge } from '../components/DifficultyBadge';

interface StatsProps {
  store?: typeof statsStore;
}

const EMPTY = '—';

function tierSlug(tier: Difficulty): string {
  return tier.toLowerCase();
}

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

interface VariantStatsProps {
  variant: Variant;
  entries: Record<string, StatsEntry>;
}

function VariantStats({ variant, entries }: VariantStatsProps) {
  const tiers = availableTiers(variant);
  const [selected, setSelected] = useState<Difficulty | null>(null);

  const visibleTiers = selected === null ? tiers : [selected];

  const pillBase =
    'px-2 py-0.5 rounded text-xs font-medium border transition-colors';
  const pillSelected = 'bg-blue-600 text-white border-blue-600';
  const pillUnselected =
    'bg-transparent text-gray-700 border-gray-300 hover:bg-gray-100 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-800';

  return (
    <section key={variant.id}>
      <h2 className="text-lg font-medium mb-2">{variant.id.toUpperCase()}</h2>
      {tiers.length > 1 ? (
        <div
          data-testid={`stats-filter-row-${variant.id}`}
          className="flex flex-wrap gap-1 mb-2"
        >
          <button
            type="button"
            data-testid={`stats-filter-${variant.id}-all`}
            onClick={() => setSelected(null)}
            className={`${pillBase} ${selected === null ? pillSelected : pillUnselected}`}
          >
            All
          </button>
          {tiers.map((tier) => {
            const slug = tierSlug(tier);
            const isSelected = selected === tier;
            return (
              <button
                key={slug}
                type="button"
                data-testid={`stats-filter-${variant.id}-${slug}`}
                onClick={() => setSelected(tier)}
                className={`${pillBase} ${isSelected ? pillSelected : pillUnselected}`}
              >
                {tier}
              </button>
            );
          })}
        </div>
      ) : null}
      <table
        data-testid={`stats-variant-${variant.id}`}
        className="w-full text-left border-collapse"
      >
        <thead>
          <tr>
            <th className="p-1 border-b" />
            {visibleTiers.map((tier) => {
              const slug = tierSlug(tier);
              return (
                <th key={slug} className="p-1 border-b font-normal">
                  <DifficultyBadge
                    difficulty={slug}
                    data-testid={`stats-header-${variant.id}-${slug}`}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {statRows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="p-1 font-normal">
                {row.label}
              </th>
              {visibleTiers.map((tier) => {
                const slug = tierSlug(tier);
                const entry = entries[entryKey(variant.id, slug)];
                return (
                  <td
                    key={slug}
                    data-testid={`stats-cell-${variant.id}-${slug}-${row.key}`}
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
  );
}

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
        <VariantStats key={variant.id} variant={variant} entries={entries} />
      ))}
    </div>
  );
}

export default Stats;
