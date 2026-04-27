import { peers } from '../peers';
import type { Board, Digit, Position, Variant } from '../types';
import { cloneBoard } from '../types';
import type { TechniqueId } from '../solver/techniques';

/**
 * Difficulty tiers, ordered from easiest to hardest. The puzzle's difficulty is
 * defined by the hardest technique required to solve it using only logical
 * deductions (no guessing). Clue-count acts as a secondary bound — see
 * `CLUE_BOUNDS` below.
 */
export type Difficulty =
  | 'Easy'
  | 'Medium'
  | 'Hard'
  | 'Expert'
  | 'Master'
  | 'Diabolical'
  | 'Demonic'
  | 'Nightmare';

export const DIFFICULTY_ORDER: readonly Difficulty[] = [
  'Easy',
  'Medium',
  'Hard',
  'Expert',
  'Master',
  'Diabolical',
  'Demonic',
  'Nightmare',
];

/**
 * Mapping from technique id to the minimum difficulty tier that requires it.
 * A puzzle's rating is the max over all techniques used in its solution chain.
 */
const TECHNIQUE_TIER: Record<TechniqueId, Difficulty> = {
  'naked-single': 'Easy',
  'hidden-single': 'Medium',
  'naked-pair': 'Hard',
  'naked-triple': 'Hard',
  pointing: 'Hard',
  'box-line-reduction': 'Expert',
  'x-wing': 'Expert',
};

/**
 * Clue-count bounds per variant per difficulty tier. These are target windows
 * used as a secondary difficulty signal (per requirements §5). Format:
 * `[minClues, maxClues]` inclusive.
 */
export const CLUE_BOUNDS: Record<string, Record<Difficulty, [number, number]>> = {
  classic: {
    Easy: [38, 45],
    Medium: [32, 37],
    Hard: [28, 31],
    Expert: [24, 27],
  },
  // Mini = 4x4 = 16 cells total. Scale down from classic proportionally.
  mini: {
    Easy: [12, 14],
    Medium: [10, 11],
    Hard: [8, 9],
    Expert: [6, 7],
  },
  // Six = 6x6 = 36 cells total. Intermediate scaling.
  six: {
    Easy: [22, 26],
    Medium: [18, 21],
    Hard: [15, 17],
    Expert: [12, 14],
  },
};

function tierRank(d: Difficulty): number {
  return DIFFICULTY_ORDER.indexOf(d);
}

// ---------------------------------------------------------------------------
// Candidate-grid-based technique solver used for rating.
//
// The public `nextStep` in `solver/techniques` recomputes candidates from
// placed values for each call, which means elimination-only techniques (naked
// pair, pointing, etc.) can't propagate their work back into subsequent calls.
// For rating we need a self-consistent solver, so we maintain our own
// candidate grid and re-implement the scans against it.
// ---------------------------------------------------------------------------

type Candidates = (Set<Digit> | null)[][];

interface HouseCells {
  house: 'row' | 'col' | 'box';
  houseIndex: number;
  cells: Position[];
}

function* iterateHouses(variant: Variant): Generator<HouseCells> {
  const size = variant.size;
  for (let r = 0; r < size; r++) {
    const cells: Position[] = [];
    for (let c = 0; c < size; c++) cells.push({ row: r, col: c });
    yield { house: 'row', houseIndex: r, cells };
  }
  for (let c = 0; c < size; c++) {
    const cells: Position[] = [];
    for (let r = 0; r < size; r++) cells.push({ row: r, col: c });
    yield { house: 'col', houseIndex: c, cells };
  }
  const boxesPerRow = size / variant.boxWidth;
  const boxesPerCol = size / variant.boxHeight;
  for (let br = 0; br < boxesPerCol; br++) {
    for (let bc = 0; bc < boxesPerRow; bc++) {
      const houseIndex = br * boxesPerRow + bc;
      const cells: Position[] = [];
      const startRow = br * variant.boxHeight;
      const startCol = bc * variant.boxWidth;
      for (let r = startRow; r < startRow + variant.boxHeight; r++) {
        for (let c = startCol; c < startCol + variant.boxWidth; c++) {
          cells.push({ row: r, col: c });
        }
      }
      yield { house: 'box', houseIndex, cells };
    }
  }
}

function buildCandidates(board: Board): Candidates {
  const { variant, cells } = board;
  const grid: Candidates = [];
  for (let r = 0; r < variant.size; r++) {
    const row: (Set<Digit> | null)[] = [];
    for (let c = 0; c < variant.size; c++) {
      if (cells[r][c].value != null) {
        row.push(null);
      } else {
        const used = new Set<Digit>();
        for (const p of peers(variant, { row: r, col: c })) {
          const v = cells[p.row][p.col].value;
          if (v != null) used.add(v);
        }
        const cand = new Set<Digit>();
        for (const d of variant.digits) {
          if (!used.has(d)) cand.add(d);
        }
        row.push(cand);
      }
    }
    grid.push(row);
  }
  return grid;
}

function placeDigit(
  board: Board,
  grid: Candidates,
  pos: Position,
  digit: Digit,
): void {
  board.cells[pos.row][pos.col].value = digit;
  grid[pos.row][pos.col] = null;
  for (const p of peers(board.variant, pos)) {
    const set = grid[p.row][p.col];
    if (set != null) set.delete(digit);
  }
}

function findNakedSingle(
  variant: Variant,
  grid: Candidates,
): { pos: Position; digit: Digit } | null {
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      const cand = grid[r][c];
      if (cand != null && cand.size === 1) {
        const [digit] = cand;
        return { pos: { row: r, col: c }, digit };
      }
    }
  }
  return null;
}

function findHiddenSingle(
  variant: Variant,
  grid: Candidates,
): { pos: Position; digit: Digit } | null {
  for (const house of iterateHouses(variant)) {
    for (const digit of variant.digits) {
      let found: Position | null = null;
      let count = 0;
      for (const pos of house.cells) {
        const cand = grid[pos.row][pos.col];
        if (cand == null) continue;
        if (cand.has(digit)) {
          count += 1;
          if (count === 1) found = pos;
          else break;
        }
      }
      if (count === 1 && found != null) {
        return { pos: found, digit };
      }
    }
  }
  return null;
}

function* combinations<T>(
  items: T[],
  k: number,
  start = 0,
  picked: T[] = [],
): Generator<T[]> {
  if (picked.length === k) {
    yield picked.slice();
    return;
  }
  for (let i = start; i <= items.length - (k - picked.length); i++) {
    picked.push(items[i]);
    yield* combinations(items, k, i + 1, picked);
    picked.pop();
  }
}

function findNakedSubset(
  variant: Variant,
  grid: Candidates,
  size: 2 | 3,
): { eliminations: Array<{ pos: Position; digits: Digit[] }> } | null {
  for (const house of iterateHouses(variant)) {
    const emptyCells: { pos: Position; candidates: Set<Digit> }[] = [];
    for (const pos of house.cells) {
      const cand = grid[pos.row][pos.col];
      if (cand == null) continue;
      if (cand.size >= 2 && cand.size <= size) {
        emptyCells.push({ pos, candidates: cand });
      }
    }
    if (emptyCells.length < size) continue;

    for (const combo of combinations(emptyCells, size)) {
      const union = new Set<Digit>();
      for (const entry of combo) {
        for (const d of entry.candidates) union.add(d);
      }
      if (union.size !== size) continue;

      const comboKeys = new Set(combo.map((e) => `${e.pos.row},${e.pos.col}`));
      const eliminations: Array<{ pos: Position; digits: Digit[] }> = [];
      for (const pos of house.cells) {
        const key = `${pos.row},${pos.col}`;
        if (comboKeys.has(key)) continue;
        const cand = grid[pos.row][pos.col];
        if (cand == null) continue;
        const removed: Digit[] = [];
        for (const d of union) {
          if (cand.has(d)) removed.push(d);
        }
        if (removed.length > 0) eliminations.push({ pos, digits: removed });
      }
      if (eliminations.length > 0) return { eliminations };
    }
  }
  return null;
}

function boxIndexFor(variant: Variant, pos: Position): number {
  const boxesPerRow = variant.size / variant.boxWidth;
  const br = Math.floor(pos.row / variant.boxHeight);
  const bc = Math.floor(pos.col / variant.boxWidth);
  return br * boxesPerRow + bc;
}

/**
 * Pointing: within a box, a digit's candidates are all in one row or column.
 * Eliminate that digit from the rest of that row/column outside the box.
 */
function findPointing(
  variant: Variant,
  grid: Candidates,
): { eliminations: Array<{ pos: Position; digits: Digit[] }> } | null {
  for (const house of iterateHouses(variant)) {
    if (house.house !== 'box') continue;
    for (const digit of variant.digits) {
      const cells: Position[] = [];
      for (const pos of house.cells) {
        const cand = grid[pos.row][pos.col];
        if (cand != null && cand.has(digit)) cells.push(pos);
      }
      if (cells.length < 2) continue;

      const sameRow = cells.every((p) => p.row === cells[0].row);
      const sameCol = cells.every((p) => p.col === cells[0].col);

      if (sameRow) {
        const row = cells[0].row;
        const boxKeys = new Set(house.cells.map((p) => `${p.row},${p.col}`));
        const eliminations: Array<{ pos: Position; digits: Digit[] }> = [];
        for (let c = 0; c < variant.size; c++) {
          const target: Position = { row, col: c };
          if (boxKeys.has(`${target.row},${target.col}`)) continue;
          const cand = grid[target.row][target.col];
          if (cand != null && cand.has(digit)) {
            eliminations.push({ pos: target, digits: [digit] });
          }
        }
        if (eliminations.length > 0) return { eliminations };
      }
      if (sameCol) {
        const col = cells[0].col;
        const boxKeys = new Set(house.cells.map((p) => `${p.row},${p.col}`));
        const eliminations: Array<{ pos: Position; digits: Digit[] }> = [];
        for (let r = 0; r < variant.size; r++) {
          const target: Position = { row: r, col };
          if (boxKeys.has(`${target.row},${target.col}`)) continue;
          const cand = grid[target.row][target.col];
          if (cand != null && cand.has(digit)) {
            eliminations.push({ pos: target, digits: [digit] });
          }
        }
        if (eliminations.length > 0) return { eliminations };
      }
    }
  }
  return null;
}

/**
 * Box/line reduction: within a row or column, a digit's candidates all fall in
 * a single box. Eliminate that digit from the rest of the box.
 */
function findBoxLineReduction(
  variant: Variant,
  grid: Candidates,
): { eliminations: Array<{ pos: Position; digits: Digit[] }> } | null {
  for (const house of iterateHouses(variant)) {
    if (house.house === 'box') continue;
    for (const digit of variant.digits) {
      const cells: Position[] = [];
      for (const pos of house.cells) {
        const cand = grid[pos.row][pos.col];
        if (cand != null && cand.has(digit)) cells.push(pos);
      }
      if (cells.length < 2) continue;

      const firstBox = boxIndexFor(variant, cells[0]);
      const sameBox = cells.every((p) => boxIndexFor(variant, p) === firstBox);
      if (!sameBox) continue;

      const boxesPerRow = variant.size / variant.boxWidth;
      const br = Math.floor(firstBox / boxesPerRow);
      const bc = firstBox % boxesPerRow;
      const startRow = br * variant.boxHeight;
      const startCol = bc * variant.boxWidth;

      const houseKeys = new Set(house.cells.map((p) => `${p.row},${p.col}`));
      const eliminations: Array<{ pos: Position; digits: Digit[] }> = [];
      for (let r = startRow; r < startRow + variant.boxHeight; r++) {
        for (let c = startCol; c < startCol + variant.boxWidth; c++) {
          const target: Position = { row: r, col: c };
          if (houseKeys.has(`${target.row},${target.col}`)) continue;
          const cand = grid[target.row][target.col];
          if (cand != null && cand.has(digit)) {
            eliminations.push({ pos: target, digits: [digit] });
          }
        }
      }
      if (eliminations.length > 0) return { eliminations };
    }
  }
  return null;
}

function findXWing(
  variant: Variant,
  grid: Candidates,
): { eliminations: Array<{ pos: Position; digits: Digit[] }> } | null {
  const size = variant.size;

  // Row orientation.
  for (const digit of variant.digits) {
    const rowCols: number[][] = [];
    for (let r = 0; r < size; r++) {
      const cols: number[] = [];
      for (let c = 0; c < size; c++) {
        const cand = grid[r][c];
        if (cand != null && cand.has(digit)) cols.push(c);
      }
      rowCols.push(cols);
    }
    const rowsWithTwo: number[] = [];
    for (let r = 0; r < size; r++) if (rowCols[r].length === 2) rowsWithTwo.push(r);
    for (let i = 0; i < rowsWithTwo.length; i++) {
      for (let j = i + 1; j < rowsWithTwo.length; j++) {
        const r1 = rowsWithTwo[i];
        const r2 = rowsWithTwo[j];
        if (
          rowCols[r1][0] !== rowCols[r2][0] ||
          rowCols[r1][1] !== rowCols[r2][1]
        )
          continue;
        const c1 = rowCols[r1][0];
        const c2 = rowCols[r1][1];
        const eliminations: Array<{ pos: Position; digits: Digit[] }> = [];
        for (let r = 0; r < size; r++) {
          if (r === r1 || r === r2) continue;
          for (const c of [c1, c2]) {
            const cand = grid[r][c];
            if (cand != null && cand.has(digit)) {
              eliminations.push({ pos: { row: r, col: c }, digits: [digit] });
            }
          }
        }
        if (eliminations.length > 0) return { eliminations };
      }
    }
  }

  // Column orientation.
  for (const digit of variant.digits) {
    const colRows: number[][] = [];
    for (let c = 0; c < size; c++) {
      const rows: number[] = [];
      for (let r = 0; r < size; r++) {
        const cand = grid[r][c];
        if (cand != null && cand.has(digit)) rows.push(r);
      }
      colRows.push(rows);
    }
    const colsWithTwo: number[] = [];
    for (let c = 0; c < size; c++) if (colRows[c].length === 2) colsWithTwo.push(c);
    for (let i = 0; i < colsWithTwo.length; i++) {
      for (let j = i + 1; j < colsWithTwo.length; j++) {
        const c1 = colsWithTwo[i];
        const c2 = colsWithTwo[j];
        if (
          colRows[c1][0] !== colRows[c2][0] ||
          colRows[c1][1] !== colRows[c2][1]
        )
          continue;
        const r1 = colRows[c1][0];
        const r2 = colRows[c1][1];
        const eliminations: Array<{ pos: Position; digits: Digit[] }> = [];
        for (let c = 0; c < size; c++) {
          if (c === c1 || c === c2) continue;
          for (const r of [r1, r2]) {
            const cand = grid[r][c];
            if (cand != null && cand.has(digit)) {
              eliminations.push({ pos: { row: r, col: c }, digits: [digit] });
            }
          }
        }
        if (eliminations.length > 0) return { eliminations };
      }
    }
  }

  return null;
}

function applyEliminations(
  grid: Candidates,
  eliminations: Array<{ pos: Position; digits: Digit[] }>,
): void {
  for (const { pos, digits } of eliminations) {
    const cand = grid[pos.row][pos.col];
    if (cand == null) continue;
    for (const d of digits) cand.delete(d);
  }
}

function isSolved(board: Board): boolean {
  const size = board.variant.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board.cells[r][c].value == null) return false;
    }
  }
  return true;
}

function countGivens(board: Board): number {
  let n = 0;
  const size = board.variant.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board.cells[r][c].given) n += 1;
    }
  }
  return n;
}

export interface RateResult {
  /** The final difficulty tier for the puzzle. */
  difficulty: Difficulty;
  /** The hardest technique that was actually required, if the puzzle was
   *  solved by technique chain. `null` if the techniques can't finish it
   *  (in which case `difficulty` is `Expert`). */
  hardestTechnique: TechniqueId | null;
  /** The set of technique ids used during solving. */
  techniquesUsed: TechniqueId[];
  /** Whether the chain of implemented techniques fully solved the puzzle. */
  solved: boolean;
  /** Number of given clues in the puzzle. */
  clueCount: number;
}

/**
 * Rate a puzzle by solving it with the implemented technique chain and
 * returning the hardest technique required, mapped to a difficulty tier.
 *
 * If the technique chain can't fully solve the puzzle, the puzzle is rated
 * `Expert` — this means it requires techniques beyond those implemented (or
 * guessing), which is at or above Expert in our taxonomy.
 */
export function rate(puzzle: Board): RateResult {
  const board = cloneBoard(puzzle);
  const grid = buildCandidates(board);
  const used = new Set<TechniqueId>();
  let hardestTier: Difficulty = 'Easy';
  let hardestTechnique: TechniqueId | null = null;

  const noteTechnique = (id: TechniqueId): void => {
    used.add(id);
    const tier = TECHNIQUE_TIER[id];
    if (tierRank(tier) > tierRank(hardestTier)) {
      hardestTier = tier;
      hardestTechnique = id;
    } else if (hardestTechnique == null) {
      hardestTechnique = id;
    }
  };

  // Apply techniques in increasing-difficulty order. On any progress, restart
  // at the easiest technique, so the hardest-applied one is always the
  // minimum required.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (isSolved(board)) break;

    const ns = findNakedSingle(board.variant, grid);
    if (ns != null) {
      noteTechnique('naked-single');
      placeDigit(board, grid, ns.pos, ns.digit);
      continue;
    }

    const hs = findHiddenSingle(board.variant, grid);
    if (hs != null) {
      noteTechnique('hidden-single');
      placeDigit(board, grid, hs.pos, hs.digit);
      continue;
    }

    const np = findNakedSubset(board.variant, grid, 2);
    if (np != null) {
      noteTechnique('naked-pair');
      applyEliminations(grid, np.eliminations);
      continue;
    }

    const nt = findNakedSubset(board.variant, grid, 3);
    if (nt != null) {
      noteTechnique('naked-triple');
      applyEliminations(grid, nt.eliminations);
      continue;
    }

    const pt = findPointing(board.variant, grid);
    if (pt != null) {
      noteTechnique('pointing');
      applyEliminations(grid, pt.eliminations);
      continue;
    }

    const bl = findBoxLineReduction(board.variant, grid);
    if (bl != null) {
      noteTechnique('box-line-reduction');
      applyEliminations(grid, bl.eliminations);
      continue;
    }

    const xw = findXWing(board.variant, grid);
    if (xw != null) {
      noteTechnique('x-wing');
      applyEliminations(grid, xw.eliminations);
      continue;
    }

    // No technique made progress — stop.
    break;
  }

  const solved = isSolved(board);
  const difficulty: Difficulty = solved ? hardestTier : 'Expert';
  return {
    difficulty,
    hardestTechnique,
    techniquesUsed: [...used],
    solved,
    clueCount: countGivens(puzzle),
  };
}
