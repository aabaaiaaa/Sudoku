/**
 * Focus management for modal dialogs (requirements §10).
 *
 * `useFocusTrap` keeps Tab focus inside a container while it's `active`,
 * remembers and restores the previously-focused element on deactivation, and
 * forwards Escape to an optional `onEscape` callback so dialogs can wire up
 * their cancel/dismiss action without a separate keyboard listener.
 *
 * The hook is intentionally framework-light — no portal logic, no `inert` —
 * just the minimum needed for the v0.3.0 dialog set (`<ConfirmDialog>` and
 * `<GenerationFailedDialog>`).
 */
import { useEffect, useRef } from 'react';

/**
 * Loose ref type — accepts both `RefObject<T>` (read-only `current`, the type
 * returned by `useRef<T>(null)`) and `MutableRefObject<T | null>` (writable
 * `current`, the type returned by `useRef<T | null>(initialValue)`). Using a
 * structural alias here keeps callers free of casts regardless of which
 * `useRef` overload they hit.
 */
type FocusableRef = { readonly current: HTMLElement | null };

/** Standard set of focusable selectors used to enumerate trap stops. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute('disabled'));
}

/**
 * Trap Tab focus within `ref` while `active` is true, restoring focus to the
 * previously-focused element when `active` flips back to false (or the host
 * component unmounts).
 *
 * @param active   When false the hook is a no-op — listeners are detached and
 *                 focus state is left alone.
 * @param ref      Container ref. The container should already be in the DOM
 *                 by the time `active` flips to true.
 * @param onEscape Optional handler invoked when Escape is pressed while the
 *                 trap is active. Typically wired to the dialog's cancel
 *                 action.
 */
export function useFocusTrap(
  active: boolean,
  ref: FocusableRef,
  onEscape?: () => void,
): void {
  // Keep the latest `onEscape` in a ref so the effect doesn't tear down and
  // re-attach (which would flicker focus away from the dialog) every time the
  // parent rerenders with a new closure.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;

    // Move focus into the container. Prefer the first focusable child; if
    // there is none, fall back to focusing the container itself so screen
    // readers anchor to the dialog rather than wherever focus was before.
    const focusables = getFocusable(container);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else if (typeof container.focus === 'function') {
      // Make the container itself focusable on the fly if needed.
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const handler = onEscapeRef.current;
        if (handler) {
          event.preventDefault();
          handler();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const stops = getFocusable(container);
      if (stops.length === 0) {
        // Nothing tabbable inside — keep focus pinned on the container.
        event.preventDefault();
        return;
      }

      const first = stops[0];
      const last = stops[stops.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        // Backward: from the first stop (or anything outside the trap) wrap
        // to the last.
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Forward: from the last stop (or anything outside the trap) wrap to
        // the first.
        if (activeEl === last || !container.contains(activeEl)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to wherever it was before the trap activated. Skip if
      // the previous element is no longer in the DOM (e.g. removed while the
      // dialog was open).
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function' &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
    // `onEscape` is intentionally omitted — it's read through `onEscapeRef`
    // so the trap stays mounted across parent rerenders.
  }, [active, ref]);
}

export default useFocusTrap;
