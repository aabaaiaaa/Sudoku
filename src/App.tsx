import { useCallback, useSyncExternalStore } from 'react';
import { Home } from './screens/Home';
import { Game } from './screens/Game';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { usePwaUpdate } from './pwa/useUpdate';

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
      content = <Home onEnterGame={() => navigate('game')} />;
      break;
  }

  const showTabBar = screen !== 'game';
  const { needsRefresh, reload } = usePwaUpdate();

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      {needsRefresh && (
        <div
          data-testid="update-banner"
          className="fixed top-0 inset-x-0 flex items-center justify-between gap-3 px-4 py-2 text-sm z-50"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
          }}
          role="status"
        >
          <span>✨ A new version is available.</span>
          <button
            type="button"
            data-testid="update-reload"
            onClick={reload}
            className="px-3 py-1 rounded-md font-medium"
            style={{ background: 'var(--bg)', color: 'var(--accent)' }}
          >
            Reload
          </button>
        </div>
      )}
      {content}
      {showTabBar && (
        <nav
          data-testid="tab-bar"
          className="fixed bottom-0 inset-x-0 flex sm:hidden"
          style={{
            background: 'var(--cell-bg)',
            borderTop: '1px solid var(--border)',
            color: 'var(--fg)',
          }}
          aria-label="Primary"
        >
          <button
            type="button"
            data-testid="tab-home"
            onClick={() => navigate('home')}
            className="tab-button flex-1 py-3"
            aria-current={screen === 'home' ? 'page' : undefined}
          >
            Home
          </button>
          <button
            type="button"
            data-testid="tab-stats"
            onClick={() => navigate('stats')}
            className="tab-button flex-1 py-3"
            aria-current={screen === 'stats' ? 'page' : undefined}
          >
            Stats
          </button>
          <button
            type="button"
            data-testid="tab-settings"
            onClick={() => navigate('settings')}
            className="tab-button flex-1 py-3"
            aria-current={screen === 'settings' ? 'page' : undefined}
          >
            Settings
          </button>
        </nav>
      )}
    </div>
  );
}
