import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TechniqueDetail } from './TechniqueDetail';
import { fixture as hiddenPairFixture } from '../engine/solver/techniques/hidden-pair.fixture';

describe('TechniqueDetail screen', () => {
  it('renders the technique name, tier badge, and description', () => {
    const { getByTestId, getByText } = render(
      <TechniqueDetail id="hidden-pair" />,
    );

    expect(getByTestId('technique-detail')).toBeTruthy();
    expect(getByText('Hidden Pair')).toBeTruthy();
    expect(getByTestId('technique-detail-description').textContent).toBe(
      hiddenPairFixture.description,
    );
  });

  it('embeds the Board with the fixture board state', () => {
    const { getByTestId } = render(<TechniqueDetail id="hidden-pair" />);

    // Hidden Pair fixture (Classic 9x9): the given at (1,3) is digit 1.
    expect(getByTestId('cell-r1-c3').textContent).toBe('1');
    expect(getByTestId('cell-r2-c3').textContent).toBe('2');
    expect(getByTestId('cell-r3-c2').textContent).toBe('1');
    expect(getByTestId('cell-r4-c2').textContent).toBe('2');
  });

  it('starts in the initial walkthrough step', () => {
    const { getByTestId } = render(<TechniqueDetail id="hidden-pair" />);
    expect(getByTestId('technique-detail').getAttribute('data-walkthrough-step'))
      .toBe('initial');
  });

  it('advances through highlight, deduction, and apply steps', () => {
    const { getByTestId, queryByTestId } = render(
      <TechniqueDetail id="hidden-pair" />,
    );

    const root = getByTestId('technique-detail');

    fireEvent.click(getByTestId('walkthrough-highlight'));
    expect(root.getAttribute('data-walkthrough-step')).toBe('pattern');
    expect(queryByTestId('walkthrough-pattern-cells')).not.toBeNull();
    expect(queryByTestId('walkthrough-pattern-cells')!.textContent).not.toMatch(/[Rr]\d+[Cc]\d+/);
    expect(queryByTestId('walkthrough-pattern-cells')!.textContent).toMatch(/highlighted cells/i);

    fireEvent.click(getByTestId('walkthrough-show-deduction'));
    expect(root.getAttribute('data-walkthrough-step')).toBe('deduction');
    expect(queryByTestId('walkthrough-deduction')).not.toBeNull();
    expect(queryByTestId('walkthrough-deduction')!.textContent).not.toMatch(/[Rr]\d+[Cc]\d+/);
    expect(queryByTestId('walkthrough-deduction')!.textContent).toMatch(/highlighted cell/i);

    fireEvent.click(getByTestId('walkthrough-apply'));
    expect(root.getAttribute('data-walkthrough-step')).toBe('applied');
  });

  it('updates the board on apply to reflect the deduction', () => {
    const { getByTestId } = render(<TechniqueDetail id="hidden-pair" />);

    // Before apply, the eliminated cells are empty.
    expect(getByTestId('cell-r0-c0').textContent).toBe('');

    fireEvent.click(getByTestId('walkthrough-highlight'));
    fireEvent.click(getByTestId('walkthrough-show-deduction'));
    fireEvent.click(getByTestId('walkthrough-apply'));

    // Hidden Pair fixture eliminates {3..9} from r0c0; only {1,2} survive as
    // pencil marks. The Board renders pencil notes inside the cell.
    const cell = getByTestId('cell-r0-c0');
    expect(cell.textContent).toContain('1');
    expect(cell.textContent).toContain('2');
    expect(cell.textContent).not.toContain('3');
    expect(cell.textContent).not.toContain('9');
  });

  it('reset returns the walkthrough to the initial step', () => {
    const { getByTestId } = render(<TechniqueDetail id="hidden-pair" />);

    fireEvent.click(getByTestId('walkthrough-highlight'));
    fireEvent.click(getByTestId('walkthrough-show-deduction'));
    fireEvent.click(getByTestId('walkthrough-apply'));
    fireEvent.click(getByTestId('walkthrough-reset'));

    expect(
      getByTestId('technique-detail').getAttribute('data-walkthrough-step'),
    ).toBe('initial');
    // Eliminations are no longer reflected on the board.
    expect(getByTestId('cell-r0-c0').textContent).toBe('');
  });

  it('disables the Highlight button after pattern step is reached', () => {
    const { getByTestId } = render(<TechniqueDetail id="hidden-pair" />);

    expect(
      (getByTestId('walkthrough-highlight') as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(getByTestId('walkthrough-highlight'));
    expect(
      (getByTestId('walkthrough-highlight') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (getByTestId('walkthrough-show-deduction') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('renders a walkthrough for previously-fixtureless techniques (e.g. naked-single)', () => {
    // Every catalog entry now ships a fixture, so the originally bare
    // techniques (naked-single, hidden-single, x-wing, etc.) render the
    // full walkthrough rather than a placeholder.
    const { getByText, queryByTestId } = render(
      <TechniqueDetail id="naked-single" />,
    );

    expect(getByText('Naked Single')).toBeTruthy();
    expect(queryByTestId('walkthrough-highlight')).not.toBeNull();
  });

  it('walkthrough panel never contains r1c1-style cell coordinates', () => {
    const { getByTestId } = render(<TechniqueDetail id="hidden-pair" />);

    const panel = getByTestId('walkthrough-panel');

    fireEvent.click(getByTestId('walkthrough-highlight'));
    expect(panel.textContent).not.toMatch(/[Rr]\d+[Cc]\d+/);

    fireEvent.click(getByTestId('walkthrough-show-deduction'));
    expect(panel.textContent).not.toMatch(/[Rr]\d+[Cc]\d+/);

    fireEvent.click(getByTestId('walkthrough-apply'));
    expect(panel.textContent).not.toMatch(/[Rr]\d+[Cc]\d+/);
  });

  it('renders a role legend for xy-wing with pivot, pincer, and elimination roles', () => {
    const { getByTestId } = render(<TechniqueDetail id="xy-wing" />);

    const legend = getByTestId('role-legend');
    expect(legend).toBeTruthy();
    expect(legend.textContent).toContain('Centre cell');
    expect(legend.textContent).toContain('Side cell');
    expect(legend.textContent).toContain('Cells affected');
  });

  it('renders the Terms used here section for techniques with glossaryTerms', () => {
    const { getByTestId, queryByTestId } = render(
      <TechniqueDetail id="naked-single" />,
    );

    const section = getByTestId('glossary-section');
    expect(section).toBeTruthy();
    expect(section.textContent).toContain('Terms used here');
    expect(queryByTestId('glossary-list')).toBeNull();

    fireEvent.click(getByTestId('glossary-toggle'));
    expect(queryByTestId('glossary-list')).not.toBeNull();
  });

  it('invokes onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    const { getByTestId } = render(
      <TechniqueDetail id="hidden-pair" onBack={onBack} />,
    );

    fireEvent.click(getByTestId('technique-detail-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
