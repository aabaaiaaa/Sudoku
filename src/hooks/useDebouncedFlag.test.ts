import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedFlag } from './useDebouncedFlag';

describe('useDebouncedFlag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false initially even when source is true (debounce window not elapsed)', () => {
    const { result } = renderHook(() => useDebouncedFlag(true, 200));
    // The hook starts with debounced=false and only schedules a setTimeout in
    // a useEffect; before any timers run the value must remain false.
    expect(result.current).toBe(false);
  });

  it('returns false initially when source is false', () => {
    const { result } = renderHook(() => useDebouncedFlag(false, 200));
    expect(result.current).toBe(false);
  });

  it('does NOT return true before ms ms have elapsed since the source flipped true', () => {
    const { result } = renderHook(() => useDebouncedFlag(true, 200));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(false);
  });

  it('returns true after exactly ms ms have elapsed with source still true', () => {
    const { result } = renderHook(() => useDebouncedFlag(true, 200));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);
  });

  it('stays true while source remains true after the debounce window elapses', () => {
    const { result } = renderHook(() => useDebouncedFlag(true, 200));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);

    // Further time passing while source is still true should keep us true.
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(true);
  });

  it('returns false instantly (not debounced) when source flips false after being true', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: boolean }) => useDebouncedFlag(value, 200),
      { initialProps: { value: true } },
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);

    // Flip the source false. The transition must be instant — no further
    // timers should be required for the hook to return false.
    rerender({ value: false });
    expect(result.current).toBe(false);
  });

  it('never returns true when source flips true → false within the debounce window', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: boolean }) => useDebouncedFlag(value, 200),
      { initialProps: { value: true } },
    );
    expect(result.current).toBe(false);

    // Halfway through the debounce window the source flips back to false.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);

    rerender({ value: false });
    expect(result.current).toBe(false);

    // Even after the originally-scheduled timeout would have fired, the hook
    // must remain false — the pending timer was cancelled when the effect
    // re-ran with value=false.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
  });

  it('restarts the debounce window when source toggles false → true again', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: boolean }) => useDebouncedFlag(value, 200),
      { initialProps: { value: true } },
    );

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(false);

    // Flip false then back to true — the next debounce should start fresh.
    rerender({ value: false });
    rerender({ value: true });

    // Advancing 150ms (which would have completed the original window) must
    // NOT yet trigger true — the second window only just started.
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(false);

    // Cross the 200ms boundary of the new window.
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(true);
  });

  it('honours a different ms value', () => {
    const { result } = renderHook(() => useDebouncedFlag(true, 1_000));

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});
