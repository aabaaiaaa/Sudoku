import { test, expect } from '@playwright/test';

/**
 * TASK-043: E2E — pencil marks, auto-removal, and mistake highlighting.
 *
 * Starts a Mini (4x4) game and replaces the generated board with a fully
 * empty, non-given grid via the `__sudokuGameStore` test hook, so the test
 * has complete control over which digits appear where.
 *
 * Verifies:
 *  - Toggling notes mode and clicking a digit records a pencil mark on the
 *    selected cell.
 *  - Placing a digit in a peer cell automatically removes that digit from
 *    any peer's pencil marks.
 *  - Placing a digit that duplicates a peer's value applies the `conflict`
 *    class (from Cell.tsx) to both offending cells.
 */

const SAVE_STORAGE_KEY = 'sudoku.save.v1';

test('pencil marks clear from peers and conflicts are highlighted', async ({
  page,
}) => {
  // --- Clean slate so no prior save bleeds through. -------------------------
  await page.goto('/');
  await page.evaluate((key) => {
    window.localStorage.removeItem(key);
  }, SAVE_STORAGE_KEY);
  await page.reload();

  // --- Start a Mini easy game through the UI. -------------------------------
  await page.getByTestId('home-variant-mini').check();
  await page.getByTestId('home-difficulty-easy').check();
  await page.getByTestId('home-new-game').click();

  const board = page.getByTestId('sudoku-board');
  await expect(board).toBeVisible();

  // --- Seed a fully empty, all-editable Mini grid. --------------------------
  await page.evaluate(() => {
    type Cell = { value: number | null; notes: Set<number>; given: boolean };
    interface Variant {
      size: number;
    }
    interface State {
      board: { variant: Variant; cells: Cell[][] };
    }
    const globalAny = window as unknown as {
      __sudokuGameStore?: {
        getState: () => State;
        setState: (s: Partial<State>) => void;
      };
    };
    const store = globalAny.__sudokuGameStore;
    if (!store) throw new Error('Test hook __sudokuGameStore not present');

    const state = store.getState();
    const variant = state.board.variant;
    const cells: Cell[][] = [];
    for (let r = 0; r < variant.size; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < variant.size; c++) {
        row.push({ value: null, notes: new Set<number>(), given: false });
      }
      cells.push(row);
    }
    store.setState({ board: { variant, cells } });
  });

  // --- Enter notes mode and add pencil marks 1, 2, 3 to cell (0, 0). -------
  const notesToggle = page.getByTestId('pad-notes');
  await notesToggle.click();
  await expect(notesToggle).toHaveAttribute('aria-pressed', 'true');

  const originCell = page.getByTestId('cell-r0-c0');
  await originCell.click();
  await page.getByTestId('pad-digit-1').click();
  await page.getByTestId('pad-digit-2').click();
  await page.getByTestId('pad-digit-3').click();

  // The cell currently has no placed value, so its text content is the
  // concatenation of the rendered pencil-mark digits.
  await expect(originCell).toContainText('1');
  await expect(originCell).toContainText('2');
  await expect(originCell).toContainText('3');

  // --- Leave notes mode and place digit 1 in a peer (column peer). ---------
  await notesToggle.click();
  await expect(notesToggle).toHaveAttribute('aria-pressed', 'false');

  const columnPeer = page.getByTestId('cell-r1-c0');
  await columnPeer.click();
  await page.getByTestId('pad-digit-1').click();
  await expect(columnPeer).toHaveText('1');

  // --- Auto-removal: digit 1 should have been pruned from (0,0)'s notes. ---
  await expect(originCell).not.toContainText('1');
  // Remaining marks must still be present.
  await expect(originCell).toContainText('2');
  await expect(originCell).toContainText('3');

  // --- Place a conflicting digit (1) in another column peer (2, 0). --------
  const conflictPeer = page.getByTestId('cell-r2-c0');
  await conflictPeer.click();
  await page.getByTestId('pad-digit-1').click();
  await expect(conflictPeer).toHaveText('1');

  // Both duplicates in the same column should carry the `conflict` class.
  await expect(columnPeer).toHaveClass(/conflict/);
  await expect(conflictPeer).toHaveClass(/conflict/);
});
