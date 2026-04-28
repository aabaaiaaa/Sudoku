import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadingOverlay } from './LoadingOverlay';

describe('LoadingOverlay', () => {
  it('renders nothing when visible is false', () => {
    const { queryByTestId } = render(<LoadingOverlay visible={false} />);
    expect(queryByTestId('loading-overlay')).toBeNull();
    expect(queryByTestId('loading-spinner')).toBeNull();
  });

  it('renders a full-screen overlay when visible is true', () => {
    const { getByTestId } = render(<LoadingOverlay visible={true} />);
    const overlay = getByTestId('loading-overlay');
    expect(overlay).not.toBeNull();
    // Full-screen: positioned fixed and covers the viewport edges.
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('inset-0');
  });

  it('centers a spinner inside the overlay', () => {
    const { getByTestId } = render(<LoadingOverlay visible={true} />);
    const overlay = getByTestId('loading-overlay');
    const spinner = getByTestId('loading-spinner');
    expect(overlay.contains(spinner)).toBe(true);
    expect(overlay.className).toContain('items-center');
    expect(overlay.className).toContain('justify-center');
  });

  it('applies a translucent background and backdrop blur to mimic the pause overlay', () => {
    const { getByTestId } = render(<LoadingOverlay visible={true} />);
    const overlay = getByTestId('loading-overlay');
    // jsdom returns inline-style strings via the style attribute.
    const style = overlay.getAttribute('style') ?? '';
    expect(style).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.15\)/);
    expect(style).toMatch(/blur\(8px\)/);
  });

  it('renders no text content before the cancel threshold elapses', () => {
    const { getByTestId } = render(<LoadingOverlay visible={true} />);
    const overlay = getByTestId('loading-overlay');
    expect(overlay.textContent?.trim() ?? '').toBe('');
  });

  describe('cancel button (10s threshold)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('hides the cancel button initially when the overlay first appears', () => {
      const { queryByTestId } = render(<LoadingOverlay visible={true} />);
      expect(queryByTestId('loading-cancel')).toBeNull();
      expect(queryByTestId('loading-cancel-note')).toBeNull();
      expect(queryByTestId('loading-cancel-actions')).toBeNull();
    });

    it('still hides the cancel button just before the 10s threshold', () => {
      const { queryByTestId } = render(<LoadingOverlay visible={true} />);
      act(() => {
        vi.advanceTimersByTime(9_999);
      });
      expect(queryByTestId('loading-cancel')).toBeNull();
    });

    it('shows the cancel button after 10s of continuous visibility', () => {
      const { queryByTestId, getByTestId } = render(
        <LoadingOverlay visible={true} />,
      );
      expect(queryByTestId('loading-cancel')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      const button = getByTestId('loading-cancel');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Cancel');
    });

    it('shows the "higher difficulties" note alongside the cancel button at 10s', () => {
      const { getByTestId } = render(<LoadingOverlay visible={true} />);

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      const note = getByTestId('loading-cancel-note');
      expect(note.textContent).toBe(
        'Higher difficulties can take longer to generate.',
      );
    });

    it('invokes onCancel when the cancel button is clicked after 10s', () => {
      const onCancel = vi.fn();
      const { getByTestId } = render(
        <LoadingOverlay visible={true} onCancel={onCancel} />,
      );

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      fireEvent.click(getByTestId('loading-cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('resets the 10s timer when the overlay hides and reappears', () => {
      const { queryByTestId, rerender } = render(
        <LoadingOverlay visible={true} />,
      );

      act(() => {
        vi.advanceTimersByTime(9_000);
      });
      expect(queryByTestId('loading-cancel')).toBeNull();

      // Hide the overlay — this should clear the in-flight 10s timer and
      // reset the showCancel state.
      rerender(<LoadingOverlay visible={false} />);
      rerender(<LoadingOverlay visible={true} />);

      // After a further 9s (18s total elapsed but only 9s of the new visible
      // run) the button must still be hidden — the timer restarted.
      act(() => {
        vi.advanceTimersByTime(9_000);
      });
      expect(queryByTestId('loading-cancel')).toBeNull();

      // One more second crosses the new 10s threshold.
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(queryByTestId('loading-cancel')).not.toBeNull();
    });

    it('hides the cancel button when the overlay disappears mid-wait', () => {
      const { queryByTestId, rerender } = render(
        <LoadingOverlay visible={true} />,
      );

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(queryByTestId('loading-cancel')).not.toBeNull();

      rerender(<LoadingOverlay visible={false} />);
      expect(queryByTestId('loading-cancel')).toBeNull();
      expect(queryByTestId('loading-overlay')).toBeNull();
    });
  });
});
