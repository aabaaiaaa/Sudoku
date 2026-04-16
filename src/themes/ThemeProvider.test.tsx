import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createSettingsStore } from '../store/settings';
import { ThemeProvider } from './ThemeProvider';

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

describe('ThemeProvider', () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies data-theme attribute matching the current theme', () => {
    const store = createSettingsStore();
    store.getState().setTheme('dark');

    render(<ThemeProvider store={store} />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('updates data-theme attribute when the store theme changes', () => {
    const store = createSettingsStore();
    store.getState().setTheme('dark');

    render(<ThemeProvider store={store} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      store.getState().setTheme('light');
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applies data-theme="notepad" when the notepad theme is selected', () => {
    const store = createSettingsStore();
    store.getState().setTheme('notepad');

    render(<ThemeProvider store={store} />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('notepad');
  });

  it('applies data-theme="space" when the space theme is selected', () => {
    const store = createSettingsStore();
    store.getState().setTheme('space');

    render(<ThemeProvider store={store} />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('space');
  });

  it('switches data-theme between all four registered themes', () => {
    const store = createSettingsStore();
    store.getState().setTheme('light');

    render(<ThemeProvider store={store} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => {
      store.getState().setTheme('notepad');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('notepad');

    act(() => {
      store.getState().setTheme('space');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('space');

    act(() => {
      store.getState().setTheme('dark');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
