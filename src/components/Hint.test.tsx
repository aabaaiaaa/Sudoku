import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createGameStore } from '../store/game';
import { createEmptyBoard } from '../engine/types';
import { classicVariant } from '../engine/variants';
import { Hint } from './Hint';
import type { Position } from '../engine/types';

/**
 * Builds a classic board where R1C1 has only digit 9 as a candidate (a naked
 * single). Mirrors the fixture used in the naked-single unit tests.
 */
function makeNakedSingleBoard() {
  const board = createEmptyBoard(classicVariant);
  board.cells[0][1].value = 1;
  board.cells[0][2].value = 2;
  board.cells[1][0].value = 3;
  board.cells[2][0].value = 4;
  board.cells[1][1].value = 5;
  board.cells[1][2].value = 6;
  board.cells[2][1].value = 7;
  board.cells[2][2].value = 8;
  return board;
}

describe('Hint', () => {
  it('does not show the hint panel before the button is clicked', () => {
    const store = createGameStore('classic');
    const { queryByTestId } = render(<Hint store={store} />);

    expect(queryByTestId('hint-panel')).toBeNull();
  });

  it('shows the technique name and explanation on click for a naked single', () => {
    const board = makeNakedSingleBoard();
    const store = createGameStore('classic');
    const highlighted: Position[][] = [];

    const { getByTestId } = render(
      <Hint
        store={store}
        board={board}
        onHighlight={(cells) => highlighted.push(cells)}
      />,
    );

    fireEvent.click(getByTestId('hint-button'));

    const panel = getByTestId('hint-panel');
    expect(panel).toBeTruthy();
    expect(getByTestId('hint-technique').textContent).toBe('Naked Single');
    expect(getByTestId('hint-explanation').textContent).toBe(
      'R1C1 has only 9 as a candidate',
    );

    // Should have reported the affected cell for highlighting.
    expect(highlighted).toEqual([[{ row: 0, col: 0 }]]);
  });

  it('shows a friendly message when no hint is available', () => {
    // An empty classic board has no progress available via any technique.
    const board = createEmptyBoard(classicVariant);
    const store = createGameStore('classic');
    const highlighted: Position[][] = [];

    const { getByTestId, queryByTestId } = render(
      <Hint
        store={store}
        board={board}
        onHighlight={(cells) => highlighted.push(cells)}
      />,
    );

    fireEvent.click(getByTestId('hint-button'));

    const panel = getByTestId('hint-panel');
    expect(panel).toBeTruthy();
    expect(panel.textContent).toMatch(/no available hint/i);

    // Nothing to highlight in the miss case.
    expect(highlighted).toEqual([[]]);
    // Technique sub-elements should not be present in the miss panel.
    expect(queryByTestId('hint-technique')).toBeNull();
  });

  it('renders a learn more link pointing to the matching technique detail route', () => {
    const board = makeNakedSingleBoard();
    const store = createGameStore('classic');

    const { getByTestId } = render(<Hint store={store} board={board} />);

    fireEvent.click(getByTestId('hint-button'));

    const link = getByTestId('hint-learn-more') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.tagName).toBe('A');
    expect(link.textContent).toBe('Learn more about Naked Single →');
    // href reflects the hash route the App router parses for technique detail.
    expect(link.getAttribute('href')).toBe('#/learn/naked-single');
  });

  it('does not render the learn more link when no hint is available', () => {
    const board = createEmptyBoard(classicVariant);
    const store = createGameStore('classic');

    const { getByTestId, queryByTestId } = render(
      <Hint store={store} board={board} />,
    );

    fireEvent.click(getByTestId('hint-button'));

    expect(queryByTestId('hint-learn-more')).toBeNull();
    // Sanity check: the miss panel is what's actually rendered.
    expect(getByTestId('hint-panel').textContent).toMatch(/no available hint/i);
  });
});
