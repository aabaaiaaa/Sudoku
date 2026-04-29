import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface PwaUpdateHook {
  needsRefresh: boolean;
  reload: () => void;
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

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const update = registerSW({
      onNeedRefresh() {
        setNeedsRefresh(true);
      },
      onRegisteredSW(_swUrl: string, r: ServiceWorkerRegistration | undefined) {
        intervalId = setInterval(() => {
          void r?.update();
        }, 60_000);
      },
    });
    setUpdateSW(() => update);
    return () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, []);

  const reload = () => {
    if (updateSW) {
      void updateSW(true);
    } else {
      window.location.reload();
    }
  };

  return { needsRefresh, reload };
}
