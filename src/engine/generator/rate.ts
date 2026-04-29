import { peers } from '../peers';
import type { Board, Digit, Position, Variant } from '../types';
import { cloneBoard } from '../types';
import type { TechniqueId } from '../solver/techniques';
import { findHiddenPair } from '../solver/techniques/hidden-pair';
import { findHiddenTriple } from '../solver/techniques/hidden-triple';
import { findNakedQuad } from '../solver/techniques/naked-quad';
import { findHiddenQuad } from '../solver/techniques/hidden-quad';
import { findSwordfish } from '../solver/techniques/swordfish';
import { findJellyfish } from '../solver/techniques/jellyfish';
import { findXyWing } from '../solver/techniques/xy-wing';
import { findXyzWing } from '../solver/techniques/xyz-wing';
import { findWWing } from '../solver/techniques/w-wing';
import { findSimpleColoring } from '../solver/techniques/simple-coloring';
import { findXCycle } from '../solver/techniques/x-cycle';
import { findEmptyRectangle } from '../solver/techniques/empty-rectangle';
import { findSkyscraper } from '../solver/techniques/skyscraper';
import { findTwoStringKite } from '../solver/techniques/two-string-kite';
import { findUniqueRectangle } from '../solver/techniques/unique-rectangle';
import { findBugPlus1 } from '../solver/techniques/bug';
import { findXyChain } from '../solver/techniques/xy-chain';
import { findMultiColoring } from '../solver/techniques/multi-coloring';
import { findAlsXz } from '../solver/techniques/als-xz';
import { findWxyzWing } from '../solver/techniques/wxyz-wing';
import { findHiddenRectangle } from '../solver/techniques/hidden-rectangle';
import { findAvoidableRectangle } from '../solver/techniques/avoidable-rectangle';
import { findNiceLoop } from '../solver/techniques/nice-loop';
import { findGroupedXCycle } from '../solver/techniques/grouped-x-cycle';
import { find3DMedusa } from '../solver/techniques/medusa-3d';
import { findDeathBlossom } from '../solver/techniques/death-blossom';
import { findForcingChains } from '../solver/techniques/forcing-chains';

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
  pointing: 'Hard',
  'box-line-reduction': 'Hard',
  'naked-pair': 'Expert',
  'naked-triple': 'Expert',
  'naked-quad': 'Expert',
  'hidden-pair': 'Expert',
  'hidden-triple': 'Expert',
  'hidden-quad': 'Expert',
  'x-wing': 'Master',
  swordfish: 'Master',
  jellyfish: 'Master',
  'xy-wing': 'Diabolical',
  'xyz-wing': 'Diabolical',
  'w-wing': 'Diabolical',
  'simple-coloring': 'Diabolical',
  'x-cycle': 'Diabolical',
  'empty-rectangle': 'Diabolical',
  skyscraper: 'Diabolical',
  'two-string-kite': 'Diabolical',
  'unique-rectangle': 'Demonic',
  'bug-plus-one': 'Demonic',
  'xy-chain': 'Demonic',
  'multi-coloring': 'Demonic',
  'als-xz': 'Demonic',
  'wxyz-wing': 'Demonic',
  'hidden-rectangle': 'Demonic',
  'avoidable-rectangle': 'Demonic',
  'nice-loop': 'Nightmare',
  'grouped-x-cycle': 'Nightmare',
  '3d-medusa': 'Nightmare',
  'death-blossom': 'Nightmare',
  'forcing-chains': 'Nightmare',
};

/**
 * Clue-count bounds per variant per difficulty tier. These are advisory
 * windows used as a secondary signal — the primary filter is strict tier
 * matching against the rated technique chain. Format: `[minClues, maxClues]`
 * inclusive. Variants only define entries for tiers their grid size can
 * realistically support; the UI hides infeasible tiers per variant.
 */
export const CLUE_BOUNDS: Record<
  string,
  Partial<Record<Difficulty, [number, number]>>
> = {
  classic: {
    Easy: [38, 45],
    Medium: [32, 37],
    Hard: [28, 31],
    Expert: [24, 27],
    Master: [26, 31],
    Diabolical: [24, 28],
    Demonic: [22, 26],
    Nightmare: [20, 24],
  },
  // Mini = 4x4 = 16 cells total. Subsets and fish degenerate at this size, so
  // the cap is Hard — higher tiers are not generatable.
  mini: {
    Easy: [12, 14],
    Medium: [10, 11],
    Hard: [8, 9],
  },
  // Six = 6x6 = 36 cells total. Wings/chains are possible up to Diabolical;
  // Demonic+ patterns are statistically unreachable on this grid.
  six: {
    Easy: [22, 26],
    Medium: [18, 21],
    Hard: [15, 17],
    Expert: [12, 14],
    Master: [13, 16],
    Diabolical: [11, 14],
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
): boolean {
  let changed = false;
  for (const { pos, digits } of eliminations) {
    const cand = grid[pos.row][pos.col];
    if (cand == null) continue;
    for (const d of digits) {
      if (cand.delete(d)) changed = true;
    }
  }
  return changed;
}

/**
 * Adapt the technique-module elimination shape (`{ cell, digits }`) to the
 * shape used by `applyEliminations` (`{ pos, digits }`). The new technique
 * finders all surface eliminations with `cell`; the rate.ts solver maintains
 * its own grid which is keyed by `pos`.
 */
function adaptEliminations(
  list: ReadonlyArray<{ cell: Position; digits: readonly Digit[] }>,
): Array<{ pos: Position; digits: Digit[] }> {
  return list.map(({ cell, digits }) => ({ pos: cell, digits: [...digits] }));
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
  /** The hardest technique that actually fired during the cascade. `null`
   *  only if no technique fired at all (e.g. an empty or already-solved
   *  board). When the cascade stalls, this still reflects the hardest
   *  technique used; consult `solved` to know whether the cascade finished. */
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
 * `difficulty` always reflects the hardest technique that actually fired
 * during the cascade — it is never used as a sentinel for "unsolvable".
 * Callers must consult `solved: false` separately to detect a stalled
 * cascade (i.e. the puzzle requires reasoning beyond the implemented
 * technique chain). When `solved` is `false`, `difficulty` still reports
 * the hardest technique used so far rather than a fallback label, which
 * keeps the tier mapping unambiguous and prevents collisions with puzzles
 * that legitimately rate at the same tier.
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

    // ---------------------------------------------------------------------
    // Extended technique chain. The finders below operate on the live
    // board and recompute their own candidates, so they may target
    // candidates the rate.ts grid has already eliminated. We only count a
    // technique as having "fired" when its eliminations actually change
    // the grid (or a placement is produced). Otherwise we fall through to
    // the next technique to avoid infinite re-firing.
    // ---------------------------------------------------------------------

    const hp = findHiddenPair(board);
    if (hp != null) {
      const elims = adaptEliminations(hp.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('hidden-pair');
        continue;
      } else {
        console.warn('[rate] Technique hidden-pair returned eliminations, but all were already applied.');
      }
    }

    const ht = findHiddenTriple(board);
    if (ht != null) {
      const elims = adaptEliminations(ht.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('hidden-triple');
        continue;
      } else {
        console.warn('[rate] Technique hidden-triple returned eliminations, but all were already applied.');
      }
    }

    const nq = findNakedQuad(board);
    if (nq != null) {
      const elims = adaptEliminations(nq.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('naked-quad');
        continue;
      } else {
        console.warn('[rate] Technique naked-quad returned eliminations, but all were already applied.');
      }
    }

    const hq = findHiddenQuad(board);
    if (hq != null) {
      const elims = adaptEliminations(hq.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('hidden-quad');
        continue;
      } else {
        console.warn('[rate] Technique hidden-quad returned eliminations, but all were already applied.');
      }
    }

    const sf = findSwordfish(board);
    if (sf != null) {
      const elims = adaptEliminations(sf.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('swordfish');
        continue;
      } else {
        console.warn('[rate] Technique swordfish returned eliminations, but all were already applied.');
      }
    }

    const jf = findJellyfish(board);
    if (jf != null) {
      const elims = adaptEliminations(jf.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('jellyfish');
        continue;
      } else {
        console.warn('[rate] Technique jellyfish returned eliminations, but all were already applied.');
      }
    }

    const xyw = findXyWing(board);
    if (xyw != null) {
      const elims = adaptEliminations(xyw.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('xy-wing');
        continue;
      } else {
        console.warn('[rate] Technique xy-wing returned eliminations, but all were already applied.');
      }
    }

    const xyzw = findXyzWing(board);
    if (xyzw != null) {
      const elims = adaptEliminations(xyzw.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('xyz-wing');
        continue;
      } else {
        console.warn('[rate] Technique xyz-wing returned eliminations, but all were already applied.');
      }
    }

    const ww = findWWing(board);
    if (ww != null) {
      const elims = adaptEliminations(ww.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('w-wing');
        continue;
      } else {
        console.warn('[rate] Technique w-wing returned eliminations, but all were already applied.');
      }
    }

    const sc = findSimpleColoring(board);
    if (sc != null) {
      const elims = adaptEliminations(sc.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('simple-coloring');
        continue;
      } else {
        console.warn('[rate] Technique simple-coloring returned eliminations, but all were already applied.');
      }
    }

    const xc = findXCycle(board);
    if (xc != null) {
      if (xc.placement != null) {
        noteTechnique('x-cycle');
        placeDigit(board, grid, xc.placement.pos, xc.placement.digit);
        continue;
      }
      const elims = adaptEliminations(xc.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('x-cycle');
        continue;
      } else {
        console.warn('[rate] Technique x-cycle returned eliminations, but all were already applied.');
      }
    }

    const er = findEmptyRectangle(board);
    if (er != null) {
      const elims = adaptEliminations(er.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('empty-rectangle');
        continue;
      } else {
        console.warn('[rate] Technique empty-rectangle returned eliminations, but all were already applied.');
      }
    }

    const sk = findSkyscraper(board);
    if (sk != null) {
      const elims = adaptEliminations(sk.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('skyscraper');
        continue;
      } else {
        console.warn('[rate] Technique skyscraper returned eliminations, but all were already applied.');
      }
    }

    const tsk = findTwoStringKite(board);
    if (tsk != null) {
      const elims = adaptEliminations(tsk.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('two-string-kite');
        continue;
      } else {
        console.warn('[rate] Technique two-string-kite returned eliminations, but all were already applied.');
      }
    }

    const ur = findUniqueRectangle(board);
    if (ur != null) {
      const elims = adaptEliminations(ur.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('unique-rectangle');
        continue;
      } else {
        console.warn('[rate] Technique unique-rectangle returned eliminations, but all were already applied.');
      }
    }

    const bug = findBugPlus1(board);
    if (bug != null) {
      noteTechnique('bug-plus-one');
      placeDigit(board, grid, bug.cell, bug.digit);
      continue;
    }

    const xyc = findXyChain(board);
    if (xyc != null) {
      const elims = adaptEliminations(xyc.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('xy-chain');
        continue;
      } else {
        console.warn('[rate] Technique xy-chain returned eliminations, but all were already applied.');
      }
    }

    const mc = findMultiColoring(board);
    if (mc != null) {
      const elims = adaptEliminations(mc.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('multi-coloring');
        continue;
      } else {
        console.warn('[rate] Technique multi-coloring returned eliminations, but all were already applied.');
      }
    }

    const alsxz = findAlsXz(board);
    if (alsxz != null) {
      const elims = adaptEliminations(alsxz.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('als-xz');
        continue;
      } else {
        console.warn('[rate] Technique als-xz returned eliminations, but all were already applied.');
      }
    }

    const wxyz = findWxyzWing(board);
    if (wxyz != null) {
      const elims = adaptEliminations(wxyz.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('wxyz-wing');
        continue;
      } else {
        console.warn('[rate] Technique wxyz-wing returned eliminations, but all were already applied.');
      }
    }

    const hr = findHiddenRectangle(board);
    if (hr != null) {
      const elims = adaptEliminations(hr.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('hidden-rectangle');
        continue;
      } else {
        console.warn('[rate] Technique hidden-rectangle returned eliminations, but all were already applied.');
      }
    }

    const ar = findAvoidableRectangle(board);
    if (ar != null) {
      const elims = adaptEliminations(ar.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('avoidable-rectangle');
        continue;
      } else {
        console.warn('[rate] Technique avoidable-rectangle returned eliminations, but all were already applied.');
      }
    }

    const nl = findNiceLoop(board);
    if (nl != null) {
      if (nl.placement != null) {
        noteTechnique('nice-loop');
        placeDigit(board, grid, nl.placement.pos, nl.placement.digit);
        continue;
      }
      const elims = adaptEliminations(nl.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('nice-loop');
        continue;
      } else {
        console.warn('[rate] Technique nice-loop returned eliminations, but all were already applied.');
      }
    }

    const gxc = findGroupedXCycle(board);
    if (gxc != null) {
      if (gxc.placement != null) {
        noteTechnique('grouped-x-cycle');
        placeDigit(board, grid, gxc.placement.pos, gxc.placement.digit);
        continue;
      }
      const elims = adaptEliminations(gxc.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('grouped-x-cycle');
        continue;
      } else {
        console.warn('[rate] Technique grouped-x-cycle returned eliminations, but all were already applied.');
      }
    }

    const med = find3DMedusa(board);
    if (med != null) {
      const elims = adaptEliminations(med.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('3d-medusa');
        continue;
      } else {
        console.warn('[rate] Technique 3d-medusa returned eliminations, but all were already applied.');
      }
    }

    const db = findDeathBlossom(board);
    if (db != null) {
      const elims = adaptEliminations(db.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('death-blossom');
        continue;
      } else {
        console.warn('[rate] Technique death-blossom returned eliminations, but all were already applied.');
      }
    }

    const fc = findForcingChains(board);
    if (fc != null) {
      if (fc.placement != null) {
        noteTechnique('forcing-chains');
        placeDigit(board, grid, fc.placement.pos, fc.placement.digit);
        continue;
      }
      const elims = adaptEliminations(fc.eliminations);
      if (applyEliminations(grid, elims)) {
        noteTechnique('forcing-chains');
        continue;
      } else {
        console.warn('[rate] Technique forcing-chains returned eliminations, but all were already applied.');
      }
    }

    // No technique made progress — stop.
    break;
  }

  const solved = isSolved(board);
  const difficulty: Difficulty = hardestTier;
  return {
    difficulty,
    hardestTechnique,
    techniquesUsed: [...used],
    solved,
    clueCount: countGivens(puzzle),
  };
}
