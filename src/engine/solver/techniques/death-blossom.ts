import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';
import { findAllAls, type Als } from './als-xz';

export interface DeathBlossomElimination {
  cell: Position;
  digits: Digit[];
}

export interface DeathBlossomPetal {
  /** The stem candidate this petal is "linked" to. */
  stemDigit: Digit;
  /**
   * The petal ALS. `stemDigit` is its restricted-common with the stem cell —
   * every cell in the ALS that holds `stemDigit` is a peer of the stem.
   */
  als: Als;
}

export interface DeathBlossomResult {
  technique: 'death-blossom';
  /** The stem cell. Each of its candidate digits is linked to one petal. */
  stem: Position;
  /** Stem candidates, sorted ascending. */
  stemDigits: Digit[];
  /** One petal per stem digit, listed in stem-digit ascending order. */
  petals: DeathBlossomPetal[];
  /** The forced digit Z — present in every petal, absent from the stem. */
  z: Digit;
  eliminations: DeathBlossomElimination[];
  explanation: string;
}

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

function cellLabel(p: Position): string {
  return `R${p.row + 1}C${p.col + 1}`;
}

function cellsContain(cells: Position[], pos: Position): boolean {
  return cells.some((c) => c.row === pos.row && c.col === pos.col);
}

function cellsWithDigit(
  cells: Position[],
  digit: Digit,
  grid: (Set<Digit> | null)[][],
): Position[] {
  const result: Position[] = [];
  for (const c of cells) {
    const cands = grid[c.row][c.col];
    if (cands != null && cands.has(digit)) result.push(c);
  }
  return result;
}

interface SearchContext {
  variant: Variant;
  grid: (Set<Digit> | null)[][];
  stem: Position;
  stemDigits: Digit[];
  petalOptions: Als[][];
}

function tryFinalize(
  ctx: SearchContext,
  petals: Als[],
): DeathBlossomResult | null {
  const { variant, grid, stem, stemDigits } = ctx;

  // Z must appear in every petal but not in the stem.
  let zSet = new Set<Digit>(petals[0].candidates);
  for (let i = 1; i < petals.length; i++) {
    const candSet = new Set(petals[i].candidates);
    zSet = new Set([...zSet].filter((d) => candSet.has(d)));
  }
  for (const d of stemDigits) zSet.delete(d);
  if (zSet.size === 0) return null;

  const stemKey = posKey(stem);
  const petalKeys = new Set<string>();
  for (const p of petals) for (const c of p.cells) petalKeys.add(posKey(c));

  const sortedZ = [...zSet].sort((a, b) => a - b);
  for (const z of sortedZ) {
    const zCells: Position[] = [];
    for (const p of petals) {
      for (const c of p.cells) {
        if (grid[c.row][c.col]!.has(z)) zCells.push(c);
      }
    }
    if (zCells.length === 0) continue;

    const eliminations: DeathBlossomElimination[] = [];
    for (let r = 0; r < variant.size; r++) {
      for (let c = 0; c < variant.size; c++) {
        const target: Position = { row: r, col: c };
        const tk = posKey(target);
        if (tk === stemKey) continue;
        if (petalKeys.has(tk)) continue;
        const cands = grid[r][c];
        if (cands == null || !cands.has(z)) continue;
        if (!zCells.every((p) => sharesHouse(variant, target, p))) continue;
        eliminations.push({ cell: target, digits: [z] });
      }
    }
    if (eliminations.length === 0) continue;

    const petalsResult: DeathBlossomPetal[] = stemDigits.map((sd, i) => ({
      stemDigit: sd,
      als: petals[i],
    }));

    return {
      technique: 'death-blossom',
      stem,
      stemDigits,
      petals: petalsResult,
      z,
      eliminations,
      explanation: `Death Blossom: a central cell pairs with a small group for each of its choices. Every group must contain ${z}, so you can remove ${z} from any cell that sees all those groups.`,
    };
  }
  return null;
}

function searchPetals(
  ctx: SearchContext,
  picked: Als[],
  pickedKeys: Set<string>,
  digitIdx: number,
): DeathBlossomResult | null {
  if (digitIdx === ctx.stemDigits.length) {
    return tryFinalize(ctx, picked);
  }
  for (const als of ctx.petalOptions[digitIdx]) {
    if (als.cells.some((c) => pickedKeys.has(posKey(c)))) continue;
    picked[digitIdx] = als;
    for (const c of als.cells) pickedKeys.add(posKey(c));
    const result = searchPetals(ctx, picked, pickedKeys, digitIdx + 1);
    if (result !== null) return result;
    for (const c of als.cells) pickedKeys.delete(posKey(c));
  }
  return null;
}

/**
 * Death Blossom:
 *   - A "stem" cell with N candidates {d1, ..., dN}.
 *   - For each stem candidate dk, a "petal" Almost Locked Set Pk such that:
 *       • Pk does not include the stem cell;
 *       • every cell of Pk that holds dk is a peer of the stem (so placing
 *         dk in the stem strips dk from Pk, locking the rest of Pk).
 *   - The N petals occupy pairwise-disjoint cell sets.
 *   - There exists a digit Z that is a candidate of every petal but is NOT a
 *     candidate of the stem. Whichever digit the stem ends up taking, the
 *     matching petal becomes a true locked set whose remaining candidates —
 *     including Z — are pinned to its cells. So Z must appear somewhere in
 *     the union of the petals' Z-candidate cells. Any cell outside the stem
 *     and the petals that sees every Z-candidate cell across every petal
 *     therefore cannot itself be Z.
 *
 * Petals are detected by reusing {@link findAllAls}, which returns ALSes
 * ordered by cell-count then row-major lowest cell. The search is
 * deterministic:
 *   - stems iterated row-major;
 *   - stem candidates ascending;
 *   - per-digit petals iterated in `findAllAls` order;
 *   - Z digits ascending.
 * The first combination yielding ≥1 elimination wins.
 */
export function findDeathBlossom(board: Board): DeathBlossomResult | null {
  const { variant } = board;
  const grid = buildCandidatesGrid(board);
  const allAls = findAllAls(board);

  const alsesByDigit = new Map<Digit, Als[]>();
  for (const als of allAls) {
    for (const d of als.candidates) {
      let bucket = alsesByDigit.get(d);
      if (bucket === undefined) {
        bucket = [];
        alsesByDigit.set(d, bucket);
      }
      bucket.push(als);
    }
  }

  for (let sr = 0; sr < variant.size; sr++) {
    for (let sc = 0; sc < variant.size; sc++) {
      const stem: Position = { row: sr, col: sc };
      const stemCands = grid[sr][sc];
      if (stemCands == null || stemCands.size < 2) continue;
      const stemDigits = [...stemCands].sort((a, b) => a - b);

      const petalOptions: Als[][] = [];
      let feasible = true;
      for (const dk of stemDigits) {
        const options: Als[] = [];
        const bucket = alsesByDigit.get(dk) ?? [];
        for (const als of bucket) {
          if (cellsContain(als.cells, stem)) continue;
          const dkCells = cellsWithDigit(als.cells, dk, grid);
          if (dkCells.length === 0) continue;
          if (dkCells.every((c) => sharesHouse(variant, c, stem))) {
            options.push(als);
          }
        }
        if (options.length === 0) {
          feasible = false;
          break;
        }
        petalOptions.push(options);
      }
      if (!feasible) continue;

      const ctx: SearchContext = {
        variant,
        grid,
        stem,
        stemDigits,
        petalOptions,
      };
      const result = searchPetals(
        ctx,
        new Array<Als>(stemDigits.length),
        new Set<string>(),
        0,
      );
      if (result !== null) return result;
    }
  }

  return null;
}
