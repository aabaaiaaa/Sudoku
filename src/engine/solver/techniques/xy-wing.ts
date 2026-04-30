import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface XYWingElimination {
  cell: Position;
  digits: Digit[];
}

export interface XYWingResult {
  technique: 'xy-wing';
  /** The bivalue cell whose two candidates are X and Y. */
  pivot: Position;
  /** The two pincer cells, in row-major order. Each is bivalue. */
  pincers: [Position, Position];
  /** The two pivot digits, sorted ascending — pincers carry one each plus Z. */
  pivotDigits: [Digit, Digit];
  /** The shared candidate at both pincers — eliminated from witnesses. */
  z: Digit;
  eliminations: XYWingElimination[];
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

interface BivalueCell {
  pos: Position;
  digits: [Digit, Digit];
}

/**
 * XY-Wing: a bivalue pivot {X, Y} and two bivalue pincers {X, Z} and {Y, Z}
 * where each pincer shares a house with the pivot but the two pincers do not
 * share a house with each other. Whichever digit the pivot resolves to, one of
 * the pincers must be Z, so Z can be eliminated from any cell that sees both
 * pincers.
 *
 * Returns the first pattern found (in row-major order over pivot, then pincer1,
 * then pincer2) whose eliminations are non-empty.
 */
export function findXyWing(board: Board): XYWingResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);

  const bivalue: BivalueCell[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cand = grid[r][c];
      if (cand != null && cand.size === 2) {
        const sorted = [...cand].sort((a, b) => a - b);
        bivalue.push({
          pos: { row: r, col: c },
          digits: [sorted[0], sorted[1]],
        });
      }
    }
  }

  for (const pivot of bivalue) {
    const [X, Y] = pivot.digits;

    for (let i = 0; i < bivalue.length; i++) {
      const pincer1 = bivalue[i];
      if (pincer1.pos.row === pivot.pos.row && pincer1.pos.col === pivot.pos.col) continue;
      if (!sharesHouse(variant, pincer1.pos, pivot.pos)) continue;

      const [a, b] = pincer1.digits;
      let shared: Digit;
      let z: Digit;
      if (a === X && b !== Y) {
        shared = X;
        z = b;
      } else if (b === X && a !== Y) {
        shared = X;
        z = a;
      } else if (a === Y && b !== X) {
        shared = Y;
        z = b;
      } else if (b === Y && a !== X) {
        shared = Y;
        z = a;
      } else {
        continue;
      }

      const otherPivotDigit = shared === X ? Y : X;

      for (let j = i + 1; j < bivalue.length; j++) {
        const pincer2 = bivalue[j];
        if (pincer2.pos.row === pivot.pos.row && pincer2.pos.col === pivot.pos.col) continue;
        if (!sharesHouse(variant, pincer2.pos, pivot.pos)) continue;
        if (sharesHouse(variant, pincer1.pos, pincer2.pos)) continue;

        const [pa, pb] = pincer2.digits;
        const pincer2Matches =
          (pa === otherPivotDigit && pb === z) ||
          (pb === otherPivotDigit && pa === z);
        if (!pincer2Matches) continue;

        const eliminations: XYWingElimination[] = [];
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (r === pivot.pos.row && c === pivot.pos.col) continue;
            if (r === pincer1.pos.row && c === pincer1.pos.col) continue;
            if (r === pincer2.pos.row && c === pincer2.pos.col) continue;
            const cand = grid[r][c];
            if (cand == null) continue;
            if (!cand.has(z)) continue;
            const target: Position = { row: r, col: c };
            if (!sharesHouse(variant, target, pincer1.pos)) continue;
            if (!sharesHouse(variant, target, pincer2.pos)) continue;
            eliminations.push({ cell: target, digits: [z] });
          }
        }
        if (eliminations.length === 0) continue;

        return {
          technique: 'xy-wing',
          pivot: pivot.pos,
          pincers: [pincer1.pos, pincer2.pos],
          pivotDigits: [X, Y],
          z,
          eliminations,
          explanation: `When a pivot holds only ${X} and ${Y}, and two pincers each share ${z} with it, any cell that sees both pincers cannot be ${z}.`,
        };
      }
    }
  }

  return null;
}
