import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface XYZWingElimination {
  cell: Position;
  digits: Digit[];
}

export interface XYZWingResult {
  technique: 'xyz-wing';
  /** The trivalue pivot whose three candidates are X, Y, and Z. */
  pivot: Position;
  /** The pivot digits, sorted ascending. The shared digit is `z`. */
  pivotDigits: [Digit, Digit, Digit];
  /** The two pincer cells, in row-major order. Each is bivalue. */
  pincers: [Position, Position];
  /** The shared candidate present in pivot and both pincers. */
  z: Digit;
  eliminations: XYZWingElimination[];
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

interface TrivalueCell {
  pos: Position;
  digits: [Digit, Digit, Digit];
}

/**
 * XYZ-Wing: a trivalue pivot {X, Y, Z} together with two bivalue pincers
 * {X, Z} and {Y, Z}, where each pincer shares a house with the pivot.
 * Whichever of the three candidates the pivot resolves to, exactly one of
 * the three cells must be Z, so Z can be eliminated from any cell that
 * sees the pivot AND both pincers.
 *
 * Returns the first pattern found (in row-major order over pivot, then
 * each Z choice in ascending order, then pincer1 and pincer2 in row-major
 * order) whose eliminations are non-empty.
 */
export function findXyzWing(board: Board): XYZWingResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);

  const bivalue: BivalueCell[] = [];
  const trivalue: TrivalueCell[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cand = grid[r][c];
      if (cand == null) continue;
      if (cand.size === 2) {
        const sorted = [...cand].sort((a, b) => a - b);
        bivalue.push({
          pos: { row: r, col: c },
          digits: [sorted[0], sorted[1]],
        });
      } else if (cand.size === 3) {
        const sorted = [...cand].sort((a, b) => a - b);
        trivalue.push({
          pos: { row: r, col: c },
          digits: [sorted[0], sorted[1], sorted[2]],
        });
      }
    }
  }

  for (const pivot of trivalue) {
    const [d0, d1, d2] = pivot.digits;
    const zChoices: Array<{ z: Digit; x: Digit; y: Digit }> = [
      { z: d0, x: d1, y: d2 },
      { z: d1, x: d0, y: d2 },
      { z: d2, x: d0, y: d1 },
    ];

    for (const { z, x, y } of zChoices) {
      const xz: [Digit, Digit] = x < z ? [x, z] : [z, x];
      const yz: [Digit, Digit] = y < z ? [y, z] : [z, y];

      for (const pincer1 of bivalue) {
        if (pincer1.digits[0] !== xz[0] || pincer1.digits[1] !== xz[1]) continue;
        if (!sharesHouse(variant, pincer1.pos, pivot.pos)) continue;

        for (const pincer2 of bivalue) {
          if (pincer2.digits[0] !== yz[0] || pincer2.digits[1] !== yz[1]) continue;
          if (
            pincer2.pos.row === pincer1.pos.row &&
            pincer2.pos.col === pincer1.pos.col
          ) {
            continue;
          }
          if (!sharesHouse(variant, pincer2.pos, pivot.pos)) continue;

          const eliminations: XYZWingElimination[] = [];
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              if (r === pivot.pos.row && c === pivot.pos.col) continue;
              if (r === pincer1.pos.row && c === pincer1.pos.col) continue;
              if (r === pincer2.pos.row && c === pincer2.pos.col) continue;
              const cand = grid[r][c];
              if (cand == null) continue;
              if (!cand.has(z)) continue;
              const target: Position = { row: r, col: c };
              if (!sharesHouse(variant, target, pivot.pos)) continue;
              if (!sharesHouse(variant, target, pincer1.pos)) continue;
              if (!sharesHouse(variant, target, pincer2.pos)) continue;
              eliminations.push({ cell: target, digits: [z] });
            }
          }
          if (eliminations.length === 0) continue;

          const orderedPincers: [Position, Position] =
            pincer1.pos.row < pincer2.pos.row ||
            (pincer1.pos.row === pincer2.pos.row &&
              pincer1.pos.col < pincer2.pos.col)
              ? [pincer1.pos, pincer2.pos]
              : [pincer2.pos, pincer1.pos];

          return {
            technique: 'xyz-wing',
            pivot: pivot.pos,
            pivotDigits: [d0, d1, d2],
            pincers: orderedPincers,
            z,
            eliminations,
            explanation: `XYZ-wing: pivot R${pivot.pos.row + 1}C${pivot.pos.col + 1} {${d0},${d1},${d2}} with pincers R${orderedPincers[0].row + 1}C${orderedPincers[0].col + 1} and R${orderedPincers[1].row + 1}C${orderedPincers[1].col + 1} sharing ${z}; eliminate ${z} from cells seeing pivot and both pincers`,
          };
        }
      }
    }
  }

  return null;
}
