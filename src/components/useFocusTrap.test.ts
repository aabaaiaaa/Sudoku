/**
 * Unit tests for {@link useFocusTrap} (requirements §10).
 *
 * Written in `.ts` (no JSX) so the verification spec can target the file
 * directly — the hook is exercised via `renderHook` and the DOM is set up
 * imperatively.
 */
import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useFocusTrap } from './useFocusTrap';

/**
 * Sets up a container with three focusable buttons and returns a hook driver
 * that mounts {@link useFocusTrap} pointing at it.
 */
function makeHarness(): {
  container: HTMLDivElement;
  buttons: HTMLButtonElement[];
  outside: HTMLButtonElement;
  cleanup: () => void;
} {
  const outside = document.createElement('button');
  outside.textContent = 'outside';
  outside.setAttribute('data-testid', 'outside');
  document.body.appendChild(outside);

  const container = document.createElement('div');
  container.setAttribute('data-testid', 'trap-container');
  document.body.appendChild(container);

  const buttons: HTMLButtonElement[] = [];
  for (let i = 0; i < 3; i++) {
    const btn = document.createElement('button');
    btn.textContent = `btn-${i}`;
    btn.setAttribute('data-testid', `btn-${i}`);
    container.appendChild(btn);
    buttons.push(btn);
  }

  const cleanup = () => {
    container.remove();
    outside.remove();
  };

  return { container, buttons, outside, cleanup };
}

afterEach(() => {
  // Tests append nodes to document.body — make sure nothing leaks between
  // cases that could shift focus calculations.
  document.body.innerHTML = '';
});

describe('useFocusTrap', () => {
  it('focuses the first focusable element inside the container when activated', () => {
    const harness = makeHarness();
    harness.outside.focus();
    expect(document.activeElement).toBe(harness.outside);

    renderHook(
      ({ active }: { active: boolean }) => {
        const ref = useRef<HTMLElement | null>(harness.container);
        useFocusTrap(active, ref);
        return ref;
      },
      { initialProps: { active: true } },
    );

    expect(document.activeElement).toBe(harness.buttons[0]);

    harness.cleanup();
  });

  it('cycles forward with Tab from the last stop back to the first', () => {
    const harness = makeHarness();

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(harness.container);
      useFocusTrap(true, ref);
    });

    // Move focus to the last button manually, then Tab.
    harness.buttons[2].focus();
    expect(document.activeElement).toBe(harness.buttons[2]);

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(document.activeElement).toBe(harness.buttons[0]);

    harness.cleanup();
  });

  it('cycles backward with Shift+Tab from the first stop to the last', () => {
    const harness = makeHarness();

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(harness.container);
      useFocusTrap(true, ref);
    });

    harness.buttons[0].focus();
    expect(document.activeElement).toBe(harness.buttons[0]);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(harness.buttons[2]);

    harness.cleanup();
  });

  it('invokes onEscape when Escape is pressed while active', () => {
    const harness = makeHarness();
    const onEscape = vi.fn();

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(harness.container);
      useFocusTrap(true, ref, onEscape);
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);

    harness.cleanup();
  });

  it('does not call onEscape when inactive', () => {
    const harness = makeHarness();
    const onEscape = vi.fn();

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(harness.container);
      useFocusTrap(false, ref, onEscape);
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onEscape).not.toHaveBeenCalled();

    harness.cleanup();
  });

  it('restores focus to the previously-focused element on deactivation', () => {
    const harness = makeHarness();
    harness.outside.focus();
    expect(document.activeElement).toBe(harness.outside);

    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => {
        const ref = useRef<HTMLElement | null>(harness.container);
        useFocusTrap(active, ref);
      },
      { initialProps: { active: true } },
    );

    // Trap activated → focus moved into the container.
    expect(document.activeElement).toBe(harness.buttons[0]);

    // Deactivate.
    rerender({ active: false });

    expect(document.activeElement).toBe(harness.outside);

    harness.cleanup();
  });

  it('restores focus on unmount', () => {
    const harness = makeHarness();
    harness.outside.focus();

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(harness.container);
      useFocusTrap(true, ref);
    });

    expect(document.activeElement).toBe(harness.buttons[0]);

    unmount();

    expect(document.activeElement).toBe(harness.outside);

    harness.cleanup();
  });

  it('wraps to the first stop when Tab is pressed from outside the container', () => {
    const harness = makeHarness();

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(harness.container);
      useFocusTrap(true, ref);
    });

    // Force-focus the outside element to simulate focus escaping the trap.
    harness.outside.focus();
    expect(document.activeElement).toBe(harness.outside);

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(document.activeElement).toBe(harness.buttons[0]);

    harness.cleanup();
  });

  it('does not throw when there are no focusable elements in the container', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    const empty = document.createElement('div');
    document.body.appendChild(empty);

    expect(() => {
      renderHook(() => {
        const ref = useRef<HTMLElement | null>(empty);
        useFocusTrap(true, ref);
      });
    }).not.toThrow();

    // Tab inside an empty trap should be a no-op (or at least not throw).
    expect(() => fireEvent.keyDown(document, { key: 'Tab' })).not.toThrow();
  });
});
