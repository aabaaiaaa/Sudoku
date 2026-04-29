import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
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
});
