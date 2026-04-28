import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Techniques } from './Techniques';
import { TECHNIQUE_CATALOG } from '../engine/solver/techniques/catalog';
import { DIFFICULTY_ORDER } from '../engine/generator/rate';

describe('Techniques screen', () => {
  it('renders all 34 techniques from the catalog', () => {
    expect(TECHNIQUE_CATALOG).toHaveLength(34);

    const { getByTestId } = render(<Techniques />);

    for (const entry of TECHNIQUE_CATALOG) {
      const row = getByTestId(`technique-row-${entry.id}`);
      expect(row).toBeTruthy();
      expect(row.textContent).toContain(entry.displayName);
    }
  });

  it('groups techniques by difficulty tier in ascending order', () => {
    const { getByTestId, queryByTestId, container } = render(<Techniques />);

    const presentTiers = new Set(TECHNIQUE_CATALOG.map((e) => e.tier));

    for (const tier of DIFFICULTY_ORDER) {
      const slug = tier.toLowerCase();
      if (presentTiers.has(tier)) {
        expect(getByTestId(`techniques-group-${slug}`)).toBeTruthy();
      } else {
        expect(queryByTestId(`techniques-group-${slug}`)).toBeNull();
      }
    }

    // Sections appear in DIFFICULTY_ORDER order.
    const sections = container.querySelectorAll('[data-testid^="techniques-group-"]');
    const renderedSlugs = Array.from(sections).map((el) =>
      el.getAttribute('data-testid')?.replace('techniques-group-', ''),
    );
    const expectedSlugs = DIFFICULTY_ORDER
      .filter((tier) => presentTiers.has(tier))
      .map((tier) => tier.toLowerCase());
    expect(renderedSlugs).toEqual(expectedSlugs);
  });

  it('places each technique inside its tier group', () => {
    const { getByTestId } = render(<Techniques />);

    for (const entry of TECHNIQUE_CATALOG) {
      const slug = entry.tier.toLowerCase();
      const group = getByTestId(`techniques-group-${slug}`);
      const row = getByTestId(`technique-row-${entry.id}`);
      expect(group.contains(row)).toBe(true);
    }
  });

  it('invokes onSelect with the technique id when a row is clicked', () => {
    const handleSelect = vi.fn();
    const { getByTestId } = render(<Techniques onSelect={handleSelect} />);

    fireEvent.click(getByTestId('technique-row-x-wing'));

    expect(handleSelect).toHaveBeenCalledWith('x-wing');
  });
});
