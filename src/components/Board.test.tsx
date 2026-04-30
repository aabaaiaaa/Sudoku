import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createGameStore } from '../store/game';
import { Board } from './Board';

describe('Board', () => {
  it('renders a 9x9 Classic empty board with 81 cells', () => {
    const store = createGameStore('classic');
    const { getByTestId, container } = render(<Board store={store} />);

    expect(getByTestId('sudoku-board')).toBeTruthy();

    const cells = container.querySelectorAll('[data-testid^="cell-r"]');
    expect(cells.length).toBe(81);

    // Spot-check a few expected cell testids.
    expect(getByTestId('cell-r0-c0')).toBeTruthy();
    expect(getByTestId('cell-r8-c8')).toBeTruthy();
    expect(getByTestId('cell-r4-c4')).toBeTruthy();
  });

  it('calls onSelectCell with the clicked position', () => {
    const store = createGameStore('classic');
    const calls: { row: number; col: number }[] = [];
    const { getByTestId } = render(
      <Board store={store} onSelectCell={(pos) => calls.push(pos)} />,
    );

    fireEvent.click(getByTestId('cell-r3-c5'));

    expect(calls).toEqual([{ row: 3, col: 5 }]);
  });

  it('updates store selection when no onSelectCell override is provided', () => {
    const store = createGameStore('classic');
    const { getByTestId } = render(<Board store={store} />);

    fireEvent.click(getByTestId('cell-r2-c7'));

    expect(store.getState().selection).toEqual({ row: 2, col: 7 });
  });

  it('cellHighlights adds data-role to the specified cells', () => {
    const store = createGameStore('classic');
    const highlights = [
      { pos: { row: 0, col: 0 }, role: 'elimination' as const },
      { pos: { row: 4, col: 4 }, role: 'placement' as const },
    ];
    const { getByTestId } = render(<Board store={store} cellHighlights={highlights} />);

    expect(getByTestId('cell-r0-c0').getAttribute('data-role')).toBe('elimination');
    expect(getByTestId('cell-r4-c4').getAttribute('data-role')).toBe('placement');
    // Cell not in highlights has no data-role attribute
    expect(getByTestId('cell-r1-c1').getAttribute('data-role')).toBeNull();
  });

  it('multiple cells in cellHighlights all receive their data-role attributes', () => {
    const store = createGameStore('classic');
    const highlights = [
      { pos: { row: 0, col: 0 }, role: 'pattern-primary' as const },
      { pos: { row: 0, col: 1 }, role: 'pattern-secondary' as const },
      { pos: { row: 1, col: 0 }, role: 'elimination' as const },
    ];
    const { getByTestId } = render(<Board store={store} cellHighlights={highlights} />);

    expect(getByTestId('cell-r0-c0').getAttribute('data-role')).toBe('pattern-primary');
    expect(getByTestId('cell-r0-c1').getAttribute('data-role')).toBe('pattern-secondary');
    expect(getByTestId('cell-r1-c0').getAttribute('data-role')).toBe('elimination');
    expect(getByTestId('cell-r2-c2').getAttribute('data-role')).toBeNull();
  });

  it('omitting cellHighlights leaves no data-role attributes on any cell', () => {
    const store = createGameStore('classic');
    const { container } = render(<Board store={store} />);

    const cellsWithRole = container.querySelectorAll('[data-role]');
    expect(cellsWithRole.length).toBe(0);
  });
});
