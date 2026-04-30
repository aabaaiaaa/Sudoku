import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface AlsXzElimination {
  cell: Position;
  digits: Digit[];
}

export interface Als {
  /** Cells of the ALS, in row-major order. */
  cells: Position[];
  /** Sorted candidates of the ALS — exactly cells.length + 1 distinct digits. */
  candidates: Digit[];
  /** Description of the house all cells share, e.g. "row 1" or "box 4". */
  house: string;
}

export interface AlsXzResult {
  technique: 'als-xz';
  /** First ALS, in row-major order. */
  alsA: Als;
  /** Second ALS, in row-major order. */
  alsB: Als;
  /** The restricted-common candidate. */
  x: Digit;
  /** The eliminated common candidate (Z ≠ X). */
  z: Digit;
  eliminations: AlsXzElimination[];
  explanation: string;
}

/** Maximum ALS size considered; ALS-XZ patterns rarely need larger sets. */
const MAX_ALS_CELLS = 4;

function computeCandidates(board: Board, pos: Position): Set<Digit> {
  const { variant, cells } = board;
  const used = new Set<Digit>();
  for (const p of peers(variant, pos)) {
    const v = cells[p.row][p.col].value;
    if (v != null) used.add(v);
  }
  const candidates = new Set<Digit>();
  for (const d of variant.digits) {
    if (!used.has(d)) candidates.add(d);
  }
  return candidates;
}

function buildCandidatesGrid(board: Board): (Set<Digit> | null)[][] {
  const { variant, cells } = board;
  const grid: (Set<Digit> | null)[][] = [];
  for (let r = 0; r < variant.size; r++) {
    const row: (Set<Digit> | null)[] = [];
    for (let c = 0; c < variant.size; c++) {
      if (cells[r][c].value != null) {
        row.push(null);
      } else {
        row.push(computeCandidates(board, { row: r, col: c }));
      }
    }
    grid.push(row);
  }
  return grid;
}

interface House {
  cells: Position[];
  description: string;
}

function buildHouses(variant: Variant): House[] {
  const houses: House[] = [];
  const size = variant.size;
  for (let r = 0; r < size; r++) {
    const cells: Position[] = [];
    for (let c = 0; c < size; c++) cells.push({ row: r, col: c });
    houses.push({ cells, description: `row ${r + 1}` });
  }
  for (let c = 0; c < size; c++) {
    const cells: Position[] = [];
    for (let r = 0; r < size; r++) cells.push({ row: r, col: c });
    houses.push({ cells, description: `column ${c + 1}` });
  }
  const boxesPerCol = Math.floor(size / variant.boxHeight);
  const boxesPerRow = Math.floor(size / variant.boxWidth);
  for (let bi = 0; bi < boxesPerCol; bi++) {
    for (let bj = 0; bj < boxesPerRow; bj++) {
      const cells: Position[] = [];
      for (let dr = 0; dr < variant.boxHeight; dr++) {
        for (let dc = 0; dc < variant.boxWidth; dc++) {
          cells.push({
            row: bi * variant.boxHeight + dr,
            col: bj * variant.boxWidth + dc,
          });
        }
      }
      houses.push({ cells, description: `box ${bi * boxesPerRow + bj + 1}` });
    }
  }
  return houses;
}

function sharesHouse(variant: Variant, a: Position, b: Position): boolean {
  if (a.row === b.row && a.col === b.col) return false;
  if (a.row === b.row) return true;
  if (a.col === b.col) return true;
  const aBoxRow = Math.floor(a.row / variant.boxHeight);
  const aBoxCol = Math.floor(a.col / variant.boxWidth);
  const bBoxRow = Math.floor(b.row / variant.boxHeight);
  const bBoxCol = Math.floor(b.col / variant.boxWidth);
  return aBoxRow === bBoxRow && aBoxCol === bBoxCol;
}

function posKey(p: Position): string {
  return `${p.row},${p.col}`;
}

function rowMajor(a: Position, b: Position): number {
  return a.row - b.row || a.col - b.col;
}

function cellLabel(p: Position): string {
  return `R${p.row + 1}C${p.col + 1}`;
}

function* combinations<T>(items: T[], k: number, start = 0, picked: T[] = []): Generator<T[]> {
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

/**
 * Enumerate every Almost Locked Set on the board.
 *
 * An ALS is N empty cells confined to a single house (row, column, or box) with
 * exactly N+1 distinct candidate digits across them. The same set of cells may
 * lie within more than one house (e.g. two cells that share a row and a box) —
 * each ALS is canonicalised by its sorted cell positions and emitted at most
 * once. ALSes are returned ordered by cell count ascending, then by their
 * lowest cell in row-major order; this gives ALS-XZ deterministic iteration.
 *
 * Sizes are capped at {@link MAX_ALS_CELLS} (4 by default). Larger ALSes exist
 * but are rare in ALS-XZ patterns and quickly explode the search.
 */
export function findAllAls(
  board: Board,
  maxCells: number = MAX_ALS_CELLS,
): Als[] {
  const { variant } = board;
  const grid = buildCandidatesGrid(board);
  const houses = buildHouses(variant);
  const found: Als[] = [];
  const seen = new Set<string>();

  for (const house of houses) {
    const empties: Position[] = [];
    for (const cell of house.cells) {
      if (grid[cell.row][cell.col] != null) empties.push(cell);
    }
    if (empties.length === 0) continue;

    const cap = Math.min(maxCells, empties.length - 1);
    for (let n = 1; n <= cap; n++) {
      for (const subset of combinations(empties, n)) {
        const cands = new Set<Digit>();
        for (const cell of subset) {
          for (const d of grid[cell.row][cell.col]!) cands.add(d);
        }
        if (cands.size !== n + 1) continue;

        const sorted = [...subset].sort(rowMajor);
        const key = sorted.map(posKey).join('|');
        if (seen.has(key)) continue;
        seen.add(key);

        found.push({
          cells: sorted,
          candidates: [...cands].sort((a, b) => a - b),
          house: house.description,
        });
      }
    }
  }

  found.sort((a, b) => {
    if (a.cells.length !== b.cells.length) return a.cells.length - b.cells.length;
    return rowMajor(a.cells[0], b.cells[0]);
  });

  return found;
}

function cellsOverlap(a: Position[], b: Position[]): boolean {
  const keys = new Set(a.map(posKey));
  return b.some((p) => keys.has(posKey(p)));
}

function cellsWithDigit(
  cells: Position[],
  digit: Digit,
  grid: (Set<Digit> | null)[][],
): Position[] {
  return cells.filter((p) => grid[p.row][p.col]!.has(digit));
}

function isRestrictedCommon(
  variant: Variant,
  xCellsA: Position[],
  xCellsB: Position[],
): boolean {
  if (xCellsA.length === 0 || xCellsB.length === 0) return false;
  for (const ca of xCellsA) {
    for (const cb of xCellsB) {
      if (!sharesHouse(variant, ca, cb)) return false;
    }
  }
  return true;
}

/**
 * ALS-XZ: two disjoint Almost Locked Sets A and B sharing a *restricted
 * common* candidate X — one for which every X-candidate cell of A sees every
 * X-candidate cell of B, so the two ALSes cannot both place X. Either A is
 * "locked out of X" (becoming a true Locked Set whose remaining candidates are
 * fixed in its cells) or B is. For any other common candidate Z ≠ X this means
 * Z must end up in either A or B, so any cell outside A ∪ B that sees every
 * Z-candidate cell in A and every Z-candidate cell in B cannot itself contain
 * Z and Z is eliminated from it.
 *
 * Iteration is deterministic: ALSes ordered by size then row-major lowest
 * cell; ALS pairs by index (i &lt; j); restricted-common digits ascending; Z
 * digits ascending. The first pair/X/Z combination yielding ≥1 elimination is
 * returned.
 */
export function findAlsXz(board: Board): AlsXzResult | null {
  const { variant } = board;
  const grid = buildCandidatesGrid(board);
  const allAls = findAllAls(board);

  for (let i = 0; i < allAls.length; i++) {
    const a = allAls[i];
    for (let j = i + 1; j < allAls.length; j++) {
      const b = allAls[j];
      if (cellsOverlap(a.cells, b.cells)) continue;

      const aCands = new Set(a.candidates);
      const common: Digit[] = b.candidates.filter((d) => aCands.has(d));
      if (common.length < 2) continue;

      // Pre-compute X-cells for each candidate to avoid repeat work.
      const xCellsA = new Map<Digit, Position[]>();
      const xCellsB = new Map<Digit, Position[]>();
      for (const d of common) {
        xCellsA.set(d, cellsWithDigit(a.cells, d, grid));
        xCellsB.set(d, cellsWithDigit(b.cells, d, grid));
      }

      const restrictedCommon: Digit[] = [];
      for (const d of common) {
        if (isRestrictedCommon(variant, xCellsA.get(d)!, xCellsB.get(d)!)) {
          restrictedCommon.push(d);
        }
      }
      if (restrictedCommon.length === 0) continue;

      const aKeys = new Set(a.cells.map(posKey));
      const bKeys = new Set(b.cells.map(posKey));

      for (const x of restrictedCommon) {
        for (const z of common) {
          if (z === x) continue;

          const zA = xCellsA.get(z)!;
          const zB = xCellsB.get(z)!;
          if (zA.length === 0 || zB.length === 0) continue;

          const eliminations: AlsXzElimination[] = [];
          for (let r = 0; r < variant.size; r++) {
            for (let c = 0; c < variant.size; c++) {
              const target: Position = { row: r, col: c };
              const tk = posKey(target);
              if (aKeys.has(tk) || bKeys.has(tk)) continue;
              const cand = grid[r][c];
              if (cand == null || !cand.has(z)) continue;
              if (!zA.every((p) => sharesHouse(variant, target, p))) continue;
              if (!zB.every((p) => sharesHouse(variant, target, p))) continue;
              eliminations.push({ cell: target, digits: [z] });
            }
          }
          if (eliminations.length === 0) continue;

          return {
            technique: 'als-xz',
            alsA: a,
            alsB: b,
            x,
            z,
            eliminations,
            explanation: `ALS-XZ: two small groups of cells in ${a.house} and ${b.house} almost nail down their numbers. They share ${x}, so one group must hold ${z}. You can remove ${z} from any cell that sees both groups.`,
          };
        }
      }
    }
  }

  return null;
}
