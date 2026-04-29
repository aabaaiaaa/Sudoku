import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
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

  describe('Storage section', () => {
    it('renders the Storage section for any v1 or v2 prefix (gating on hasOldSaves)', () => {
      window.localStorage.setItem('sudoku.stats.v1', '{}');

      const store = createSettingsStore();
      const { queryByTestId } = render(<Settings store={store} />);

      expect(queryByTestId('settings-storage')).toBeTruthy();
      expect(queryByTestId('settings-remove-old-saves')).toBeTruthy();
    });

    it('cancelling the confirm dialog leaves the Storage section and the legacy keys intact', () => {
      window.localStorage.setItem('sudoku.save.v2', '{}');
      window.localStorage.setItem('sudoku.settings.v2', '{}');

      const store = createSettingsStore();
      const { getByTestId, queryByTestId } = render(<Settings store={store} />);

      fireEvent.click(getByTestId('settings-remove-old-saves'));
      expect(queryByTestId('confirm-dialog')).toBeTruthy();

      fireEvent.click(getByTestId('confirm-dialog-cancel'));

      expect(queryByTestId('confirm-dialog')).toBeNull();
      expect(queryByTestId('settings-storage')).toBeTruthy();
      expect(window.localStorage.getItem('sudoku.save.v2')).toBe('{}');
      expect(window.localStorage.getItem('sudoku.settings.v2')).toBe('{}');
    });

    it('removes every matching v1/v2 key when the user confirms', () => {
      window.localStorage.setItem('sudoku.save.v1', '{}');
      window.localStorage.setItem('sudoku.save.v2', '{}');
      window.localStorage.setItem('sudoku.stats.v1', '{}');
      window.localStorage.setItem('sudoku.stats.v2', '{}');
      window.localStorage.setItem('sudoku.settings.v1', '{}');
      window.localStorage.setItem('sudoku.settings.v2', '{}');
      // v3 keys must be untouched.
      window.localStorage.setItem(
        'sudoku.save.v3',
        JSON.stringify({ version: 3, appVersion: '0.3.0', saves: {} }),
      );

      const store = createSettingsStore();
      const { getByTestId, queryByTestId } = render(<Settings store={store} />);

      fireEvent.click(getByTestId('settings-remove-old-saves'));
      fireEvent.click(getByTestId('confirm-dialog-confirm'));

      expect(window.localStorage.getItem('sudoku.save.v1')).toBeNull();
      expect(window.localStorage.getItem('sudoku.save.v2')).toBeNull();
      expect(window.localStorage.getItem('sudoku.stats.v1')).toBeNull();
      expect(window.localStorage.getItem('sudoku.stats.v2')).toBeNull();
      expect(window.localStorage.getItem('sudoku.settings.v1')).toBeNull();
      expect(window.localStorage.getItem('sudoku.settings.v2')).toBeNull();
      // The v3 key survives — only legacy versions are wiped.
      expect(window.localStorage.getItem('sudoku.save.v3')).not.toBeNull();
      // After removal the section disappears even though hasOldSaves was
      // truthy on initial render.
      expect(queryByTestId('settings-storage')).toBeNull();
    });
  });

  describe('Updates section', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders the Check for updates button by default', () => {
      const store = createSettingsStore();
      const { getByTestId } = render(<Settings store={store} />);

      const button = getByTestId('settings-check-updates');
      expect(button.textContent).toBe('Check for updates');
    });

    it('shows "Checking…" while the check is in flight', async () => {
      const store = createSettingsStore();
      let resolve!: (value: 'updated' | 'idle' | 'error') => void;
      const checkForUpdates = vi.fn(
        () =>
          new Promise<'updated' | 'idle' | 'error'>((r) => {
            resolve = r;
          }),
      );

      const { getByTestId } = render(
        <Settings store={store} checkForUpdates={checkForUpdates} />,
      );

      const button = getByTestId('settings-check-updates');
      fireEvent.click(button);

      expect(button.textContent).toBe('Checking…');
      expect((button as HTMLButtonElement).disabled).toBe(true);

      // Resolve so we don't leak the pending promise into the next test.
      await act(async () => {
        resolve('idle');
      });
    });

    it('shows "Up to date" then reverts after 2s when result is "idle"', async () => {
      vi.useFakeTimers();
      const store = createSettingsStore();
      const checkForUpdates = vi.fn().mockResolvedValue('idle' as const);

      const { getByTestId } = render(
        <Settings store={store} checkForUpdates={checkForUpdates} />,
      );

      const button = getByTestId('settings-check-updates');

      await act(async () => {
        fireEvent.click(button);
        // Let the resolved promise's then-callback run.
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(button.textContent).toBe('Up to date');

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(button.textContent).toBe('Check for updates');
    });

    it('returns to default label without "Up to date" when result is "updated"', async () => {
      const store = createSettingsStore();
      const checkForUpdates = vi.fn().mockResolvedValue('updated' as const);

      const { getByTestId } = render(
        <Settings store={store} checkForUpdates={checkForUpdates} />,
      );

      const button = getByTestId('settings-check-updates');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button.textContent).toBe('Check for updates');
      });
      expect(checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('shows "Couldn\'t check — try again" then reverts after 2s when result is "error"', async () => {
      vi.useFakeTimers();
      const store = createSettingsStore();
      const checkForUpdates = vi.fn().mockResolvedValue('error' as const);

      const { getByTestId } = render(
        <Settings store={store} checkForUpdates={checkForUpdates} />,
      );

      const button = getByTestId('settings-check-updates');

      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(button.textContent).toBe("Couldn't check — try again");

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(button.textContent).toBe('Check for updates');
    });

    it('walks the full idle → checking → up-to-date → idle cycle on a successful check', async () => {
      vi.useFakeTimers();
      const store = createSettingsStore();
      let resolve!: (value: 'updated' | 'idle' | 'error') => void;
      const checkForUpdates = vi.fn(
        () =>
          new Promise<'updated' | 'idle' | 'error'>((r) => {
            resolve = r;
          }),
      );

      const { getByTestId } = render(
        <Settings store={store} checkForUpdates={checkForUpdates} />,
      );

      const button = getByTestId('settings-check-updates') as HTMLButtonElement;

      // 1. idle
      expect(button.textContent).toBe('Check for updates');
      expect(button.disabled).toBe(false);

      // 2. checking — click drives the in-flight state and disables the button
      fireEvent.click(button);
      expect(button.textContent).toBe('Checking…');
      expect(button.disabled).toBe(true);

      // 3. up-to-date — resolving the promise as `idle` flips into the
      // success label
      await act(async () => {
        resolve('idle');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(button.textContent).toBe('Up to date');
      expect(button.disabled).toBe(false);

      // 4. back to idle after the 2s revert timer fires
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(button.textContent).toBe('Check for updates');
      expect(checkForUpdates).toHaveBeenCalledTimes(1);
    });
  });
});
