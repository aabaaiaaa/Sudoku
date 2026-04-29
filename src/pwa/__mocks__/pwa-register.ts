// Stub used by Vitest (see vitest.config.ts alias) because
// `virtual:pwa-register` is only provided by the vite-plugin-pwa runtime.

export interface RegisterSWOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (
    swUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void;
  onRegisterError?: (error: unknown) => void;
}

// Tracks the most recent `registerSW` invocation so tests can drive the
// optional callbacks (e.g. `onRegisteredSW`) without needing access to the
// internal hook state.
export const __registerSWState: {
  lastOptions: RegisterSWOptions | undefined;
  updateSW: (reload?: boolean) => Promise<void>;
} = {
  lastOptions: undefined,
  updateSW: async () => {},
};

export function registerSW(
  options?: RegisterSWOptions,
): (reload?: boolean) => Promise<void> {
  __registerSWState.lastOptions = options;
  return __registerSWState.updateSW;
}

/**
 * Test helper — invokes the captured `onRegisteredSW` callback with a stub
 * registration object so tests can exercise registration-dependent logic.
 */
export function __triggerRegisteredSW(
  registration: ServiceWorkerRegistration | undefined,
  swUrl = 'sw.js',
): void {
  __registerSWState.lastOptions?.onRegisteredSW?.(swUrl, registration);
}

/**
 * Test helper — resets captured state between tests.
 */
export function __resetRegisterSWMock(): void {
  __registerSWState.lastOptions = undefined;
  __registerSWState.updateSW = async () => {};
}
