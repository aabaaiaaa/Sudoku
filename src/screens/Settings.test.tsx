import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createSettingsStore } from '../store/settings';
import { Settings } from './Settings';

function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('Settings screen', () => {
  beforeEach(() => {
    stubMatchMedia(false);
    window.localStorage.clear();
  });

  it('renders theme options and the follow-system toggle', () => {
    const store = createSettingsStore();
    const { getByTestId } = render(<Settings store={store} />);

    expect(getByTestId('settings-theme-light')).toBeTruthy();
    expect(getByTestId('settings-theme-dark')).toBeTruthy();
    expect(getByTestId('settings-theme-notepad')).toBeTruthy();
    expect(getByTestId('settings-theme-space')).toBeTruthy();
    expect(getByTestId('settings-follow-system-toggle')).toBeTruthy();
  });

  it('selecting a non-auto theme clears the follow-system toggle', () => {
    const store = createSettingsStore();
    store.setState({ followSystem: true, theme: 'light' });

    const { getByTestId } = render(<Settings store={store} />);

    const toggle = getByTestId('settings-follow-system-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    fireEvent.click(getByTestId('settings-theme-notepad'));

    expect(store.getState().theme).toBe('notepad');
    expect(store.getState().followSystem).toBe(false);

    const toggleAfter = getByTestId('settings-follow-system-toggle') as HTMLInputElement;
    expect(toggleAfter.checked).toBe(false);
  });

  it('toggling follow-system ON picks the dark theme when system prefers dark', () => {
    stubMatchMedia(true);
    const store = createSettingsStore();
    store.setState({ theme: 'notepad', followSystem: false });

    const { getByTestId } = render(<Settings store={store} />);

    const toggle = getByTestId('settings-follow-system-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    expect(store.getState().followSystem).toBe(true);
    expect(store.getState().theme).toBe('dark');
  });

  it('toggling follow-system ON picks the light theme when system prefers light', () => {
    stubMatchMedia(false);
    const store = createSettingsStore();
    store.setState({ theme: 'notepad', followSystem: false });

    const { getByTestId } = render(<Settings store={store} />);

    const toggle = getByTestId('settings-follow-system-toggle') as HTMLInputElement;
    fireEvent.click(toggle);

    expect(store.getState().followSystem).toBe(true);
    expect(store.getState().theme).toBe('light');
  });

  it('shows Remove old saves button when legacy saves exist and removes them on confirm', () => {
    window.localStorage.setItem(
      'sudoku.save.v2',
      JSON.stringify({ version: 2, saves: {} }),
    );

    const store = createSettingsStore();
    const { getByTestId, queryByTestId } = render(<Settings store={store} />);

    expect(queryByTestId('settings-remove-old-saves')).toBeTruthy();

    fireEvent.click(getByTestId('settings-remove-old-saves'));

    expect(queryByTestId('confirm-dialog')).toBeTruthy();

    fireEvent.click(getByTestId('confirm-dialog-confirm'));

    expect(window.localStorage.getItem('sudoku.save.v2')).toBeNull();
    expect(queryByTestId('settings-remove-old-saves')).toBeNull();
  });

  it('does not render the Storage section when no legacy saves exist', () => {
    const store = createSettingsStore();
    const { queryByTestId } = render(<Settings store={store} />);

    expect(queryByTestId('settings-remove-old-saves')).toBeNull();
  });
});
