import { useStore } from 'zustand';
import { settingsStore, type Theme } from '../store/settings';
import { themes } from '../themes';

interface SettingsProps {
  store?: typeof settingsStore;
}

const themeOrder: Theme[] = ['light', 'dark', 'notepad', 'space'];

export function Settings({ store = settingsStore }: SettingsProps) {
  const theme = useStore(store, (s) => s.theme);
  const followSystem = useStore(store, (s) => s.followSystem);
  const setTheme = useStore(store, (s) => s.setTheme);
  const setFollowSystem = useStore(store, (s) => s.setFollowSystem);

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section data-testid="settings-theme-picker" className="space-y-2">
        <h2 className="text-lg font-medium">Theme</h2>
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
          {themeOrder.map((id) => (
            <label key={id} className="flex items-center gap-1">
              <input
                type="radio"
                name="settings-theme"
                data-testid={`settings-theme-${id}`}
                value={id}
                checked={theme === id}
                onChange={() => setTheme(id)}
              />
              <span>{themes[id].label}</span>
            </label>
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
    </div>
  );
}

export default Settings;
