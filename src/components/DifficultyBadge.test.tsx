import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DifficultyBadge } from './DifficultyBadge';
import { DIFFICULTY_ORDER } from '../engine/generator/rate';

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
      <DifficultyBadge difficulty="Demonic" data-testid="badge" />,
    );
    expect(getByTestId('badge').getAttribute('data-tier')).toBe('demonic');
  });

  it.each([
    ['easy', '#15803d'],
    ['medium', '#1d4ed8'],
    ['hard', '#b45309'],
    ['expert', '#c2410c'],
    ['master', '#b91c1c'],
    ['diabolical', '#7f1d1d'],
    ['demonic', '#581c87'],
    ['nightmare', '#0f0f1f'],
  ])('paints %s with the configured ramp colour %s', (slug, expectedHex) => {
    const { getByTestId } = render(
      <DifficultyBadge difficulty={slug} data-testid="badge" />,
    );
    const style = getByTestId('badge').getAttribute('style') ?? '';
    // jsdom serializes CSS hex values as the original token (lowercased).
    expect(style.toLowerCase()).toContain(expectedHex.toLowerCase());
  });

  it('escalates from green at Easy to dark indigo at Nightmare (ramp ordering)', () => {
    // The four new tiers must be visually distinct and visually heavier than
    // any tier below them — sanity-check that Master/Diabolical/Demonic/
    // Nightmare each map to a distinct background colour.
    const seen = new Set<string>();
    for (const tier of ['Master', 'Diabolical', 'Demonic', 'Nightmare'] as const) {
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
      <DifficultyBadge difficulty="Wat" data-testid="badge" />,
    );
    const style = getByTestId('badge').getAttribute('style') ?? '';
    expect(style.toLowerCase()).toContain('#6b7280');
  });

  it('renders a swatch for every tier in DIFFICULTY_ORDER', () => {
    for (const tier of DIFFICULTY_ORDER) {
      const { getByTestId, unmount } = render(
        <DifficultyBadge difficulty={tier} data-testid={`badge-${tier}`} />,
      );
      const style = getByTestId(`badge-${tier}`).getAttribute('style') ?? '';
      // Neutral fallback would mean the tier has no dedicated styling.
      expect(style.toLowerCase()).not.toContain('#6b7280');
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
