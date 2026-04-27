import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface XCycleElimination {
  cell: Position;
  digits: Digit[];
}

export type XCycleType =
  | 'continuous'
  | 'discontinuous-strong'
  | 'discontinuous-weak';

export interface XCycleEdge {
  from: Position;
  to: Position;
  /** 'strong' if conjugate in some house, 'weak' if just sharing a house. */
  type: 'strong' | 'weak';
  /** Description of the house witnessing the link. */
  house: string;
}

export interface XCyclePlacement {
  pos: Position;
  digit: Digit;
}

export interface XCycleResult {
  technique: 'x-cycle';
  digit: Digit;
  cycleType: XCycleType;
  /** Cells in cycle order. */
  cells: Position[];
  /** Edges in cycle order. edges[i] connects cells[i] and cells[(i+1) % n]. */
  edges: XCycleEdge[];
  /** For 'discontinuous-strong': the cell forced to be the digit. */
  placement?: XCyclePlacement;
  eliminations: XCycleElimination[];
  explanation: string;
}

interface House {
  cells: Position[];
  description: string;
}

interface LinkPair {
  /** Houses where the pair is conjugate (only two cells with the digit). */
  strong: House[];
  /** Houses where the pair shares (both cells have the digit). Includes strong. */
  weak: House[];
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

function posKey(p: Position): string {
  return `${p.row},${p.col}`;
}

function samePos(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function rowMajor(a: Position, b: Position): number {
  return a.row - b.row || a.col - b.col;
}

function sharesHouse(variant: Variant, a: Position, b: Position): boolean {
  if (samePos(a, b)) return false;
  if (a.row === b.row) return true;
  if (a.col === b.col) return true;
  const aBoxRow = Math.floor(a.row / variant.boxHeight);
  const aBoxCol = Math.floor(a.col / variant.boxWidth);
  const bBoxRow = Math.floor(b.row / variant.boxHeight);
  const bBoxCol = Math.floor(b.col / variant.boxWidth);
  return aBoxRow === bBoxRow && aBoxCol === bBoxCol;
}

function buildLinkMap(
  grid: (Set<Digit> | null)[][],
  digit: Digit,
  houses: House[],
): Map<string, Map<string, LinkPair>> {
  const map = new Map<string, Map<string, LinkPair>>();
  for (const house of houses) {
    const inHouse: Position[] = [];
    for (const cell of house.cells) {
      const cand = grid[cell.row][cell.col];
      if (cand != null && cand.has(digit)) inHouse.push(cell);
    }
    if (inHouse.length < 2) continue;
    const isStrong = inHouse.length === 2;
    for (let i = 0; i < inHouse.length; i++) {
      for (let j = 0; j < inHouse.length; j++) {
        if (i === j) continue;
        const a = inHouse[i];
        const b = inHouse[j];
        const ka = posKey(a);
        const kb = posKey(b);
        let inner = map.get(ka);
        if (!inner) {
          inner = new Map();
          map.set(ka, inner);
        }
        let pair = inner.get(kb);
        if (!pair) {
          pair = { strong: [], weak: [] };
          inner.set(kb, pair);
        }
        pair.weak.push(house);
        if (isStrong) pair.strong.push(house);
      }
    }
  }
  return map;
}

function formatCellList(cells: Position[]): string {
  return cells.map((p) => `R${p.row + 1}C${p.col + 1}`).join(',');
}

/**
 * X-Cycle (Single-Digit Alternating Cycle).
 *
 * For a chosen digit, build the link graph of cells where the digit is a
 * candidate. An edge between two cells is "strong" when the digit is conjugate
 * in some shared house (the digit appears in only those two cells of the
 * house) and "weak" when the cells merely share a house. A strong link is
 * also a weak link.
 *
 * An X-Cycle is a closed alternating chain of strong/weak links. There are
 * three useful classes:
 *
 *  - **Continuous (Rule 1)**: even-length cycle whose edges alternate
 *    strong-weak-strong-weak around the loop. For each weak edge in the
 *    cycle, the digit can be eliminated from any cell outside the cycle that
 *    sees both endpoints of that weak edge.
 *  - **Discontinuous, two strong (Rule 2)**: an odd-length closed chain
 *    starting and ending with a strong edge at the same cell. That cell must
 *    be the digit (placement).
 *  - **Discontinuous, two weak (Rule 3)**: an odd-length closed chain
 *    starting and ending with a weak edge at the same cell. The digit can be
 *    eliminated from that cell.
 *
 * The search iterates digits in `variant.digits` order, then starting cells in
 * row-major order, then start-edge type (strong, then weak), and returns the
 * first cycle that yields at least one elimination or a placement.
 */
export function findXCycle(board: Board): XCycleResult | null {
  const { variant } = board;
  const grid = buildCandidatesGrid(board);
  const houses = buildHouses(variant);

  const MAX_LEN = 12;

  for (const digit of variant.digits) {
    const linkMap = buildLinkMap(grid, digit, houses);
    if (linkMap.size === 0) continue;

    const startCells: Position[] = [];
    for (const key of linkMap.keys()) {
      const [r, c] = key.split(',').map(Number);
      startCells.push({ row: r, col: c });
    }
    startCells.sort(rowMajor);

    for (const start of startCells) {
      // Try cycles starting with a strong edge.
      const startStrong = trySearch(
        variant,
        grid,
        digit,
        linkMap,
        start,
        'strong',
        MAX_LEN,
      );
      if (startStrong !== null) return startStrong;

      // Try cycles starting with a weak edge.
      const startWeak = trySearch(
        variant,
        grid,
        digit,
        linkMap,
        start,
        'weak',
        MAX_LEN,
      );
      if (startWeak !== null) return startWeak;
    }
  }

  return null;
}

function trySearch(
  variant: Variant,
  grid: (Set<Digit> | null)[][],
  digit: Digit,
  linkMap: Map<string, Map<string, LinkPair>>,
  start: Position,
  startType: 'strong' | 'weak',
  maxLen: number,
): XCycleResult | null {
  // Iterative DFS using a stack of frames.
  // Path of cells, parallel array of edges. The edge i connects path[i] and path[i+1].
  const path: Position[] = [start];
  const edges: XCycleEdge[] = [];
  const visited = new Set<string>();
  visited.add(posKey(start));

  const result = dfs(
    variant,
    grid,
    digit,
    linkMap,
    start,
    startType,
    path,
    edges,
    visited,
    maxLen,
  );
  return result;
}

function dfs(
  variant: Variant,
  grid: (Set<Digit> | null)[][],
  digit: Digit,
  linkMap: Map<string, Map<string, LinkPair>>,
  start: Position,
  startType: 'strong' | 'weak',
  path: Position[],
  edges: XCycleEdge[],
  visited: Set<string>,
  maxLen: number,
): XCycleResult | null {
  const current = path[path.length - 1];
  const innerMap = linkMap.get(posKey(current));
  if (!innerMap) return null;

  // Determine the type of the next edge based on the previous edge.
  const nextType: 'strong' | 'weak' =
    edges.length === 0
      ? startType
      : edges[edges.length - 1].type === 'strong'
        ? 'weak'
        : 'strong';

  // Order neighbors deterministically by row-major.
  const neighbors: Position[] = [];
  for (const key of innerMap.keys()) {
    const [r, c] = key.split(',').map(Number);
    neighbors.push({ row: r, col: c });
  }
  neighbors.sort(rowMajor);

  for (const next of neighbors) {
    const pair = innerMap.get(posKey(next));
    if (!pair) continue;
    const houseList = nextType === 'strong' ? pair.strong : pair.weak;
    if (houseList.length === 0) continue;
    const house = houseList[0];

    // Closing the cycle by stepping back to start?
    if (samePos(next, start)) {
      // Need at least 3 cells in cycle (so at least 2 prior edges + 1 closing).
      if (path.length < 3) continue;

      const closingEdge: XCycleEdge = {
        from: current,
        to: start,
        type: nextType,
        house: house.description,
      };

      // Determine cycle classification:
      // Number of cells in cycle = path.length, number of edges = path.length.
      // edges = edges so far (path.length - 1) + closingEdge.
      // Continuous: alternation consistent. With our greedy alternation, edges
      //   already alternate strictly. Closing requires nextType ≠ startType,
      //   which means number of edges (path.length) is even.
      // Discontinuous-strong: startType=='strong', closing edge type=='strong'
      //   (so two strong meet at start). path.length must be odd.
      // Discontinuous-weak: startType=='weak', closing edge type=='weak'.
      //   path.length must be odd.

      const cycleLen = path.length;
      let cycleType: XCycleType | null = null;
      if (startType === 'strong' && nextType === 'weak' && cycleLen % 2 === 0) {
        cycleType = 'continuous';
      } else if (
        startType === 'strong' &&
        nextType === 'strong' &&
        cycleLen % 2 === 1
      ) {
        cycleType = 'discontinuous-strong';
      } else if (
        startType === 'weak' &&
        nextType === 'weak' &&
        cycleLen % 2 === 1
      ) {
        cycleType = 'discontinuous-weak';
      }

      if (cycleType !== null) {
        const fullEdges: XCycleEdge[] = [...edges, closingEdge];
        const result = buildResult(
          variant,
          grid,
          digit,
          path,
          fullEdges,
          cycleType,
        );
        if (result !== null) return result;
      }
      continue;
    }

    // Don't revisit cells.
    if (visited.has(posKey(next))) continue;

    if (path.length + 1 > maxLen) continue;

    const newEdge: XCycleEdge = {
      from: current,
      to: next,
      type: nextType,
      house: house.description,
    };

    path.push(next);
    edges.push(newEdge);
    visited.add(posKey(next));

    const result = dfs(
      variant,
      grid,
      digit,
      linkMap,
      start,
      startType,
      path,
      edges,
      visited,
      maxLen,
    );
    if (result !== null) return result;

    path.pop();
    edges.pop();
    visited.delete(posKey(next));
  }

  return null;
}

function buildResult(
  variant: Variant,
  grid: (Set<Digit> | null)[][],
  digit: Digit,
  cells: Position[],
  edges: XCycleEdge[],
  cycleType: XCycleType,
): XCycleResult | null {
  const cycleSet = new Set(cells.map(posKey));

  if (cycleType === 'continuous') {
    // For each weak edge, find cells outside the cycle that see both endpoints
    // and have the digit as a candidate.
    const elimMap = new Map<string, Position>();
    for (const edge of edges) {
      if (edge.type !== 'weak') continue;
      for (let r = 0; r < variant.size; r++) {
        for (let c = 0; c < variant.size; c++) {
          const cand = grid[r][c];
          if (cand == null) continue;
          if (!cand.has(digit)) continue;
          const target: Position = { row: r, col: c };
          if (cycleSet.has(posKey(target))) continue;
          if (!sharesHouse(variant, target, edge.from)) continue;
          if (!sharesHouse(variant, target, edge.to)) continue;
          elimMap.set(posKey(target), target);
        }
      }
    }
    if (elimMap.size === 0) return null;

    const elimCells = [...elimMap.values()].sort(rowMajor);
    const eliminations: XCycleElimination[] = elimCells.map((cell) => ({
      cell,
      digits: [digit],
    }));

    return {
      technique: 'x-cycle',
      digit,
      cycleType,
      cells: cells.slice(),
      edges: edges.slice(),
      eliminations,
      explanation: `X-Cycle on ${digit}: continuous nice loop ${formatCellList(cells)} (length ${cells.length}); for each weak link, eliminate ${digit} from cells seeing both endpoints — ${formatCellList(elimCells)}`,
    };
  }

  if (cycleType === 'discontinuous-strong') {
    // Two strong edges meet at the start cell (cells[0]). Place digit there.
    const start = cells[0];
    return {
      technique: 'x-cycle',
      digit,
      cycleType,
      cells: cells.slice(),
      edges: edges.slice(),
      placement: { pos: start, digit },
      eliminations: [],
      explanation: `X-Cycle on ${digit}: discontinuous loop ${formatCellList(cells)} with two strong links meeting at R${start.row + 1}C${start.col + 1}; place ${digit} at R${start.row + 1}C${start.col + 1}`,
    };
  }

  // discontinuous-weak: two weak edges meet at the start cell. Eliminate digit.
  const start = cells[0];
  // The start cell must still have the digit as a candidate (sanity check).
  const cand = grid[start.row][start.col];
  if (cand == null || !cand.has(digit)) return null;

  return {
    technique: 'x-cycle',
    digit,
    cycleType,
    cells: cells.slice(),
    edges: edges.slice(),
    eliminations: [{ cell: start, digits: [digit] }],
    explanation: `X-Cycle on ${digit}: discontinuous loop ${formatCellList(cells)} with two weak links meeting at R${start.row + 1}C${start.col + 1}; eliminate ${digit} from R${start.row + 1}C${start.col + 1}`,
  };
}
