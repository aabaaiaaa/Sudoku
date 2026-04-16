import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { gameStore } from './store/game';
import { ThemeProvider } from './themes/ThemeProvider';
import './index.css';
import './themes/light.css';
import './themes/dark.css';
import './themes/notepad.css';
import './themes/space.css';

// Test hook: expose the singleton game store for Playwright E2E tests to seed
// near-complete board states without relying on the puzzle generator.
(window as unknown as { __sudokuGameStore?: typeof gameStore }).__sudokuGameStore =
  gameStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
