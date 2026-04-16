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
});
