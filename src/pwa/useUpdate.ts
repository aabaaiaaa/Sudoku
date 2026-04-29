import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface PwaUpdateHook {
  needsRefresh: boolean;
  reload: () => void;
  checkForUpdates: () => Promise<'updated' | 'idle' | 'error'>;
}

/**
 * Registers the service worker (once per app mount) and tracks whether a new
 * version is waiting to activate. `reload()` calls into the registered SW to
 * apply the update and reload the page.
 */
export function usePwaUpdate(): PwaUpdateHook {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<
    ((reload?: boolean) => Promise<void>) | null
  >(null);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  );
  const needRefreshFiredRef = useRef(false);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let registration: ServiceWorkerRegistration | undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void registration?.update();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const update = registerSW({
      onNeedRefresh() {
        needRefreshFiredRef.current = true;
        setNeedsRefresh(true);
      },
      onRegisteredSW(_swUrl: string, r: ServiceWorkerRegistration | undefined) {
        registration = r;
        registrationRef.current = r;
        intervalId = setInterval(() => {
          void r?.update();
        }, 60_000);
      },
    });
    setUpdateSW(() => update);
    return () => {
      if (intervalId !== undefined) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const reload = () => {
    if (updateSW) {
      void updateSW(true);
    } else {
      window.location.reload();
    }
  };

  const checkForUpdates = useCallback(async (): Promise<
    'updated' | 'idle' | 'error'
  > => {
    const r = registrationRef.current;
    if (!r) return 'error';
    needRefreshFiredRef.current = false;
    try {
      await r.update();
    } catch {
      return 'error';
    }
    return needRefreshFiredRef.current ? 'updated' : 'idle';
  }, []);

  return { needsRefresh, reload, checkForUpdates };
}
