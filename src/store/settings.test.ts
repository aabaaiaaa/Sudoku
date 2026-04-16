import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from './settings';

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

describe('settings store', () => {
  beforeEach(() => {
    stubMatchMedia(false);
    localStorage.clear();
  });

  it('setTheme sets the theme and turns off followSystem', () => {
    const store = createSettingsStore();
    store.setState({ followSystem: true });

    store.getState().setTheme('dark');

    expect(store.getState().theme).toBe('dark');
    expect(store.getState().followSystem).toBe(false);
  });

  it('setFollowSystem(true) uses dark theme when system prefers dark', () => {
    stubMatchMedia(true);
    const store = createSettingsStore();

    store.getState().setFollowSystem(true);

    expect(store.getState().followSystem).toBe(true);
    expect(store.getState().theme).toBe('dark');
  });

  it('setFollowSystem(true) uses light theme when system prefers light', () => {
    stubMatchMedia(false);
    const store = createSettingsStore();
    store.setState({ theme: 'dark' });

    store.getState().setFollowSystem(true);

    expect(store.getState().followSystem).toBe(true);
    expect(store.getState().theme).toBe('light');
  });

  it('setFollowSystem(false) does not change the theme', () => {
    const store = createSettingsStore();
    store.setState({ theme: 'notepad', followSystem: true });

    store.getState().setFollowSystem(false);

    expect(store.getState().followSystem).toBe(false);
    expect(store.getState().theme).toBe('notepad');
  });
});
