import { useCallback, useSyncExternalStore } from 'react';
import { Home } from './screens/Home';
import { Game } from './screens/Game';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { Techniques } from './screens/Techniques';
import { TechniqueDetail } from './screens/TechniqueDetail';
import { TECHNIQUE_ORDER } from './engine/solver/techniques/catalog';
import type { TechniqueId } from './engine/solver/techniques';
import { usePwaUpdate } from './pwa/useUpdate';

type Screen = 'home' | 'game' | 'stats' | 'settings' | 'learn' | 'learn-detail';

type Route =
  | { screen: 'home' | 'game' | 'stats' | 'settings' | 'learn' }
  | { screen: 'learn-detail'; techniqueId: TechniqueId };

const TOP_LEVEL_SCREENS: readonly Exclude<Screen, 'learn-detail'>[] = [
  'home',
  'game',
  'stats',
  'settings',
  'learn',
];

function isTechniqueId(value: string): value is TechniqueId {
  return (TECHNIQUE_ORDER as readonly string[]).includes(value);
}

function parseHash(hash: string): Route {
  const stripped = hash.replace(/^#\/?/, '');
  const [head, ...rest] = stripped.split('/');
  const headLower = head.toLowerCase();

  if (headLower === 'learn' && rest.length > 0 && rest[0] !== '') {
    const id = rest.join('/');
    if (isTechniqueId(id)) {
      return { screen: 'learn-detail', techniqueId: id };
    }
    return { screen: 'learn' };
  }

  if ((TOP_LEVEL_SCREENS as readonly string[]).includes(headLower)) {
    return { screen: headLower as Exclude<Screen, 'learn-detail'> };
  }
  return { screen: 'home' };
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
  const route = parseHash(hash);
  const screen = route.screen;

  const navigate = useCallback((target: Screen) => {
    const next = `#/${target}`;
    if (window.location.hash === next) return;
    window.location.hash = next;
  }, []);

  const navigateToTechnique = useCallback((id: TechniqueId) => {
    const next = `#/learn/${id}`;
    if (window.location.hash === next) return;
    window.location.hash = next;
  }, []);

  let content;
  switch (route.screen) {
    case 'game':
      content = <Game onBack={() => navigate('home')} />;
      break;
    case 'stats':
      content = <Stats />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    case 'learn':
      content = <Techniques onSelect={navigateToTechnique} />;
      break;
    case 'learn-detail':
      content = (
        <TechniqueDetail
          id={route.techniqueId}
          onBack={() => navigate('learn')}
        />
      );
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
            data-testid="tab-learn"
            onClick={() => navigate('learn')}
            className="tab-button flex-1 py-3"
            aria-current={
              screen === 'learn' || screen === 'learn-detail' ? 'page' : undefined
            }
          >
            Learn
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
