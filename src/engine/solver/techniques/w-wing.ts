import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface WWingElimination {
  cell: Position;
  digits: Digit[];
}

export interface WWingResult {
  technique: 'w-wing';
  /** The two bivalue cells, in row-major order. Each is {X, Y}. */
  bivalues: [Position, Position];
  /** The shared bivalue digits, sorted ascending. */
  bivalueDigits: [Digit, Digit];
  /** The digit eliminated from witness cells. */
  x: Digit;
  /** The strong-link digit. */
  y: Digit;
  /** The two cells of the strong link on Y, in row-major order. */
  strongLink: [Position, Position];
  /** Plain-language description of the house containing the strong link. */
  strongLinkHouse: string;
  eliminations: WWingElimination[];
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

/**
 * W-Wing: two bivalue cells with the same candidate set {X, Y}, connected by a
 * strong link on Y. The strong link is a house where Y appears in exactly two
 * cells; one of those cells sees the first bivalue cell and the other sees the
 * second. Whichever end of the strong link holds Y, it forces the bivalue
 * cell it sees to be X — so X can be eliminated from any cell that sees both
 * bivalue cells.
 *
 * Returns the first pattern found, iterating bivalue pairs in row-major order,
 * then choice of (X, Y), then houses (rows, columns, boxes).
 */
export function findWWing(board: Board): WWingResult | null {
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

  const houses = buildHouses(variant);

  for (let i = 0; i < bivalue.length; i++) {
    const A = bivalue[i];
    for (let j = i + 1; j < bivalue.length; j++) {
      const B = bivalue[j];
      if (A.digits[0] !== B.digits[0] || A.digits[1] !== B.digits[1]) continue;

      const [d0, d1] = A.digits;
      const tries: Array<{ x: Digit; y: Digit }> = [
        { x: d0, y: d1 },
        { x: d1, y: d0 },
      ];

      for (const { x, y } of tries) {
        for (const house of houses) {
          const yCells: Position[] = [];
          for (const cell of house.cells) {
            const cand = grid[cell.row][cell.col];
            if (cand != null && cand.has(y)) yCells.push(cell);
          }
          if (yCells.length !== 2) continue;

          const [c1, c2] = yCells;
          const isAorB = (p: Position): boolean =>
            (p.row === A.pos.row && p.col === A.pos.col) ||
            (p.row === B.pos.row && p.col === B.pos.col);
          if (isAorB(c1) || isAorB(c2)) continue;

          const c1A = sharesHouse(variant, c1, A.pos);
          const c1B = sharesHouse(variant, c1, B.pos);
          const c2A = sharesHouse(variant, c2, A.pos);
          const c2B = sharesHouse(variant, c2, B.pos);

          if (!((c1A && c2B) || (c1B && c2A))) continue;

          const eliminations: WWingElimination[] = [];
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              if (r === A.pos.row && c === A.pos.col) continue;
              if (r === B.pos.row && c === B.pos.col) continue;
              const cand = grid[r][c];
              if (cand == null) continue;
              if (!cand.has(x)) continue;
              const target: Position = { row: r, col: c };
              if (!sharesHouse(variant, target, A.pos)) continue;
              if (!sharesHouse(variant, target, B.pos)) continue;
              eliminations.push({ cell: target, digits: [x] });
            }
          }
          if (eliminations.length === 0) continue;

          const orderedStrongLink: [Position, Position] =
            c1.row < c2.row || (c1.row === c2.row && c1.col < c2.col)
              ? [c1, c2]
              : [c2, c1];

          return {
            technique: 'w-wing',
            bivalues: [A.pos, B.pos],
            bivalueDigits: [d0, d1],
            x,
            y,
            strongLink: orderedStrongLink,
            strongLinkHouse: house.description,
            eliminations,
            explanation: `When two cells can each only be ${d0} or ${d1}, and ${y} can only go in two places in a shared row, column, or box, any cell that can see both of those first cells cannot be ${x}.`,
          };
        }
      }
    }
  }

  return null;
}
