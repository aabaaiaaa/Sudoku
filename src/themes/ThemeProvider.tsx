import { useEffect } from 'react';
import { useStore } from 'zustand';
import { settingsStore } from '../store/settings';

interface ThemeProviderProps {
  store?: typeof settingsStore;
  children?: React.ReactNode;
}

export function ThemeProvider({ store = settingsStore, children }: ThemeProviderProps) {
  const theme = useStore(store, (s) => s.theme);
  const followSystem = useStore(store, (s) => s.followSystem);
  const setFollowSystem = useStore(store, (s) => s.setFollowSystem);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!followSystem) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setFollowSystem(true);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [followSystem, setFollowSystem]);

  return <>{children ?? null}</>;
}

export default ThemeProvider;
