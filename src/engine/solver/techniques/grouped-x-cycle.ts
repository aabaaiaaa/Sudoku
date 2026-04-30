import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface GroupedXCycleElimination {
  cell: Position;
  digits: Digit[];
}

export type GroupedXCycleType =
  | 'continuous'
  | 'discontinuous-strong'
  | 'discontinuous-weak';

export interface GroupedXCycleNode {
  /** Cells of the node, sorted in row-major order. Length 1 for a single cell;
   *  length 2 or 3 for a group aligned in a (box ∩ row) or (box ∩ col)
   *  intersection. */
  cells: Position[];
  /** True iff `cells.length` > 1. */
  isGroup: boolean;
}

export interface GroupedXCycleEdge {
  from: GroupedXCycleNode;
  to: GroupedXCycleNode;
  /** 'strong' if the digit's only candidates in the witness house are the
   *  union of from and to cells; 'weak' if both nodes merely share the house. */
  type: 'strong' | 'weak';
  /** Description of the witness house, e.g. "row 5", "column 7", "box 1". */
  house: string;
}

export interface GroupedXCyclePlacement {
  pos: Position;
  digit: Digit;
}

export interface GroupedXCycleResult {
  technique: 'grouped-x-cycle';
  digit: Digit;
  cycleType: GroupedXCycleType;
  /** Nodes in cycle order. */
  nodes: GroupedXCycleNode[];
  /** Edges in cycle order. edges[i] connects nodes[i] and nodes[(i+1) % n]. */
  edges: GroupedXCycleEdge[];
  /** For 'discontinuous-strong' starting at a single cell: the placement. */
  placement?: GroupedXCyclePlacement;
  eliminations: GroupedXCycleElimination[];
  explanation: string;
}

interface House {
  cells: Position[];
  description: string;
}

interface AdjEntry {
  to: GroupedXCycleNode;
  type: 'strong' | 'weak';
  house: string;
}

const MAX_LEN = 10;

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

function nodeKey(node: GroupedXCycleNode): string {
  return node.cells.map(posKey).join('|');
}

function nodesDisjoint(a: GroupedXCycleNode, b: GroupedXCycleNode): boolean {
  const aKeys = new Set(a.cells.map(posKey));
  for (const c of b.cells) {
    if (aKeys.has(posKey(c))) return false;
  }
  return true;
}

function compareNodes(
  a: GroupedXCycleNode,
  b: GroupedXCycleNode,
): number {
  const fa = a.cells[0];
  const fb = b.cells[0];
  const c = rowMajor(fa, fb);
  if (c !== 0) return c;
  if (a.cells.length !== b.cells.length)
    return a.cells.length - b.cells.length;
  return nodeKey(a).localeCompare(nodeKey(b));
}


/**
 * Enumerate all candidate nodes for a given digit:
 *  - one single-cell node per cell with the digit as candidate;
 *  - one group node per (box ∩ row) or (box ∩ col) intersection that contains
 *    2 or 3 cells with the digit as candidate.
 */
function buildNodes(
  variant: Variant,
  grid: (Set<Digit> | null)[][],
  digit: Digit,
): GroupedXCycleNode[] {
  const nodes: GroupedXCycleNode[] = [];
  const seen = new Set<string>();

  function addNode(cells: Position[], isGroup: boolean): void {
    const node: GroupedXCycleNode = { cells, isGroup };
    const k = nodeKey(node);
    if (seen.has(k)) return;
    seen.add(k);
    nodes.push(node);
  }

  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      const cand = grid[r][c];
      if (cand != null && cand.has(digit)) {
        addNode([{ row: r, col: c }], false);
      }
    }
  }

  const boxesPerCol = Math.floor(variant.size / variant.boxHeight);
  const boxesPerRow = Math.floor(variant.size / variant.boxWidth);
  for (let bi = 0; bi < boxesPerCol; bi++) {
    for (let bj = 0; bj < boxesPerRow; bj++) {
      const rStart = bi * variant.boxHeight;
      const cStart = bj * variant.boxWidth;
      for (let dr = 0; dr < variant.boxHeight; dr++) {
        const cells: Position[] = [];
        for (let dc = 0; dc < variant.boxWidth; dc++) {
          const r = rStart + dr;
          const c = cStart + dc;
          const cand = grid[r][c];
          if (cand != null && cand.has(digit)) cells.push({ row: r, col: c });
        }
        if (cells.length >= 2) addNode(cells, true);
      }
      for (let dc = 0; dc < variant.boxWidth; dc++) {
        const cells: Position[] = [];
        for (let dr = 0; dr < variant.boxHeight; dr++) {
          const r = rStart + dr;
          const c = cStart + dc;
          const cand = grid[r][c];
          if (cand != null && cand.has(digit)) cells.push({ row: r, col: c });
        }
        if (cells.length >= 2) addNode(cells, true);
      }
    }
  }

  nodes.sort(compareNodes);
  return nodes;
}

function buildAdjacency(
  grid: (Set<Digit> | null)[][],
  digit: Digit,
  nodes: GroupedXCycleNode[],
  houses: House[],
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();

  function addDirectedEdge(
    from: GroupedXCycleNode,
    to: GroupedXCycleNode,
    type: 'strong' | 'weak',
    house: string,
  ): void {
    const fromKey = nodeKey(from);
    let list = adj.get(fromKey);
    if (!list) {
      list = [];
      adj.set(fromKey, list);
    }
    const toKey = nodeKey(to);
    const existing = list.find((e) => nodeKey(e.to) === toKey);
    if (existing) {
      if (type === 'strong' && existing.type === 'weak') {
        existing.type = 'strong';
        existing.house = house;
      }
      return;
    }
    list.push({ to, type, house });
  }

  for (const house of houses) {
    const houseCellSet = new Set(house.cells.map(posKey));
    const candKeys: string[] = [];
    for (const cell of house.cells) {
      const cand = grid[cell.row][cell.col];
      if (cand != null && cand.has(digit)) candKeys.push(posKey(cell));
    }
    if (candKeys.length < 2) continue;
    const candKeySet = new Set(candKeys);

    const nodesInHouse: GroupedXCycleNode[] = [];
    for (const node of nodes) {
      let allIn = true;
      for (const cell of node.cells) {
        if (!houseCellSet.has(posKey(cell))) {
          allIn = false;
          break;
        }
      }
      if (allIn) nodesInHouse.push(node);
    }

    for (let i = 0; i < nodesInHouse.length; i++) {
      for (let j = 0; j < nodesInHouse.length; j++) {
        if (i === j) continue;
        const A = nodesInHouse[i];
        const B = nodesInHouse[j];
        if (!nodesDisjoint(A, B)) continue;
        const unionKeys = new Set<string>();
        for (const c of A.cells) unionKeys.add(posKey(c));
        for (const c of B.cells) unionKeys.add(posKey(c));
        let strong = true;
        for (const k of candKeySet) {
          if (!unionKeys.has(k)) {
            strong = false;
            break;
          }
        }
        addDirectedEdge(A, B, strong ? 'strong' : 'weak', house.description);
      }
    }
  }

  return adj;
}

function nodeContainsCell(node: GroupedXCycleNode, key: string): boolean {
  for (const c of node.cells) {
    if (posKey(c) === key) return true;
  }
  return false;
}

/** True iff `target` shares a house with every cell of `node`. */
function targetSeesAllOf(
  variant: Variant,
  target: Position,
  node: GroupedXCycleNode,
): boolean {
  for (const cell of node.cells) {
    if (!sharesHouse(variant, target, cell)) return false;
  }
  return true;
}

interface SearchContext {
  variant: Variant;
  grid: (Set<Digit> | null)[][];
  digit: Digit;
  adj: Map<string, AdjEntry[]>;
}

function dfs(
  ctx: SearchContext,
  start: GroupedXCycleNode,
  startType: 'strong' | 'weak',
  path: GroupedXCycleNode[],
  edges: GroupedXCycleEdge[],
  visited: Set<string>,
  acceptType: GroupedXCycleType,
): GroupedXCycleResult | null {
  const current = path[path.length - 1];
  const list = ctx.adj.get(nodeKey(current));
  if (!list) return null;

  const nextType: 'strong' | 'weak' =
    edges.length === 0
      ? startType
      : edges[edges.length - 1].type === 'strong'
        ? 'weak'
        : 'strong';

  const sortedList = [...list].sort((a, b) => compareNodes(a.to, b.to));

  for (const entry of sortedList) {
    if (nextType === 'strong' && entry.type !== 'strong') continue;
    const next = entry.to;
    const nextKey = nodeKey(next);

    if (nextKey === nodeKey(start)) {
      if (path.length < 3) continue;
      let cycleType: GroupedXCycleType | null = null;
      const cycleLen = path.length;
      if (
        startType === 'strong' &&
        nextType === 'weak' &&
        cycleLen % 2 === 0 &&
        cycleLen >= 4
      ) {
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
      if (cycleType === null) continue;
      if (cycleType !== acceptType) continue;
      let hasGroup = false;
      for (const n of path) {
        if (n.isGroup) {
          hasGroup = true;
          break;
        }
      }
      if (!hasGroup) continue;
      const closingEdge: GroupedXCycleEdge = {
        from: current,
        to: start,
        type: nextType,
        house: entry.house,
      };
      const result = buildResult(
        ctx,
        path.slice(),
        [...edges, closingEdge],
        cycleType,
      );
      if (result !== null) return result;
      continue;
    }

    let overlap = false;
    for (const cell of next.cells) {
      if (visited.has(posKey(cell))) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;
    if (path.length + 1 > MAX_LEN) continue;

    const newEdge: GroupedXCycleEdge = {
      from: current,
      to: next,
      type: nextType,
      house: entry.house,
    };

    path.push(next);
    edges.push(newEdge);
    for (const cell of next.cells) visited.add(posKey(cell));

    const result = dfs(ctx, start, startType, path, edges, visited, acceptType);
    if (result !== null) return result;

    path.pop();
    edges.pop();
    for (const cell of next.cells) visited.delete(posKey(cell));
  }

  return null;
}

function buildResult(
  ctx: SearchContext,
  nodes: GroupedXCycleNode[],
  edges: GroupedXCycleEdge[],
  cycleType: GroupedXCycleType,
): GroupedXCycleResult | null {
  const { variant, grid, digit } = ctx;
  const cycleCellKeys = new Set<string>();
  for (const node of nodes) {
    for (const cell of node.cells) cycleCellKeys.add(posKey(cell));
  }

  if (cycleType === 'continuous') {
    const elimMap = new Map<string, Position>();
    for (const edge of edges) {
      if (edge.type !== 'weak') continue;
      for (let r = 0; r < variant.size; r++) {
        for (let c = 0; c < variant.size; c++) {
          const cand = grid[r][c];
          if (cand == null || !cand.has(digit)) continue;
          const target: Position = { row: r, col: c };
          const tk = posKey(target);
          if (cycleCellKeys.has(tk)) continue;
          if (nodeContainsCell(edge.from, tk)) continue;
          if (nodeContainsCell(edge.to, tk)) continue;
          if (!targetSeesAllOf(variant, target, edge.from)) continue;
          if (!targetSeesAllOf(variant, target, edge.to)) continue;
          elimMap.set(tk, target);
        }
      }
    }
    if (elimMap.size === 0) return null;
    const elimCells = [...elimMap.values()].sort(rowMajor);
    const eliminations: GroupedXCycleElimination[] = elimCells.map((cell) => ({
      cell,
      digits: [digit],
    }));
    return {
      technique: 'grouped-x-cycle',
      digit,
      cycleType,
      nodes,
      edges,
      eliminations,
      explanation: `When a chain of cells (or small groups of cells) for ${digit} closes into a complete loop, switching between "must be" and "can't be" at each step, you can remove ${digit} from any cell that can see two consecutive "can't be" cells in the loop.`,
    };
  }

  const start = nodes[0];

  if (cycleType === 'discontinuous-strong') {
    if (start.isGroup) return null;
    const pos = start.cells[0];
    const cand = grid[pos.row][pos.col];
    if (cand == null || !cand.has(digit)) return null;
    return {
      technique: 'grouped-x-cycle',
      digit,
      cycleType,
      nodes,
      edges,
      placement: { pos, digit },
      eliminations: [],
      explanation: `When a chain of cells for ${digit} almost closes into a loop but the start position ends up with two "must be" connections, that position has to be ${digit} — place it there.`,
    };
  }

  // discontinuous-weak: two weak links meet at start. Eliminate digit from
  // every cell of the start node that still has it as a candidate.
  const eliminations: GroupedXCycleElimination[] = [];
  for (const cell of start.cells) {
    const cand = grid[cell.row][cell.col];
    if (cand != null && cand.has(digit)) {
      eliminations.push({ cell, digits: [digit] });
    }
  }
  if (eliminations.length === 0) return null;
  eliminations.sort((a, b) => rowMajor(a.cell, b.cell));
  return {
    technique: 'grouped-x-cycle',
    digit,
    cycleType,
    nodes,
    edges,
    eliminations,
    explanation: `When a chain of cells for ${digit} almost closes into a loop but the start position ends up with two "can't be" connections, ${digit} cannot go in any of those cells — remove it from them.`,
  };
}

/**
 * Grouped X-Cycle (single-digit alternating cycle with grouped nodes).
 *
 * Extends X-Cycle by allowing nodes to be groups of 2 or 3 cells aligned in a
 * (box ∩ row) or (box ∩ col) intersection, in addition to single cells. A
 * group represents the proposition "the digit lives at one of these cells."
 *
 * Edges between two disjoint nodes A and B exist within a house H whenever
 * both nodes' cells are entirely contained in H. The edge is **strong** when
 * the digit's only candidate cells in H are exactly A ∪ B (so if the digit is
 * not in A, it must be in B); otherwise **weak** (so if the digit is in A, it
 * cannot be in B). Strong implies weak.
 *
 * A cycle is a closed alternating chain of strong/weak edges. Three useful
 * classes:
 *
 *  - **Continuous**: even-length cycle whose endpoint edges have opposite
 *    types. For each weak edge in the loop, the digit can be eliminated from
 *    any cell outside the loop that sees every cell of both endpoints.
 *  - **Discontinuous, two strong** (single-cell start only): odd-length chain
 *    starting and ending with a strong edge at the same single-cell node —
 *    that cell is forced to hold the digit.
 *  - **Discontinuous, two weak**: odd-length chain starting and ending with a
 *    weak edge at the same node — the digit can be eliminated from every cell
 *    of the start node.
 *
 * The cycle must include at least one group node; otherwise it would be a
 * regular X-Cycle. The search iterates digits, then start nodes (single cells
 * before groups, row-major), then strong-start before weak-start, and returns
 * the first cycle that yields a placement or at least one elimination.
 */
export function findGroupedXCycle(board: Board): GroupedXCycleResult | null {
  const { variant } = board;
  const grid = buildCandidatesGrid(board);
  const houses = buildHouses(variant);

  // Three passes prioritise cycle quality: continuous > discontinuous-strong
  // (placement) > discontinuous-weak (eliminations from the start node only).
  // Without this, the search would return whichever pattern happens to anchor
  // at the lowest row-major start node, even if a more useful cycle exists
  // elsewhere on the board.
  const passes: Array<{ accept: GroupedXCycleType; startType: 'strong' | 'weak' }> = [
    { accept: 'continuous', startType: 'strong' },
    { accept: 'discontinuous-strong', startType: 'strong' },
    { accept: 'discontinuous-weak', startType: 'weak' },
  ];

  for (const digit of variant.digits) {
    const nodes = buildNodes(variant, grid, digit);
    if (nodes.length === 0) continue;
    let hasGroup = false;
    for (const n of nodes) {
      if (n.isGroup) {
        hasGroup = true;
        break;
      }
    }
    if (!hasGroup) continue;
    const adj = buildAdjacency(grid, digit, nodes, houses);
    if (adj.size === 0) continue;

    const ctx: SearchContext = { variant, grid, digit, adj };

    for (const pass of passes) {
      for (const start of nodes) {
        if (!adj.has(nodeKey(start))) continue;
        const path: GroupedXCycleNode[] = [start];
        const edges: GroupedXCycleEdge[] = [];
        const visited = new Set<string>();
        for (const cell of start.cells) visited.add(posKey(cell));
        const result = dfs(
          ctx,
          start,
          pass.startType,
          path,
          edges,
          visited,
          pass.accept,
        );
        if (result !== null) return result;
      }
    }
  }

  return null;
}
