import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('renders no text content', () => {
    const { getByTestId } = render(<LoadingOverlay visible={true} />);
    const overlay = getByTestId('loading-overlay');
    expect(overlay.textContent?.trim() ?? '').toBe('');
  });
});
