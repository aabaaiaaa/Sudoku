import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createGameStore } from '../store/game';
import { NumberPad } from './NumberPad';

describe('NumberPad', () => {
  it('places a digit on the selected cell in default mode', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 0 });

    const { getByTestId } = render(<NumberPad store={store} />);
    fireEvent.click(getByTestId('pad-digit-5'));

    expect(store.getState().board.cells[0][0].value).toBe(5);
  });

  it('toggles a note when notes mode is on', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 0 });

    const { getByTestId } = render(<NumberPad store={store} />);
    fireEvent.click(getByTestId('pad-notes'));
    expect(store.getState().notesMode).toBe(true);

    fireEvent.click(getByTestId('pad-digit-5'));

    const cell = store.getState().board.cells[0][0];
    expect(cell.notes.has(5)).toBe(true);
    expect(cell.value).toBeNull();
  });

  it('erases the selected cell', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 0 });

    const { getByTestId } = render(<NumberPad store={store} />);
    fireEvent.click(getByTestId('pad-digit-7'));
    expect(store.getState().board.cells[0][0].value).toBe(7);

    fireEvent.click(getByTestId('pad-erase'));
    expect(store.getState().board.cells[0][0].value).toBeNull();
  });
});
