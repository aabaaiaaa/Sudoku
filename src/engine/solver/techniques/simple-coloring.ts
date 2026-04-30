import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface SimpleColoringElimination {
  cell: Position;
  digits: Digit[];
}

export interface SimpleColoringResult {
  technique: 'simple-coloring';
  /** The digit whose strong-link graph produced the wrap. */
  digit: Digit;
  /** Cells colored "A" in the analysed component, in row-major order. */
  colorA: Position[];
  /** Cells colored "B" in the analysed component, in row-major order. */
  colorB: Position[];
  /** Which color was found inconsistent and is therefore the eliminated set. */
  invalidColor: 'A' | 'B';
  /** Two same-colored cells sharing a house, in row-major order. */
  conflict: [Position, Position];
  /** Plain-language description of the house containing the conflict. */
  conflictHouse: string;
  eliminations: SimpleColoringElimination[];
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

function sharedHouseDescription(
  variant: Variant,
  a: Position,
  b: Position,
): string | null {
  if (a.row === b.row && a.col === b.col) return null;
  if (a.row === b.row) return `row ${a.row + 1}`;
  if (a.col === b.col) return `column ${a.col + 1}`;
  const aBoxRow = Math.floor(a.row / variant.boxHeight);
  const aBoxCol = Math.floor(a.col / variant.boxWidth);
  const bBoxRow = Math.floor(b.row / variant.boxHeight);
  const bBoxCol = Math.floor(b.col / variant.boxWidth);
  if (aBoxRow === bBoxRow && aBoxCol === bBoxCol) {
    const boxesPerRow = Math.floor(variant.size / variant.boxWidth);
    const boxIndex = aBoxRow * boxesPerRow + aBoxCol;
    return `box ${boxIndex + 1}`;
  }
  return null;
}

function posKey(p: Position): string {
  return `${p.row},${p.col}`;
}

function rowMajor(a: Position, b: Position): number {
  return a.row - b.row || a.col - b.col;
}

/**
 * Simple Coloring (color wrap) for a single digit.
 *
 * For a chosen digit, build the strong-link graph: an edge between two cells
 * whenever they are the only cells where the digit is a candidate within some
 * house (row, column, or box). The graph is bipartite within each connected
 * component, so two-color it. If two cells of the same color appear together
 * in any house, that color cannot be the "true" set — placing the digit in
 * both would put it twice in that house. Therefore the digit can be eliminated
 * from every cell of that color.
 *
 * Iterates digits in `variant.digits` order, then components in row-major
 * order of their lowest-positioned node, then colors {A, B}, then same-color
 * pairs in row-major order. Returns the first wrap found.
 */
export function findSimpleColoring(board: Board): SimpleColoringResult | null {
  const { variant } = board;
  const grid = buildCandidatesGrid(board);
  const houses = buildHouses(variant);

  for (const digit of variant.digits) {
    const adjacency = new Map<string, Position[]>();
    const addEdge = (a: Position, b: Position): void => {
      const ka = posKey(a);
      const kb = posKey(b);
      const adjA = adjacency.get(ka) ?? [];
      if (!adjA.some((p) => p.row === b.row && p.col === b.col)) adjA.push(b);
      adjacency.set(ka, adjA);
      const adjB = adjacency.get(kb) ?? [];
      if (!adjB.some((p) => p.row === a.row && p.col === a.col)) adjB.push(a);
      adjacency.set(kb, adjB);
    };

    for (const house of houses) {
      const cellsWithDigit: Position[] = [];
      for (const cell of house.cells) {
        const cand = grid[cell.row][cell.col];
        if (cand != null && cand.has(digit)) cellsWithDigit.push(cell);
      }
      if (cellsWithDigit.length === 2) {
        addEdge(cellsWithDigit[0], cellsWithDigit[1]);
      }
    }

    if (adjacency.size === 0) continue;

    const allNodes: Position[] = [];
    for (const key of adjacency.keys()) {
      const [r, c] = key.split(',').map(Number);
      allNodes.push({ row: r, col: c });
    }
    allNodes.sort(rowMajor);

    const visited = new Set<string>();

    for (const startNode of allNodes) {
      const startKey = posKey(startNode);
      if (visited.has(startKey)) continue;

      const color = new Map<string, 'A' | 'B'>();
      const queue: Position[] = [startNode];
      color.set(startKey, 'A');
      visited.add(startKey);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const curKey = posKey(cur);
        const next: 'A' | 'B' = color.get(curKey) === 'A' ? 'B' : 'A';
        for (const n of adjacency.get(curKey) ?? []) {
          const nKey = posKey(n);
          if (color.has(nKey)) continue;
          color.set(nKey, next);
          visited.add(nKey);
          queue.push(n);
        }
      }

      const colorA: Position[] = [];
      const colorB: Position[] = [];
      for (const [k, c] of color) {
        const [r, col] = k.split(',').map(Number);
        const pos: Position = { row: r, col };
        if (c === 'A') colorA.push(pos);
        else colorB.push(pos);
      }
      colorA.sort(rowMajor);
      colorB.sort(rowMajor);

      for (const which of ['A', 'B'] as const) {
        const cells = which === 'A' ? colorA : colorB;
        if (cells.length < 2) continue;
        for (let i = 0; i < cells.length; i++) {
          for (let j = i + 1; j < cells.length; j++) {
            const conflictHouse = sharedHouseDescription(
              variant,
              cells[i],
              cells[j],
            );
            if (conflictHouse === null) continue;

            const eliminations: SimpleColoringElimination[] = cells.map(
              (cell) => ({ cell, digits: [digit] }),
            );

            const aCellList = colorA
              .map((p) => `R${p.row + 1}C${p.col + 1}`)
              .join(',');
            const bCellList = colorB
              .map((p) => `R${p.row + 1}C${p.col + 1}`)
              .join(',');
            const elimList = cells
              .map((p) => `R${p.row + 1}C${p.col + 1}`)
              .join(',');

            return {
              technique: 'simple-coloring',
              digit,
              colorA,
              colorB,
              invalidColor: which,
              conflict: [cells[i], cells[j]],
              conflictHouse,
              eliminations,
              explanation: `When you mark all the places ${digit} could go in two alternating groups, and one group ends up with two cells in the same row, column, or box, that group can't be right. Then you can remove ${digit} from every cell in that group.`,
            };
          }
        }
      }
    }
  }

  return null;
}
