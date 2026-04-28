import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  createSettingsStore,
} from './settings';

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

  it('uses the v2 storage key and bumped schema version', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('sudoku.settings.v2');
    expect(SETTINGS_SCHEMA_VERSION).toBe(2);
  });

  it('silently ignores legacy v1 entries on load', () => {
    window.localStorage.setItem(
      'sudoku.settings.v1',
      JSON.stringify({
        state: { theme: 'space', followSystem: true },
        version: 0,
      }),
    );

    const store = createSettingsStore();

    // The v1 payload sits under the old key; the v2 store starts fresh.
    expect(store.getState().theme).toBe('light');
    expect(store.getState().followSystem).toBe(false);
  });

  it('stamps writes with the current appVersion under the v2 key', () => {
    const store = createSettingsStore();
    store.getState().setTheme('notepad');

    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(SETTINGS_SCHEMA_VERSION);
    expect(typeof parsed.state.appVersion).toBe('string');
    expect(parsed.state.appVersion.length).toBeGreaterThan(0);
    expect(parsed.state.appVersion).toBe(__APP_VERSION__);

    expect(store.getState().appVersion).toBe(__APP_VERSION__);
  });

  it('refreshes the appVersion stamp on setFollowSystem', () => {
    const store = createSettingsStore();
    store.getState().setFollowSystem(true);

    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.appVersion).toBe(__APP_VERSION__);
  });

  it('preserves persisted theme across store re-creation', () => {
    const first = createSettingsStore();
    first.getState().setTheme('space');

    const second = createSettingsStore();
    expect(second.getState().theme).toBe('space');
    expect(second.getState().appVersion).toBe(__APP_VERSION__);
  });
});
