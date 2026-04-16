import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'notepad' | 'space';

export interface SettingsState {
  theme: Theme;
  followSystem: boolean;
}

export interface SettingsActions {
  setTheme: (theme: Theme) => void;
  setFollowSystem: (follow: boolean) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const STORAGE_KEY = 'sudoku.settings.v1';

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

        setTheme: (theme) => {
          set({ theme, followSystem: false });
        },

        setFollowSystem: (follow) => {
          if (!follow) {
            set({ followSystem: false });
            return;
          }
          set({
            followSystem: true,
            theme: systemPrefersDark() ? 'dark' : 'light',
          });
        },
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
      },
    ),
  );
}

export const settingsStore = createSettingsStore();
