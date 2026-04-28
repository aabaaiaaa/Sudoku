import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface WxyzWingElimination {
  cell: Position;
  digits: Digit[];
}

export interface WxyzWingResult {
  technique: 'wxyz-wing';
  /** The four-candidate hinge cell. Its candidates are exactly W, X, Y, Z. */
  hinge: Position;
  /** The hinge digits, sorted ascending. The shared digit is `z`. */
  hingeDigits: [Digit, Digit, Digit, Digit];
  /**
   * The three pincer cells, in row-major order. Each is bivalue and shares a
   * house with the hinge.
   */
  pincers: [Position, Position, Position];
  /** The shared candidate present in the hinge and every pincer. */
  z: Digit;
  eliminations: WxyzWingElimination[];
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

function rowMajor(a: Position, b: Position): number {
  return a.row - b.row || a.col - b.col;
}

interface BivalueCell {
  pos: Position;
  digits: [Digit, Digit];
}

interface QuadvalueCell {
  pos: Position;
  digits: [Digit, Digit, Digit, Digit];
}

/**
 * WXYZ-Wing: a four-candidate hinge {W, X, Y, Z} together with three bivalue
 * pincers {W, Z}, {X, Z} and {Y, Z}, where each pincer shares a house with
 * the hinge. Whichever of the four candidates the hinge resolves to,
 * exactly one of the four cells must hold Z, so Z can be eliminated from any
 * cell that sees the hinge AND all three pincers.
 *
 * Returns the first pattern found (in row-major order over hinge, then each
 * Z choice in ascending order, then each compatible triple of pincers in
 * row-major order) whose eliminations are non-empty.
 */
export function findWxyzWing(board: Board): WxyzWingResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);

  const bivalue: BivalueCell[] = [];
  const quadvalue: QuadvalueCell[] = [];
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
      } else if (cand.size === 4) {
        const sorted = [...cand].sort((a, b) => a - b);
        quadvalue.push({
          pos: { row: r, col: c },
          digits: [sorted[0], sorted[1], sorted[2], sorted[3]],
        });
      }
    }
  }

  for (const hinge of quadvalue) {
    const [d0, d1, d2, d3] = hinge.digits;

    for (const z of hinge.digits) {
      const others: Digit[] = hinge.digits.filter((d) => d !== z);

      const pincerCandidates: BivalueCell[][] = others.map((other) => {
        const lo = other < z ? other : z;
        const hi = other < z ? z : other;
        return bivalue.filter(
          (b) =>
            b.digits[0] === lo &&
            b.digits[1] === hi &&
            sharesHouse(variant, b.pos, hinge.pos),
        );
      });

      if (pincerCandidates.some((arr) => arr.length === 0)) continue;

      for (const pa of pincerCandidates[0]) {
        for (const pb of pincerCandidates[1]) {
          if (pa.pos.row === pb.pos.row && pa.pos.col === pb.pos.col) continue;
          for (const pc of pincerCandidates[2]) {
            if (pc.pos.row === pa.pos.row && pc.pos.col === pa.pos.col) continue;
            if (pc.pos.row === pb.pos.row && pc.pos.col === pb.pos.col) continue;

            const wxyzPositions: Position[] = [
              hinge.pos,
              pa.pos,
              pb.pos,
              pc.pos,
            ];

            const eliminations: WxyzWingElimination[] = [];
            for (let r = 0; r < size; r++) {
              for (let c = 0; c < size; c++) {
                if (
                  wxyzPositions.some((p) => p.row === r && p.col === c)
                ) {
                  continue;
                }
                const cand = grid[r][c];
                if (cand == null || !cand.has(z)) continue;
                const target: Position = { row: r, col: c };
                if (
                  !wxyzPositions.every((p) => sharesHouse(variant, target, p))
                ) {
                  continue;
                }
                eliminations.push({ cell: target, digits: [z] });
              }
            }
            if (eliminations.length === 0) continue;

            const sortedPincers = [pa.pos, pb.pos, pc.pos].sort(rowMajor);
            const orderedPincers: [Position, Position, Position] = [
              sortedPincers[0],
              sortedPincers[1],
              sortedPincers[2],
            ];

            return {
              technique: 'wxyz-wing',
              hinge: hinge.pos,
              hingeDigits: [d0, d1, d2, d3],
              pincers: orderedPincers,
              z,
              eliminations,
              explanation: `WXYZ-wing: hinge R${hinge.pos.row + 1}C${hinge.pos.col + 1} {${d0},${d1},${d2},${d3}} with pincers R${orderedPincers[0].row + 1}C${orderedPincers[0].col + 1}, R${orderedPincers[1].row + 1}C${orderedPincers[1].col + 1} and R${orderedPincers[2].row + 1}C${orderedPincers[2].col + 1} sharing ${z}; eliminate ${z} from cells seeing all four`,
            };
          }
        }
      }
    }
  }

  return null;
}
