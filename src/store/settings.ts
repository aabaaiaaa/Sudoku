import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'notepad' | 'space';

export const SETTINGS_STORAGE_KEY = 'sudoku.settings.v3';
export const SETTINGS_SCHEMA_VERSION = 3;

export interface SettingsState {
  theme: Theme;
  followSystem: boolean;
  appVersion: string;
}

export interface SettingsActions {
  setTheme: (theme: Theme) => void;
  setFollowSystem: (follow: boolean) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function createSettingsStore() {
  return createStore<SettingsStore>()(
    persist(
      (set) => ({
        theme: 'light',
        followSystem: false,
        appVersion: __APP_VERSION__,

        setTheme: (theme) => {
          set({ theme, followSystem: false, appVersion: __APP_VERSION__ });
        },

        setFollowSystem: (follow) => {
          if (!follow) {
            set({ followSystem: false, appVersion: __APP_VERSION__ });
            return;
          }
          set({
            followSystem: true,
            theme: systemPrefersDark() ? 'dark' : 'light',
            appVersion: __APP_VERSION__,
          });
        },
      }),
      {
        name: SETTINGS_STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        version: SETTINGS_SCHEMA_VERSION,
      },
    ),
  );
}

export const settingsStore = createSettingsStore();
