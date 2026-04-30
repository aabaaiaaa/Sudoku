import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface MultiColoringElimination {
  cell: Position;
  digits: Digit[];
}

export interface MultiColoringResult {
  technique: 'multi-coloring';
  /** The digit whose strong-link graph produced the cross-cluster inference. */
  digit: Digit;
  /** Cluster 1 cells colored A, in row-major order. */
  cluster1A: Position[];
  /** Cluster 1 cells colored B, in row-major order. */
  cluster1B: Position[];
  /** Cluster 2 cells colored A, in row-major order. */
  cluster2A: Position[];
  /** Cluster 2 cells colored B, in row-major order. */
  cluster2B: Position[];
  /** Which color of cluster 1 sees which color of cluster 2 across the bridge. */
  bridgeColor: { c1: 'A' | 'B'; c2: 'A' | 'B' };
  /** A representative cross-cluster pair sharing a (non-strong-link) house. */
  bridge: [Position, Position];
  /** Description of the house witnessing the bridge. */
  bridgeHouse: string;
  eliminations: MultiColoringElimination[];
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

function sharesHouse(variant: Variant, a: Position, b: Position): boolean {
  return sharedHouseDescription(variant, a, b) !== null;
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

interface Cluster {
  A: Position[];
  B: Position[];
  /** Row-major-lowest cell, used to order clusters deterministically. */
  lowest: Position;
}

/**
 * Multi-Coloring (cross-cluster color inference) for a single digit.
 *
 * For a chosen digit, build the strong-link graph: an edge between two cells
 * whenever they are the only cells where the digit is a candidate within some
 * house. The graph is bipartite within each connected component, so two-color
 * each component into colors A and B. Within a single cluster, exactly one of
 * the two colors is "true" (contains the digit) and the other is "false".
 *
 * If a cell colored c1 in cluster 1 shares a house with a cell colored c2 in
 * cluster 2 (and that house is *not* a strong-link house — otherwise the cells
 * would belong to the same cluster), then c1 and c2 cannot both be true: the
 * digit would appear twice in the shared house. Therefore at least one of the
 * opposite colors — c1's complement in cluster 1 or c2's complement in cluster
 * 2 — must be true. Any cell that sees a cell of c1's complement *and* a cell
 * of c2's complement must therefore not contain the digit.
 *
 * Iteration order is deterministic: digits ascending; clusters by row-major
 * order of their lowest cell; cluster pairs (i &lt; j); colour pairs (A,A),
 * (A,B), (B,A), (B,B); and bridge candidates row-major within each colour
 * pair. Returns the first inference yielding ≥1 elimination.
 */
export function findMultiColoring(board: Board): MultiColoringResult | null {
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
    const clusters: Cluster[] = [];

    for (const startNode of allNodes) {
      const startKey = posKey(startNode);
      if (visited.has(startKey)) continue;

      const color = new Map<string, 'A' | 'B'>();
      color.set(startKey, 'A');
      visited.add(startKey);
      const queue: Position[] = [startNode];
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

      const A: Position[] = [];
      const B: Position[] = [];
      for (const [k, c] of color) {
        const [r, col] = k.split(',').map(Number);
        const pos: Position = { row: r, col };
        if (c === 'A') A.push(pos);
        else B.push(pos);
      }
      A.sort(rowMajor);
      B.sort(rowMajor);

      // Multi-Coloring requires both colours present; isolated 1-node clusters
      // are skipped here.
      if (A.length > 0 && B.length > 0) {
        clusters.push({ A, B, lowest: startNode });
      }
    }

    if (clusters.length < 2) continue;

    const allClusterKeys = new Set<string>();
    for (const c of clusters) {
      for (const p of c.A) allClusterKeys.add(posKey(p));
      for (const p of c.B) allClusterKeys.add(posKey(p));
    }

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const c1 = clusters[i];
        const c2 = clusters[j];

        for (const color1 of ['A', 'B'] as const) {
          for (const color2 of ['A', 'B'] as const) {
            const cells1 = color1 === 'A' ? c1.A : c1.B;
            const cells2 = color2 === 'A' ? c2.A : c2.B;
            const opp1 = color1 === 'A' ? c1.B : c1.A;
            const opp2 = color2 === 'A' ? c2.B : c2.A;

            let bridgeFound: [Position, Position] | null = null;
            let bridgeHouse: string | null = null;
            for (const a of cells1) {
              for (const b of cells2) {
                const shared = sharedHouseDescription(variant, a, b);
                if (shared !== null) {
                  bridgeFound = [a, b];
                  bridgeHouse = shared;
                  break;
                }
              }
              if (bridgeFound !== null) break;
            }
            if (bridgeFound === null || bridgeHouse === null) continue;

            const eliminations: MultiColoringElimination[] = [];
            for (let r = 0; r < variant.size; r++) {
              for (let cc = 0; cc < variant.size; cc++) {
                const target: Position = { row: r, col: cc };
                if (allClusterKeys.has(posKey(target))) continue;
                const cand = grid[r][cc];
                if (cand == null || !cand.has(digit)) continue;
                if (!opp1.some((p) => sharesHouse(variant, target, p))) continue;
                if (!opp2.some((p) => sharesHouse(variant, target, p))) continue;
                eliminations.push({ cell: target, digits: [digit] });
              }
            }
            if (eliminations.length === 0) continue;

            const c1A = c1.A.map(cellLabel).join(',');
            const c1B = c1.B.map(cellLabel).join(',');
            const c2A = c2.A.map(cellLabel).join(',');
            const c2B = c2.B.map(cellLabel).join(',');
            const opp1Label = color1 === 'A' ? 'B' : 'A';
            const opp2Label = color2 === 'A' ? 'B' : 'A';
            const opp1List = opp1.map(cellLabel).join(',');
            const opp2List = opp2.map(cellLabel).join(',');
            const elimList = eliminations.map((e) => cellLabel(e.cell)).join(',');

            return {
              technique: 'multi-coloring',
              digit,
              cluster1A: c1.A,
              cluster1B: c1.B,
              cluster2A: c2.A,
              cluster2B: c2.B,
              bridgeColor: { c1: color1, c2: color2 },
              bridge: bridgeFound,
              bridgeHouse,
              eliminations,
              explanation: `When two separate groups of linked cells for ${digit} are connected — because a cell from one group can see a cell from the other — at least one side of the connection must be wrong. You can remove ${digit} from any cell that can see one cell from each connected side.`,
            };
          }
        }
      }
    }
  }

  return null;
}
