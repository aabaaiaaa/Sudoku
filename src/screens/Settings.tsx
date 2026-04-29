import { useState } from 'react';
import { useStore } from 'zustand';
import { settingsStore, type Theme } from '../store/settings';
import { themes } from '../themes';
import { hasOldSaves, removeOldSaves } from '../store/migration';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface SettingsProps {
  store?: typeof settingsStore;
}

const themeOrder: Theme[] = ['light', 'dark', 'notepad', 'space'];

/**
 * A miniature 3×3 board scoped under the given `data-theme`, so the theme's
 * CSS variables apply via inheritance and the preview reflects the real look
 * without needing a full game board.
 */
function ThemePreview({ theme }: { theme: Theme }) {
  // A deliberately mixed cell set: givens, player-filled, selected, highlight,
  // conflict, completed — so the preview shows every state the theme affects.
  const cells: Array<{
    digit: number;
    state: 'given' | 'player' | 'selected' | 'highlight' | 'completed' | 'conflict';
  }> = [
    { digit: 5, state: 'given' },
    { digit: 3, state: 'player' },
    { digit: 7, state: 'selected' },
    { digit: 2, state: 'highlight' },
    { digit: 8, state: 'completed' },
    { digit: 1, state: 'given' },
    { digit: 6, state: 'conflict' },
    { digit: 4, state: 'player' },
    { digit: 9, state: 'given' },
  ];

  return (
    <div
      data-theme={theme}
      className="rounded-md p-3"
      style={{
        background: 'var(--bg)',
        color: 'var(--fg)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="grid grid-cols-3 gap-0 max-w-[10rem] mx-auto"
        style={{ border: '2px solid var(--fg)' }}
      >
        {cells.map((cell, i) => {
          const bg =
            cell.state === 'conflict'
              ? 'var(--cell-conflict)'
              : cell.state === 'selected'
                ? 'var(--cell-selected)'
                : cell.state === 'highlight'
                  ? 'var(--cell-highlight)'
                  : cell.state === 'completed'
                    ? 'var(--cell-completed)'
                    : 'var(--cell-bg)';
          const fg =
            cell.state === 'given' ? 'var(--cell-given)' : 'var(--accent)';
          const fontWeight = cell.state === 'given' ? 700 : 400;
          return (
            <div
              key={i}
              className="aspect-square flex items-center justify-center text-sm"
              style={{
                background: bg,
                color: fg,
                fontWeight,
                border: '1px solid var(--border)',
              }}
            >
              {cell.digit}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Settings({ store = settingsStore }: SettingsProps) {
  const theme = useStore(store, (s) => s.theme);
  const followSystem = useStore(store, (s) => s.followSystem);
  const setTheme = useStore(store, (s) => s.setTheme);
  const setFollowSystem = useStore(store, (s) => s.setFollowSystem);

  const [hasOld, setHasOld] = useState(() => hasOldSaves());
  const [confirmRemove, setConfirmRemove] = useState(false);

  const version =
    typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

  return (
    <div
      className="p-4 space-y-6 overflow-y-auto"
      style={{ maxHeight: '100vh', paddingBottom: '5rem' }}
    >
      <h1 className="text-xl font-semibold">Settings</h1>

      <section data-testid="settings-theme-picker" className="space-y-3">
        <h2 className="text-lg font-medium">Theme</h2>
        <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-3">
          {themeOrder.map((id) => (
            <div key={id} className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="settings-theme"
                  data-testid={`settings-theme-${id}`}
                  value={id}
                  checked={theme === id}
                  onChange={() => setTheme(id)}
                />
                <span className="font-medium">{themes[id].label}</span>
              </label>
              <ThemePreview theme={id} />
            </div>
          ))}
        </div>
      </section>

      <section data-testid="settings-follow-system" className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="settings-follow-system-toggle"
            checked={followSystem}
            onChange={(e) => setFollowSystem(e.target.checked)}
          />
          <span>Follow system theme</span>
        </label>
      </section>

      {hasOld && (
        <section data-testid="settings-storage" className="space-y-2">
          <h2 className="text-lg font-medium">Storage</h2>
          <button
            type="button"
            data-testid="settings-remove-old-saves"
            onClick={() => setConfirmRemove(true)}
            className="btn"
          >
            Remove old saves
          </button>
        </section>
      )}

      <section
        data-testid="settings-about"
        className="pt-4 text-sm opacity-70 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          Version <span data-testid="settings-version">{version}</span>
        </div>
      </section>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove all old saves now?"
        body="This will permanently delete saves from earlier versions of the app."
        confirmLabel="Remove now"
        cancelLabel="Cancel"
        onConfirm={() => {
          removeOldSaves();
          setHasOld(false);
          setConfirmRemove(false);
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

export default Settings;
