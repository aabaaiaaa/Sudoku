import { test, expect } from '@playwright/test';

/**
 * TASK-042: E2E — new game → place digits → win.
 *
 * Seeds the game store with a near-complete Mini (4x4) puzzle that has a
 * single empty cell, places the final digit via the number pad, and asserts
 * the win modal appears with a non-zero elapsed time.
 *
 * The Mini variant is used so the seeded grid can be described inline and
 * verified by eye. Solution grid:
 *
 *   1 2 | 3 4
 *   3 4 | 1 2
 *   ---------
 *   2 1 | 4 3
 *   4 3 | 2 1
 *
 * Cell (0,0) is the single blank. Placing digit 1 there completes the puzzle.
 */

const MINI_SOLUTION: number[][] = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];

test('Mini game → place final digit → win modal appears with non-zero time', async ({
  page,
}) => {
  // Clean slate so no prior save leaks between runs.
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('sudoku.save.v1');
  });
  await page.reload();

  // --- Start a Mini game through the UI. -----------------------------------
  await page.getByTestId('home-variant-mini').check();
  await page.getByTestId('home-difficulty-easy').check();
  await page.getByTestId('home-new-game').click();

  await expect(page.getByTestId('sudoku-board')).toBeVisible();

  // --- Seed a near-complete board via the exposed test hook. ---------------
  //
  // The hook exposes the singleton Zustand store. We replace the board cells
  // with the solution above but leave (0,0) blank. All filled cells are
  // marked `given: true` so the UI refuses to edit them. We also call
  // `resume()` to start the timer so the win modal will show a non-zero time.
  await page.evaluate((solution: number[][]) => {
    type Cell = { value: number | null; notes: Set<number>; given: boolean };
    interface Variant {
      size: number;
    }
    interface State {
      board: { variant: Variant; cells: Cell[][] };
      timer: { startTs: number | null; accumulatedMs: number; paused: boolean };
    }
    const globalAny = window as unknown as {
      __sudokuGameStore?: {
        getState: () => State & { resume: () => void };
        setState: (s: Partial<State>) => void;
      };
    };
    const store = globalAny.__sudokuGameStore;
    if (!store) throw new Error('Test hook __sudokuGameStore not present');

    const state = store.getState();
    const variant = state.board.variant;
    const newCells: Cell[][] = [];
    for (let r = 0; r < variant.size; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < variant.size; c++) {
        if (r === 0 && c === 0) {
          row.push({ value: null, notes: new Set<number>(), given: false });
        } else {
          row.push({
            value: solution[r][c],
            notes: new Set<number>(),
            given: true,
          });
        }
      }
      newCells.push(row);
    }

    store.setState({ board: { variant, cells: newCells } });
    state.resume();
  }, MINI_SOLUTION);

  // Give the timer a small, observable amount of wall-clock time before we
  // complete the puzzle. The elapsed time is computed from timestamps inside
  // the store, so waiting here is sufficient.
  await page.waitForTimeout(1100);

  // --- Place the final digit via the number pad. ---------------------------
  await page.getByTestId('cell-r0-c0').click();
  await page.getByTestId('pad-digit-1').click();

  // Sanity: the placed digit should be visible in the cell.
  await expect(page.getByTestId('cell-r0-c0')).toContainText('1');

  // --- Win modal should appear with a non-zero time. -----------------------
  const modal = page.getByTestId('win-modal');
  await expect(modal).toBeVisible();

  const timeText = (await page.getByTestId('win-time').textContent())?.trim() ?? '';
  expect(timeText).toMatch(/^\d{2}:\d{2}(:\d{2})?$/);
  expect(timeText).not.toBe('00:00');
});
