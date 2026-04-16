import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Cell } from './Cell';

describe('Cell', () => {
  it('renders the digit when value is set', () => {
    const { getByTestId, queryByTestId } = render(<Cell value={7} />);

    const cell = getByTestId('cell');
    expect(cell.textContent).toBe('7');
    // When a value is placed, the pencil-marks grid should not render.
    expect(queryByTestId('pencil-marks')).toBeNull();
  });

  it('renders 1-9 pencil marks when empty and all candidates are set (Classic)', () => {
    const marks = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const { getByTestId } = render(<Cell value={null} pencilMarks={marks} />);

    expect(getByTestId('pencil-marks')).toBeTruthy();
    for (let d = 1; d <= 9; d++) {
      const mark = getByTestId(`pencil-mark-${d}`);
      expect(mark.textContent).toBe(String(d));
    }
  });

  it('applies the conflict class when isConflict is true', () => {
    const { getByTestId } = render(<Cell value={5} isConflict />);

    const cell = getByTestId('cell');
    expect(cell.className).toMatch(/\bconflict\b/);
  });
});
