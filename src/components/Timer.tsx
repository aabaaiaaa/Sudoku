import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';

interface TimerProps {
  store?: typeof gameStore;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function Timer({ store = gameStore }: TimerProps) {
  const timer = useStore(store, (s) => s.timer);
  const pause = useStore(store, (s) => s.pause);
  const resume = useStore(store, (s) => s.resume);

  const manualPausedRef = useRef<boolean>(timer.paused);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (timer.paused) return;
    const id = window.setInterval(() => {
      setTick((t) => (t + 1) % 1_000_000);
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [timer.paused]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        pause();
      } else if (document.visibilityState === 'visible') {
        if (!manualPausedRef.current) {
          resume();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pause, resume]);

  const elapsed =
    timer.accumulatedMs +
    (timer.paused || timer.startTs == null ? 0 : Date.now() - timer.startTs);

  const handleToggle = () => {
    if (timer.paused) {
      manualPausedRef.current = false;
      resume();
    } else {
      manualPausedRef.current = true;
      pause();
    }
  };

  return (
    <div className="timer">
      <span data-testid="timer-display">{formatElapsed(elapsed)}</span>
      <button type="button" data-testid="timer-toggle" onClick={handleToggle}>
        {timer.paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  );
}

export default Timer;
