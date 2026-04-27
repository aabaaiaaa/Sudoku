import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface UniqueRectangleElimination {
  cell: Position;
  digits: Digit[];
}

export type UniqueRectangleType = 1 | 2 | 4;

export type UniqueRectangleSharedHouse = 'row' | 'col' | 'box';

export interface UniqueRectangleResult {
  technique: 'unique-rectangle';
  type: UniqueRectangleType;
  /** The two shared candidates {X, Y}, sorted ascending. */
  digits: [Digit, Digit];
  /** All four corner cells, sorted (row-major). */
  corners: [Position, Position, Position, Position];
  /** Cells with candidates exactly {X, Y}. */
  floorCells: Position[];
  /** Cells with extra candidates beyond {X, Y}. */
  roofCells: Position[];
  /** Type 2 only: the extra candidate Z shared by both roof cells. */
  extraDigit?: Digit;
  /** Type 4 only: the digit confined to the roof cells in the shared house. */
  confinedDigit?: Digit;
  /** Type 4 only: which house the roof cells share for the confinement. */
  sharedHouse?: UniqueRectangleSharedHouse;
  eliminations: UniqueRectangleElimination[];
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

function sameBox(variant: Variant, a: Position, b: Position): boolean {
  return (
    Math.floor(a.row / variant.boxHeight) ===
      Math.floor(b.row / variant.boxHeight) &&
    Math.floor(a.col / variant.boxWidth) ===
      Math.floor(b.col / variant.boxWidth)
  );
}

function sharesHouse(variant: Variant, a: Position, b: Position): boolean {
  if (a.row === b.row && a.col === b.col) return false;
  if (a.row === b.row) return true;
  if (a.col === b.col) return true;
  return sameBox(variant, a, b);
}

function rectangleSpansTwoBoxes(
  variant: Variant,
  r1: number,
  r2: number,
  c1: number,
  c2: number,
): boolean {
  const sameBand =
    Math.floor(r1 / variant.boxHeight) === Math.floor(r2 / variant.boxHeight);
  const sameStack =
    Math.floor(c1 / variant.boxWidth) === Math.floor(c2 / variant.boxWidth);
  return sameBand !== sameStack;
}

interface CornerInfo {
  pos: Position;
  candidates: Set<Digit>;
  /** True iff candidates are exactly {X, Y}. */
  bivalue: boolean;
  /** Candidates other than X and Y. */
  extras: Digit[];
}

/**
 * Unique Rectangle (Types 1, 2, 4).
 *
 * Four cells at the corners of a rectangle that span exactly two boxes form a
 * "deadly pattern" if all four cells reduce to the same two candidates {X, Y}:
 * the puzzle would have two solutions (swap X and Y at the four corners).
 * Any uniquely-solvable puzzle therefore cannot reach that configuration, so
 * if three corners are bivalue {X, Y} and the fourth has extras (Type 1), or
 * two adjacent corners are bivalue and the other two share an additional
 * structure (Types 2 and 4), we can make eliminations that prevent the
 * deadly pattern.
 *
 *   Type 1: three corners are exactly {X, Y}; the fourth has extras. The
 *     fourth corner cannot be X or Y — eliminate both.
 *   Type 2: two corners are exactly {X, Y}; the other two (sharing a row or
 *     column) each carry the same single extra Z. At least one roof must be
 *     Z, so cells seeing both roofs cannot be Z.
 *   Type 4: two corners are exactly {X, Y}; the other two (the roofs) share
 *     a house in which one of {X, Y} is confined to those two cells. The
 *     other digit must be eliminated from both roofs.
 *
 * Iteration: digit pairs (X, Y) ascending, then (r1, r2) ascending, then
 * (c1, c2) ascending. Within a rectangle, types are tried in order 1, 2, 4
 * and the first non-empty result wins.
 */
export function findUniqueRectangle(
  board: Board,
): UniqueRectangleResult | null {
  const { variant } = board;
  const size = variant.size;
  const grid = buildCandidatesGrid(board);
  const digits = variant.digits;

  for (let xi = 0; xi < digits.length; xi++) {
    const X = digits[xi];
    for (let yi = xi + 1; yi < digits.length; yi++) {
      const Y = digits[yi];

      for (let r1 = 0; r1 < size - 1; r1++) {
        for (let r2 = r1 + 1; r2 < size; r2++) {
          for (let c1 = 0; c1 < size - 1; c1++) {
            for (let c2 = c1 + 1; c2 < size; c2++) {
              if (!rectangleSpansTwoBoxes(variant, r1, r2, c1, c2)) continue;

              const positions: Position[] = [
                { row: r1, col: c1 },
                { row: r1, col: c2 },
                { row: r2, col: c1 },
                { row: r2, col: c2 },
              ];
              const corners: CornerInfo[] = [];
              let valid = true;
              for (const pos of positions) {
                const cand = grid[pos.row][pos.col];
                if (cand == null || !cand.has(X) || !cand.has(Y)) {
                  valid = false;
                  break;
                }
                const extras: Digit[] = [];
                for (const d of cand) {
                  if (d !== X && d !== Y) extras.push(d);
                }
                corners.push({
                  pos,
                  candidates: cand,
                  bivalue: extras.length === 0,
                  extras,
                });
              }
              if (!valid) continue;

              const result =
                tryType1(corners, X, Y) ??
                tryType2(grid, variant, corners, X, Y) ??
                tryType4(grid, variant, corners, X, Y);
              if (result !== null) return result;
            }
          }
        }
      }
    }
  }

  return null;
}

function buildResultBase(corners: CornerInfo[]): {
  cornerPositions: [Position, Position, Position, Position];
  floor: Position[];
  roof: Position[];
} {
  const cornerPositions: [Position, Position, Position, Position] = [
    corners[0].pos,
    corners[1].pos,
    corners[2].pos,
    corners[3].pos,
  ];
  const floor: Position[] = [];
  const roof: Position[] = [];
  for (const c of corners) {
    if (c.bivalue) floor.push(c.pos);
    else roof.push(c.pos);
  }
  return { cornerPositions, floor, roof };
}

function tryType1(
  corners: CornerInfo[],
  X: Digit,
  Y: Digit,
): UniqueRectangleResult | null {
  let extraIndex = -1;
  let bivalueCount = 0;
  for (let i = 0; i < corners.length; i++) {
    if (corners[i].bivalue) {
      bivalueCount++;
    } else {
      extraIndex = i;
    }
  }
  if (bivalueCount !== 3 || extraIndex === -1) return null;

  const target = corners[extraIndex];
  const eliminations: UniqueRectangleElimination[] = [
    { cell: target.pos, digits: [X, Y] },
  ];
  const { cornerPositions, floor, roof } = buildResultBase(corners);
  return {
    technique: 'unique-rectangle',
    type: 1,
    digits: [X, Y],
    corners: cornerPositions,
    floorCells: floor,
    roofCells: roof,
    eliminations,
    explanation: `Unique Rectangle Type 1 on {${X},${Y}}: three corners are bivalue {${X},${Y}}; if R${target.pos.row + 1}C${target.pos.col + 1} also took ${X} or ${Y} the four corners would form a deadly pattern, so eliminate ${X} and ${Y} from R${target.pos.row + 1}C${target.pos.col + 1}`,
  };
}

function tryType2(
  grid: (Set<Digit> | null)[][],
  variant: Variant,
  corners: CornerInfo[],
  X: Digit,
  Y: Digit,
): UniqueRectangleResult | null {
  const roofIndices: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    if (!corners[i].bivalue) roofIndices.push(i);
  }
  if (roofIndices.length !== 2) return null;

  const r1 = corners[roofIndices[0]];
  const r2 = corners[roofIndices[1]];
  if (r1.extras.length !== 1 || r2.extras.length !== 1) return null;
  if (r1.extras[0] !== r2.extras[0]) return null;
  const Z = r1.extras[0];

  const size = variant.size;
  const eliminations: UniqueRectangleElimination[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (r === r1.pos.row && c === r1.pos.col) continue;
      if (r === r2.pos.row && c === r2.pos.col) continue;
      const cand = grid[r][c];
      if (cand == null || !cand.has(Z)) continue;
      const target: Position = { row: r, col: c };
      if (!sharesHouse(variant, target, r1.pos)) continue;
      if (!sharesHouse(variant, target, r2.pos)) continue;
      eliminations.push({ cell: target, digits: [Z] });
    }
  }
  if (eliminations.length === 0) return null;

  const { cornerPositions, floor, roof } = buildResultBase(corners);
  return {
    technique: 'unique-rectangle',
    type: 2,
    digits: [X, Y],
    corners: cornerPositions,
    floorCells: floor,
    roofCells: roof,
    extraDigit: Z,
    eliminations,
    explanation: `Unique Rectangle Type 2 on {${X},${Y}}: roof cells R${r1.pos.row + 1}C${r1.pos.col + 1} and R${r2.pos.row + 1}C${r2.pos.col + 1} each carry one extra ${Z}; one of them must be ${Z}, so eliminate ${Z} from cells seeing both roofs`,
  };
}

function tryType4(
  grid: (Set<Digit> | null)[][],
  variant: Variant,
  corners: CornerInfo[],
  X: Digit,
  Y: Digit,
): UniqueRectangleResult | null {
  const roofIndices: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    if (!corners[i].bivalue) roofIndices.push(i);
  }
  if (roofIndices.length !== 2) return null;

  const r1 = corners[roofIndices[0]];
  const r2 = corners[roofIndices[1]];

  const houses: UniqueRectangleSharedHouse[] = [];
  if (r1.pos.row === r2.pos.row) houses.push('row');
  if (r1.pos.col === r2.pos.col) houses.push('col');
  if (sameBox(variant, r1.pos, r2.pos)) houses.push('box');
  if (houses.length === 0) return null;

  const size = variant.size;

  for (const house of houses) {
    const candidates: Digit[] = [X, Y];
    for (const candidate of candidates) {
      const other = candidate === X ? Y : X;
      const otherCellsHaveCandidate = houseCellsHaveDigit(
        grid,
        variant,
        r1.pos,
        r2.pos,
        house,
        candidate,
        size,
      );
      if (otherCellsHaveCandidate) continue;

      const eliminations: UniqueRectangleElimination[] = [];
      if (r1.candidates.has(other)) {
        eliminations.push({ cell: r1.pos, digits: [other] });
      }
      if (r2.candidates.has(other)) {
        eliminations.push({ cell: r2.pos, digits: [other] });
      }
      if (eliminations.length === 0) continue;

      const { cornerPositions, floor, roof } = buildResultBase(corners);
      return {
        technique: 'unique-rectangle',
        type: 4,
        digits: [X, Y],
        corners: cornerPositions,
        floorCells: floor,
        roofCells: roof,
        confinedDigit: candidate,
        sharedHouse: house,
        eliminations,
        explanation: `Unique Rectangle Type 4 on {${X},${Y}}: in the shared ${describeHouse(house, r1.pos)}, ${candidate} is confined to roof cells R${r1.pos.row + 1}C${r1.pos.col + 1} and R${r2.pos.row + 1}C${r2.pos.col + 1}; eliminate ${other} from both`,
      };
    }
  }

  return null;
}

function houseCellsHaveDigit(
  grid: (Set<Digit> | null)[][],
  variant: Variant,
  a: Position,
  b: Position,
  house: UniqueRectangleSharedHouse,
  digit: Digit,
  size: number,
): boolean {
  if (house === 'row') {
    const r = a.row;
    for (let c = 0; c < size; c++) {
      if (c === a.col || c === b.col) continue;
      const cand = grid[r][c];
      if (cand != null && cand.has(digit)) return true;
    }
    return false;
  }
  if (house === 'col') {
    const c = a.col;
    for (let r = 0; r < size; r++) {
      if (r === a.row || r === b.row) continue;
      const cand = grid[r][c];
      if (cand != null && cand.has(digit)) return true;
    }
    return false;
  }
  const boxStartRow =
    Math.floor(a.row / variant.boxHeight) * variant.boxHeight;
  const boxStartCol =
    Math.floor(a.col / variant.boxWidth) * variant.boxWidth;
  for (let r = boxStartRow; r < boxStartRow + variant.boxHeight; r++) {
    for (let c = boxStartCol; c < boxStartCol + variant.boxWidth; c++) {
      if (r === a.row && c === a.col) continue;
      if (r === b.row && c === b.col) continue;
      const cand = grid[r][c];
      if (cand != null && cand.has(digit)) return true;
    }
  }
  return false;
}

function describeHouse(
  house: UniqueRectangleSharedHouse,
  a: Position,
): string {
  if (house === 'row') return `row ${a.row + 1}`;
  if (house === 'col') return `column ${a.col + 1}`;
  return `box containing R${a.row + 1}C${a.col + 1}`;
}
