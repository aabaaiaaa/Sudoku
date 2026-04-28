import { DIFFICULTY_ORDER, type Difficulty } from '../engine/generator/rate';
import {
  TECHNIQUE_CATALOG,
  TECHNIQUE_ORDER,
  type TechniqueCatalogEntry,
} from '../engine/solver/techniques/catalog';
import type { TechniqueId } from '../engine/solver/techniques';
import { DifficultyBadge } from '../components/DifficultyBadge';

interface TechniquesProps {
  /**
   * Optional callback invoked when a technique row is activated. Wired up by
   * TASK-057 to navigate to the technique detail page. Until then the rows
   * still render and respond to clicks but no navigation occurs.
   */
  onSelect?: (id: TechniqueId) => void;
}

function tierSlug(tier: Difficulty): string {
  return tier.toLowerCase();
}

interface OrderedEntry extends TechniqueCatalogEntry {
  id: TechniqueId;
}

function groupByTier(): Map<Difficulty, OrderedEntry[]> {
  const groups = new Map<Difficulty, OrderedEntry[]>();
  for (const id of TECHNIQUE_ORDER) {
    const entry = TECHNIQUE_CATALOG[id];
    const ordered: OrderedEntry = { id, ...entry };
    const bucket = groups.get(entry.tier);
    if (bucket) {
      bucket.push(ordered);
    } else {
      groups.set(entry.tier, [ordered]);
    }
  }
  return groups;
}

export function Techniques({ onSelect }: TechniquesProps = {}) {
  const groups = groupByTier();

  return (
    <div
      data-testid="techniques-screen"
      className="p-4 space-y-6 overflow-y-auto"
      style={{ maxHeight: '100vh', paddingBottom: '5rem' }}
    >
      <h1 className="text-xl font-semibold">Learn</h1>

      {DIFFICULTY_ORDER.map((tier) => {
        const items = groups.get(tier);
        if (!items || items.length === 0) return null;
        const slug = tierSlug(tier);
        return (
          <section
            key={slug}
            data-testid={`techniques-group-${slug}`}
            className="space-y-2"
          >
            <h2 className="text-lg font-medium flex items-center gap-2">
              <DifficultyBadge difficulty={slug} />
              <span>{tier}</span>
            </h2>
            <ul className="flex flex-col rounded-md overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              {items.map((entry) => (
                <li
                  key={entry.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    data-testid={`technique-row-${entry.id}`}
                    onClick={() => onSelect?.(entry.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                  >
                    <span className="font-medium">{entry.displayName}</span>
                    <DifficultyBadge difficulty={slug} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default Techniques;
