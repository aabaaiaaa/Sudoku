import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createGameStore } from '../store/game';
import { KeyboardHandler } from './KeyboardHandler';

describe('KeyboardHandler', () => {
  it('ArrowDown from {0,0} moves selection to {1,0}', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 0 });
    render(<KeyboardHandler store={store} />);

    fireEvent.keyDown(window, { key: 'ArrowDown' });

    expect(store.getState().selection).toEqual({ row: 1, col: 0 });
  });

  it('ArrowUp at row 0 stays at row 0', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 3 });
    render(<KeyboardHandler store={store} />);

    fireEvent.keyDown(window, { key: 'ArrowUp' });

    expect(store.getState().selection).toEqual({ row: 0, col: 3 });
  });

  it('arrow key with no selection picks {0,0}', () => {
    const store = createGameStore('classic');
    expect(store.getState().selection).toBeNull();
    render(<KeyboardHandler store={store} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(store.getState().selection).toEqual({ row: 0, col: 0 });
  });

  it("digit '5' places the digit in the selected cell", () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 2, col: 4 });
    render(<KeyboardHandler store={store} />);

    fireEvent.keyDown(window, { key: '5' });

    expect(store.getState().board.cells[2][4].value).toBe(5);
  });

  it("pressing 'n' toggles notesMode; digit then toggles a note instead of placing", () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 0 });
    render(<KeyboardHandler store={store} />);

    fireEvent.keyDown(window, { key: 'n' });
    expect(store.getState().notesMode).toBe(true);

    fireEvent.keyDown(window, { key: '5' });

    const cell = store.getState().board.cells[0][0];
    expect(cell.notes.has(5)).toBe(true);
    expect(cell.value).toBeNull();
  });

  it('Backspace erases the selected cell value', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 0 });
    render(<KeyboardHandler store={store} />);

    fireEvent.keyDown(window, { key: '7' });
    expect(store.getState().board.cells[0][0].value).toBe(7);

    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(store.getState().board.cells[0][0].value).toBeNull();
  });

  it('Escape sets selection to null', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 3, col: 3 });
    render(<KeyboardHandler store={store} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(store.getState().selection).toBeNull();
  });

  it('Space toggles pause and resume via timer.paused', () => {
    const store = createGameStore('classic');
    render(<KeyboardHandler store={store} />);

    // Timer starts paused.
    expect(store.getState().timer.paused).toBe(true);

    fireEvent.keyDown(window, { key: ' ' });
    const afterFirst = store.getState().timer;
    expect(afterFirst.paused).toBe(false);
    expect(afterFirst.startTs).not.toBeNull();

    fireEvent.keyDown(window, { key: ' ' });
    expect(store.getState().timer.paused).toBe(true);
  });

  it('ignores digits out of variant size range', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 0 });
    render(<KeyboardHandler store={store} />);

    fireEvent.keyDown(window, { key: '0' });
    expect(store.getState().board.cells[0][0].value).toBeNull();

    fireEvent.keyDown(window, { key: 'a' });
    expect(store.getState().board.cells[0][0].value).toBeNull();
  });

  it('removes the listener on unmount', () => {
    const store = createGameStore('classic');
    store.getState().select({ row: 0, col: 0 });
    const { unmount } = render(<KeyboardHandler store={store} />);

    unmount();

    const before = store.getState();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const after = store.getState();

    expect(after.selection).toEqual(before.selection);
  });
});
