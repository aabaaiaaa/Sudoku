import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface XyChainElimination {
  cell: Position;
  digits: Digit[];
}

export interface XyChainLink {
  /** Cell in the chain. */
  pos: Position;
  /** The cell's two candidates, sorted ascending. */
  digits: [Digit, Digit];
}

export interface XyChainResult {
  technique: 'xy-chain';
  /** Sequence of bivalue cells from start to end. */
  chain: XyChainLink[];
  /** The shared starting and ending digit Z. */
  z: Digit;
  eliminations: XyChainElimination[];
  explanation: string;
}

const MIN_CHAIN_CELLS = 4;
const MAX_CHAIN_CELLS = 9;

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

interface BivalueCell {
  pos: Position;
  digits: [Digit, Digit];
}

function collectBivalueCells(
  grid: (Set<Digit> | null)[][],
  size: number,
): BivalueCell[] {
  const result: BivalueCell[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cand = grid[r][c];
      if (cand != null && cand.size === 2) {
        const sorted = [...cand].sort((a, b) => a - b);
        result.push({
          pos: { row: r, col: c },
          digits: [sorted[0], sorted[1]],
        });
      }
    }
  }
  return result;
}

function posKey(pos: Position): string {
  return `${pos.row},${pos.col}`;
}

function otherDigit(cell: BivalueCell, d: Digit): Digit {
  return cell.digits[0] === d ? cell.digits[1] : cell.digits[0];
}

function findChainEliminations(
  grid: (Set<Digit> | null)[][],
  variant: Variant,
  chain: BivalueCell[],
  z: Digit,
  size: number,
): XyChainElimination[] {
  const startPos = chain[0].pos;
  const endPos = chain[chain.length - 1].pos;
  const chainKeys = new Set(chain.map((c) => posKey(c.pos)));
  const eliminations: XyChainElimination[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const target: Position = { row: r, col: c };
      if (chainKeys.has(posKey(target))) continue;
      const cand = grid[r][c];
      if (cand == null || !cand.has(z)) continue;
      if (!sharesHouse(variant, target, startPos)) continue;
      if (!sharesHouse(variant, target, endPos)) continue;
      eliminations.push({ cell: target, digits: [z] });
    }
  }
  return eliminations;
}

function buildExplanation(_chain: BivalueCell[], z: Digit): string {
  return `XY-Chain: a chain of cells, each with only two possible numbers, links two ends. Both ends share ${z}. Any cell that sees both chain ends can't be ${z} — remove it.`;
}

interface SearchContext {
  bivalue: BivalueCell[];
  variant: Variant;
  grid: (Set<Digit> | null)[][];
  size: number;
  z: Digit;
}

/**
 * Depth-first search for an XY-Chain that yields at least one elimination.
 * Returns the first chain ≥ MIN_CHAIN_CELLS whose endpoints share a witness
 * cell carrying digit Z; returns null if no such chain exists from this start.
 */
function searchChain(
  ctx: SearchContext,
  chain: BivalueCell[],
  current: BivalueCell,
  outgoing: Digit,
  visited: Set<string>,
): { chain: BivalueCell[]; eliminations: XyChainElimination[] } | null {
  if (chain.length >= MAX_CHAIN_CELLS) return null;

  for (const next of ctx.bivalue) {
    const key = posKey(next.pos);
    if (visited.has(key)) continue;
    if (!sharesHouse(ctx.variant, current.pos, next.pos)) continue;
    if (next.digits[0] !== outgoing && next.digits[1] !== outgoing) continue;

    const nextOutgoing = otherDigit(next, outgoing);
    const newChain = [...chain, next];

    if (nextOutgoing === ctx.z && newChain.length >= MIN_CHAIN_CELLS) {
      const eliminations = findChainEliminations(
        ctx.grid,
        ctx.variant,
        newChain,
        ctx.z,
        ctx.size,
      );
      if (eliminations.length > 0) {
        return { chain: newChain, eliminations };
      }
    }

    visited.add(key);
    const found = searchChain(ctx, newChain, next, nextOutgoing, visited);
    visited.delete(key);
    if (found != null) return found;
  }

  return null;
}

/**
 * XY-Chain: an extension of XY-Wing to longer chains. A sequence of bivalue
 * cells C1, C2, ..., Cn (n ≥ 4) where consecutive cells share a house and a
 * candidate, and the chain starts and ends with the same digit Z. Each interior
 * step "consumes" one candidate of the previous cell and "produces" the other,
 * propagating an inference: either C1 = Z, or the chain forces Cn = Z. Either
 * way, one of the endpoints carries Z, so Z can be eliminated from any cell
 * that sees both endpoints.
 *
 * Length 3 chains are exactly XY-Wings and are filtered out here so this
 * technique handles only the strictly-longer cases — XY-Wing fires first in
 * the rater's technique chain.
 */
export function findXyChain(board: Board): XyChainResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);
  const bivalue = collectBivalueCells(grid, size);

  if (bivalue.length < MIN_CHAIN_CELLS) return null;

  for (const start of bivalue) {
    for (const z of start.digits) {
      const startOut = otherDigit(start, z);
      const visited = new Set<string>([posKey(start.pos)]);
      const ctx: SearchContext = { bivalue, variant, grid, size, z };
      const found = searchChain(ctx, [start], start, startOut, visited);
      if (found == null) continue;
      return {
        technique: 'xy-chain',
        chain: found.chain.map((c) => ({ pos: c.pos, digits: c.digits })),
        z,
        eliminations: found.eliminations,
        explanation: buildExplanation(found.chain, z),
      };
    }
  }

  return null;
}
