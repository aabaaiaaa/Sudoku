// Stub used by Vitest (see vitest.config.ts alias) because
// `virtual:pwa-register` is only provided by the vite-plugin-pwa runtime.
export function registerSW(_options?: {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}): (reload?: boolean) => Promise<void> {
  return async () => {};
}
