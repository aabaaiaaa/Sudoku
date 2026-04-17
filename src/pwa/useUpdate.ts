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
    const update = registerSW({
      onNeedRefresh() {
        setNeedsRefresh(true);
      },
    });
    setUpdateSW(() => update);
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
