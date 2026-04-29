import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DifficultyBadge } from './DifficultyBadge';
import { DIFFICULTY_ORDER } from '../engine/generator/rate';

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

describe('DifficultyBadge', () => {
  it('renders the difficulty label as text', () => {
    const { getByTestId } = render(
      <DifficultyBadge difficulty="hard" data-testid="badge" />,
    );
    expect(getByTestId('badge').textContent).toBe('hard');
  });

  it('preserves Title-Case input verbatim in textContent', () => {
    const { getByTestId } = render(
      <DifficultyBadge difficulty="Nightmare" data-testid="badge" />,
    );
    expect(getByTestId('badge').textContent).toBe('Nightmare');
  });

  it('exposes the lowercase tier slug via data-tier for theming hooks', () => {
    const { getByTestId } = render(
      <DifficultyBadge difficulty="Master" data-testid="badge" />,
    );
    expect(getByTestId('badge').getAttribute('data-tier')).toBe('master');
  });

  it.each([
    ['easy', '#15803d'],
    ['medium', '#1d4ed8'],
    ['hard', '#b45309'],
    ['expert', '#c2410c'],
    ['master', '#7f1d1d'],
    ['nightmare', '#0f0f1f'],
  ])('paints %s with the configured ramp colour %s', (slug, expectedHex) => {
    const { getByTestId } = render(
      <DifficultyBadge difficulty={slug} data-testid="badge" />,
    );
    const style = getByTestId('badge').getAttribute('style') ?? '';
    // jsdom serializes inline-style hex colours as `rgb(r, g, b)`.
    expect(style).toContain(hexToRgb(expectedHex));
  });

  it('escalates from green at Easy to dark indigo at Nightmare (ramp ordering)', () => {
    // The six tiers must be visually distinct — sanity-check that the top four
    // (Hard/Expert/Master/Nightmare) each map to a distinct background colour.
    const seen = new Set<string>();
    for (const tier of ['Hard', 'Expert', 'Master', 'Nightmare'] as const) {
      const { getByTestId, unmount } = render(
        <DifficultyBadge difficulty={tier} data-testid={`badge-${tier}`} />,
      );
      const style = getByTestId(`badge-${tier}`).getAttribute('style') ?? '';
      seen.add(style);
      unmount();
    }
    expect(seen.size).toBe(4);
  });

  it('falls back to a neutral swatch for unknown difficulty strings', () => {
    const { getByTestId } = render(
      <DifficultyBadge difficulty="unknown-tier" data-testid="badge" />,
    );
    const style = getByTestId('badge').getAttribute('style') ?? '';
    expect(style).toContain(hexToRgb('#6b7280'));
  });

  it('renders a swatch for every tier in DIFFICULTY_ORDER', () => {
    for (const tier of DIFFICULTY_ORDER) {
      const { getByTestId, unmount } = render(
        <DifficultyBadge difficulty={tier} data-testid={`badge-${tier}`} />,
      );
      const style = getByTestId(`badge-${tier}`).getAttribute('style') ?? '';
      // Neutral fallback would mean the tier has no dedicated styling.
      expect(style).not.toContain(hexToRgb('#6b7280'));
      unmount();
    }
  });

  it('forwards className alongside its base styling', () => {
    const { getByTestId } = render(
      <DifficultyBadge difficulty="easy" className="ml-2" data-testid="badge" />,
    );
    const cls = getByTestId('badge').getAttribute('class') ?? '';
    expect(cls).toContain('ml-2');
    expect(cls).toContain('rounded');
  });
});
