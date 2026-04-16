import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Home } from './screens/Home';
import { Game } from './screens/Game';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { gameStore } from './store/game';

type Screen = 'home' | 'game' | 'stats' | 'settings';

const VALID_SCREENS: readonly Screen[] = ['home', 'game', 'stats', 'settings'];

function parseHash(hash: string): Screen {
  const stripped = hash.replace(/^#\/?/, '').toLowerCase();
  return (VALID_SCREENS as readonly string[]).includes(stripped)
    ? (stripped as Screen)
    : 'home';
}

function subscribeHash(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function getHashSnapshot(): string {
  return window.location.hash;
}

function getServerHashSnapshot(): string {
  return '';
}

export default function App() {
  const hash = useSyncExternalStore(subscribeHash, getHashSnapshot, getServerHashSnapshot);
  const screen = parseHash(hash);

  const navigate = useCallback((target: Screen) => {
    const next = `#/${target}`;
    if (window.location.hash === next) return;
    window.location.hash = next;
  }, []);

  // Subscribe to the singleton game store so we can auto-navigate to the
  // Game screen when the user starts or resumes a game from Home.
  const state = useSyncExternalStore(
    gameStore.subscribe,
    gameStore.getState,
    gameStore.getState,
  );
  const hasGivens = state.board.cells.some((row) => row.some((c) => c.given));
  const prevHadGivens = useRef(hasGivens);

  useEffect(() => {
    if (!prevHadGivens.current && hasGivens && screen === 'home') {
      navigate('game');
    }
    prevHadGivens.current = hasGivens;
  }, [hasGivens, screen, navigate]);

  let content;
  switch (screen) {
    case 'game':
      content = <Game onBack={() => navigate('home')} />;
      break;
    case 'stats':
      content = <Stats />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    case 'home':
    default:
      content = <Home />;
      break;
  }

  const showTabBar = screen !== 'game';

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      {content}
      {showTabBar && (
        <nav
          data-testid="tab-bar"
          className="fixed bottom-0 inset-x-0 bg-slate-100 border-t flex sm:hidden"
          aria-label="Primary"
        >
          <button
            type="button"
            data-testid="tab-home"
            onClick={() => navigate('home')}
            className="flex-1 py-3"
            aria-current={screen === 'home' ? 'page' : undefined}
          >
            Home
          </button>
          <button
            type="button"
            data-testid="tab-stats"
            onClick={() => navigate('stats')}
            className="flex-1 py-3"
            aria-current={screen === 'stats' ? 'page' : undefined}
          >
            Stats
          </button>
          <button
            type="button"
            data-testid="tab-settings"
            onClick={() => navigate('settings')}
            className="flex-1 py-3"
            aria-current={screen === 'settings' ? 'page' : undefined}
          >
            Settings
          </button>
        </nav>
      )}
    </div>
  );
}
