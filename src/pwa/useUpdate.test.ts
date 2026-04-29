import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  __registerSWState,
  __resetRegisterSWMock,
  __triggerRegisteredSW,
} from './__mocks__/pwa-register';
import { usePwaUpdate } from './useUpdate';

describe('usePwaUpdate', () => {
  beforeEach(() => {
    __resetRegisterSWMock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetRegisterSWMock();
  });

  it('calls update() once a minute via the poll', () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const registration = { update: updateMock } as unknown as ServiceWorkerRegistration;

    renderHook(() => usePwaUpdate());
    __triggerRegisteredSW(registration);

    vi.advanceTimersByTime(60_000);
    expect(updateMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it('clears the interval on unmount', () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const registration = { update: updateMock } as unknown as ServiceWorkerRegistration;

    const { unmount } = renderHook(() => usePwaUpdate());
    __triggerRegisteredSW(registration);

    unmount();

    vi.advanceTimersByTime(120_000);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('calls update() when document becomes visible', () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const registration = { update: updateMock } as unknown as ServiceWorkerRegistration;

    renderHook(() => usePwaUpdate());
    __triggerRegisteredSW(registration);

    // Reset between the registration moment and the visibility event so we
    // count only the visibility-driven call.
    updateMock.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('does not call update() on visibilitychange when document is hidden', () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const registration = { update: updateMock } as unknown as ServiceWorkerRegistration;

    renderHook(() => usePwaUpdate());
    __triggerRegisteredSW(registration);

    updateMock.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(updateMock).not.toHaveBeenCalled();

    // Restore default for subsequent tests.
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('removes the visibilitychange listener on unmount', () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const registration = { update: updateMock } as unknown as ServiceWorkerRegistration;

    const { unmount } = renderHook(() => usePwaUpdate());
    __triggerRegisteredSW(registration);

    unmount();

    updateMock.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(updateMock).not.toHaveBeenCalled();
  });

  describe('checkForUpdates', () => {
    // Switch off fake timers for this block — async awaits play more
    // predictably with real timers, and these tests don't depend on the
    // 60s poll cadence.
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('returns "updated" when onNeedRefresh fires during r.update()', async () => {
      const updateMock = vi.fn().mockImplementation(async () => {
        __registerSWState.lastOptions?.onNeedRefresh?.();
      });
      const registration = {
        update: updateMock,
      } as unknown as ServiceWorkerRegistration;

      const { result } = renderHook(() => usePwaUpdate());
      __triggerRegisteredSW(registration);

      const status = await result.current.checkForUpdates();
      expect(status).toBe('updated');
      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('returns "idle" when onNeedRefresh does not fire', async () => {
      const updateMock = vi.fn().mockResolvedValue(undefined);
      const registration = {
        update: updateMock,
      } as unknown as ServiceWorkerRegistration;

      const { result } = renderHook(() => usePwaUpdate());
      __triggerRegisteredSW(registration);

      const status = await result.current.checkForUpdates();
      expect(status).toBe('idle');
      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('returns "error" when r.update() rejects', async () => {
      const updateMock = vi.fn().mockRejectedValue(new Error('offline'));
      const registration = {
        update: updateMock,
      } as unknown as ServiceWorkerRegistration;

      const { result } = renderHook(() => usePwaUpdate());
      __triggerRegisteredSW(registration);

      const status = await result.current.checkForUpdates();
      expect(status).toBe('error');
      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('returns "error" when no registration is yet available', async () => {
      const { result } = renderHook(() => usePwaUpdate());

      const status = await result.current.checkForUpdates();
      expect(status).toBe('error');
    });

    it('returns "idle" on a follow-up call when the previous call was "updated"', async () => {
      let shouldFire = true;
      const updateMock = vi.fn().mockImplementation(async () => {
        if (shouldFire) {
          __registerSWState.lastOptions?.onNeedRefresh?.();
        }
      });
      const registration = {
        update: updateMock,
      } as unknown as ServiceWorkerRegistration;

      const { result } = renderHook(() => usePwaUpdate());
      __triggerRegisteredSW(registration);

      const first = await result.current.checkForUpdates();
      expect(first).toBe('updated');

      shouldFire = false;
      const second = await result.current.checkForUpdates();
      expect(second).toBe('idle');
    });
  });
});
