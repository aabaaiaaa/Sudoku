import type { CSSProperties } from 'react';
import { DIFFICULTY_ORDER, type Difficulty } from '../engine/generator/rate';

interface DifficultyBadgeProps {
  /**
   * Tier label. Accepts the canonical {@link Difficulty} union or its
   * lowercase slug (e.g. `'easy'`) — the picker / save layer uses lowercase
   * while engine code uses Title Case. Unknown values render as a neutral
   * badge with the raw text.
   */
  difficulty: string;
  className?: string;
  /** Optional test id forwarded onto the rendered span. */
  'data-testid'?: string;
  /** Extra inline style — merged with the tier swatch styles. */
  style?: CSSProperties;
}

/**
 * Per-tier swatch (background + foreground). The ramp escalates visually
 * through the six tiers per iteration-7 requirements §10 — cool calm
 * (green/blue) at the easy end, warming through amber/orange, then deep
 * red into a near-black indigo at Nightmare.
 *
 * The renamed `master` slot uses red-900 (deeper than the old
 * red-700) to preserve the visual escalation between Expert and
 * Nightmare; the orange→red-900 jump matches the corresponding
 * semantic jump (chains and ALS are a meaningful step harder than
 * wings and fish).
 *
 * Colours are inline rather than Tailwind classes because Tailwind is
 * configured with no safelist, and the plugin would need every concrete
 * class on the source for the JIT to keep them. Inline styles also let the
 * badge render correctly under any theme without re-mapping CSS variables.
 */
const TIER_SWATCH: Record<string, { background: string; color: string }> = {
  easy: { background: '#15803d', color: '#ffffff' },      // green-700
  medium: { background: '#1d4ed8', color: '#ffffff' },    // blue-700
  hard: { background: '#b45309', color: '#ffffff' },      // amber-700
  expert: { background: '#c2410c', color: '#ffffff' },    // orange-700
  master: { background: '#7f1d1d', color: '#ffffff' },    // red-900
  nightmare: { background: '#0f0f1f', color: '#ffffff' }, // near-black indigo
};

const NEUTRAL_SWATCH = { background: '#6b7280', color: '#ffffff' }; // gray-500

function tierKey(difficulty: string): string {
  return difficulty.toLowerCase();
}

function isKnownTier(slug: string): boolean {
  return DIFFICULTY_ORDER.some((t: Difficulty) => t.toLowerCase() === slug);
}

export function DifficultyBadge({
  difficulty,
  className,
  'data-testid': testId,
  style,
}: DifficultyBadgeProps) {
  const slug = tierKey(difficulty);
  const swatch = isKnownTier(slug)
    ? TIER_SWATCH[slug] ?? NEUTRAL_SWATCH
    : NEUTRAL_SWATCH;

  const baseClass =
    'inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize tracking-wide';
  const composed = className ? `${baseClass} ${className}` : baseClass;

  return (
    <span
      data-testid={testId}
      data-tier={slug}
      className={composed}
      style={{ ...swatch, ...style }}
    >
      {difficulty}
    </span>
  );
}

export default DifficultyBadge;
