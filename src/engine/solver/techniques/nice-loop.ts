import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface NiceLoopElimination {
  cell: Position;
  digits: Digit[];
}

export type NiceLoopType =
  | 'continuous'
  | 'discontinuous-strong'
  | 'discontinuous-weak';

export interface NiceLoopNode {
  pos: Position;
  digit: Digit;
}

export interface NiceLoopEdge {
  from: NiceLoopNode;
  to: NiceLoopNode;
  type: 'strong' | 'weak';
  /** 'inter-cell' = same digit in two cells; 'intra-cell' = two digits in one cell. */
  kind: 'inter-cell' | 'intra-cell';
  /** House description for inter-cell links, or `cell RxCy` for intra-cell. */
  witness: string;
}

export interface NiceLoopPlacement {
  pos: Position;
  digit: Digit;
}

export interface NiceLoopResult {
  technique: 'nice-loop';
  cycleType: NiceLoopType;
  /** Sequence of (cell, digit) candidates around the cycle. */
  nodes: NiceLoopNode[];
  /** Edges in cycle order. edges[i] connects nodes[i] and nodes[(i+1) % n]. */
  edges: NiceLoopEdge[];
  /** For 'discontinuous-strong': the (cell, digit) forced to be true. */
  placement?: NiceLoopPlacement;
  eliminations: NiceLoopElimination[];
  explanation: string;
}

interface House {
  cells: Position[];
  description: string;
}

interface AdjEntry {
  to: NiceLoopNode;
  isStrong: boolean;
  kind: 'inter-cell' | 'intra-cell';
  witness: string;
}

const MAX_LEN = 12;

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

function nodeKey(n: NiceLoopNode): string {
  return `${n.pos.row},${n.pos.col},${n.digit}`;
}

function samePos(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function sameNode(a: NiceLoopNode, b: NiceLoopNode): boolean {
  return samePos(a.pos, b.pos) && a.digit === b.digit;
}

function rowMajor(a: Position, b: Position): number {
  return a.row - b.row || a.col - b.col;
}

function compareNodes(a: NiceLoopNode, b: NiceLoopNode): number {
  const c = rowMajor(a.pos, b.pos);
  if (c !== 0) return c;
  return a.digit - b.digit;
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

function formatCell(p: Position): string {
  return `R${p.row + 1}C${p.col + 1}`;
}


function buildAdjacency(
  variant: Variant,
  grid: (Set<Digit> | null)[][],
  houses: House[],
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();
  const size = variant.size;

  function addEdge(
    from: NiceLoopNode,
    to: NiceLoopNode,
    isStrong: boolean,
    kind: 'inter-cell' | 'intra-cell',
    witness: string,
  ): void {
    const key = nodeKey(from);
    let list = adj.get(key);
    if (!list) {
      list = [];
      adj.set(key, list);
    }
    const existing = list.find((e) => sameNode(e.to, to));
    if (existing) {
      // Upgrade weak entry to strong on a stronger witness.
      if (isStrong && !existing.isStrong) {
        existing.isStrong = true;
        existing.kind = kind;
        existing.witness = witness;
      }
      return;
    }
    list.push({ to, isStrong, kind, witness });
  }

  // Intra-cell links: two different digits in the same cell. Strong when the
  // cell is bivalue, weak otherwise.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cand = grid[r][c];
      if (cand == null) continue;
      const digits = [...cand].sort((a, b) => a - b);
      const isBivalue = digits.length === 2;
      const witness = `cell ${formatCell({ row: r, col: c })}`;
      for (let i = 0; i < digits.length; i++) {
        for (let j = 0; j < digits.length; j++) {
          if (i === j) continue;
          const from: NiceLoopNode = {
            pos: { row: r, col: c },
            digit: digits[i],
          };
          const to: NiceLoopNode = {
            pos: { row: r, col: c },
            digit: digits[j],
          };
          addEdge(from, to, isBivalue, 'intra-cell', witness);
        }
      }
    }
  }

  // Inter-cell links: same digit in two cells of a shared house. Strong when
  // those are the only two cells of the house with the digit, weak otherwise.
  for (const digit of variant.digits) {
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
          const from: NiceLoopNode = { pos: inHouse[i], digit };
          const to: NiceLoopNode = { pos: inHouse[j], digit };
          addEdge(from, to, isStrong, 'inter-cell', house.description);
        }
      }
    }
  }

  return adj;
}

interface SearchContext {
  variant: Variant;
  grid: (Set<Digit> | null)[][];
  adj: Map<string, AdjEntry[]>;
}

function dfs(
  ctx: SearchContext,
  start: NiceLoopNode,
  startType: 'strong' | 'weak',
  path: NiceLoopNode[],
  edges: NiceLoopEdge[],
  visited: Set<string>,
): NiceLoopResult | null {
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
    // Strong alternation slot requires a strong-capable edge; weak slot accepts
    // any edge (a strong edge is also a valid weak edge).
    if (nextType === 'strong' && !entry.isStrong) continue;
    const next = entry.to;

    if (sameNode(next, start)) {
      // Closure classification follows directly from path parity. The dfs
      // alternates strict strong/weak after the first edge, so the closing
      // edge type equals startType iff path.length is odd. Even closures with
      // alternating endpoints are continuous; odd closures with matching
      // endpoints are discontinuous (strong-strong forces a placement,
      // weak-weak forces an elimination).
      let cycleType: NiceLoopType | null = null;
      if (path.length >= 4 && path.length % 2 === 0 && startType !== nextType) {
        cycleType = 'continuous';
      } else if (
        path.length >= 3 &&
        path.length % 2 === 1 &&
        startType === nextType
      ) {
        cycleType =
          startType === 'strong'
            ? 'discontinuous-strong'
            : 'discontinuous-weak';
      }
      if (cycleType === null) continue;
      const closingEdge: NiceLoopEdge = {
        from: current,
        to: start,
        type: nextType,
        kind: entry.kind,
        witness: entry.witness,
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

    if (visited.has(nodeKey(next))) continue;
    if (path.length + 1 > MAX_LEN) continue;

    const newEdge: NiceLoopEdge = {
      from: current,
      to: next,
      type: nextType,
      kind: entry.kind,
      witness: entry.witness,
    };

    path.push(next);
    edges.push(newEdge);
    visited.add(nodeKey(next));

    const result = dfs(ctx, start, startType, path, edges, visited);
    if (result !== null) return result;

    path.pop();
    edges.pop();
    visited.delete(nodeKey(next));
  }

  return null;
}

function buildResult(
  ctx: SearchContext,
  nodes: NiceLoopNode[],
  edges: NiceLoopEdge[],
  cycleType: NiceLoopType,
): NiceLoopResult | null {
  if (cycleType === 'continuous') {
    return buildContinuousResult(ctx, nodes, edges);
  }
  if (cycleType === 'discontinuous-strong') {
    return buildDiscontinuousStrongResult(ctx, nodes, edges);
  }
  return buildDiscontinuousWeakResult(ctx, nodes, edges);
}

function buildContinuousResult(
  ctx: SearchContext,
  nodes: NiceLoopNode[],
  edges: NiceLoopEdge[],
): NiceLoopResult | null {
  const { variant, grid } = ctx;
  const nodeKeys = new Set(nodes.map(nodeKey));
  const elimMap = new Map<string, NiceLoopElimination>();

  function addElim(cell: Position, digit: Digit): void {
    const k = `${cell.row},${cell.col}`;
    const existing = elimMap.get(k);
    if (existing) {
      if (!existing.digits.includes(digit)) existing.digits.push(digit);
    } else {
      elimMap.set(k, { cell, digits: [digit] });
    }
  }

  for (const edge of edges) {
    if (edge.type !== 'weak') continue;
    if (edge.kind === 'inter-cell') {
      // Continuous loop forces exactly one of the two endpoints to take this
      // digit. Any cell outside the loop's footprint for this digit that sees
      // both endpoints can have the digit eliminated.
      const digit = edge.from.digit;
      for (let r = 0; r < variant.size; r++) {
        for (let c = 0; c < variant.size; c++) {
          const cand = grid[r][c];
          if (cand == null) continue;
          if (!cand.has(digit)) continue;
          const target: Position = { row: r, col: c };
          if (samePos(target, edge.from.pos)) continue;
          if (samePos(target, edge.to.pos)) continue;
          if (nodeKeys.has(nodeKey({ pos: target, digit }))) continue;
          if (!sharesHouse(variant, target, edge.from.pos)) continue;
          if (!sharesHouse(variant, target, edge.to.pos)) continue;
          addElim(target, digit);
        }
      }
    } else {
      // Continuous loop forces the cell to equal one of the loop's digits at
      // that cell. Any other candidate at the cell can be eliminated.
      const cell = edge.from.pos;
      const cand = grid[cell.row][cell.col];
      if (cand == null) continue;
      const loopDigitsAtCell = new Set<Digit>();
      for (const n of nodes) {
        if (samePos(n.pos, cell)) loopDigitsAtCell.add(n.digit);
      }
      for (const d of cand) {
        if (loopDigitsAtCell.has(d)) continue;
        addElim(cell, d);
      }
    }
  }

  if (elimMap.size === 0) return null;

  const eliminations = [...elimMap.values()].sort((a, b) =>
    rowMajor(a.cell, b.cell),
  );
  for (const e of eliminations) e.digits.sort((a, b) => a - b);

  const explanation = `Nice Loop (continuous): the highlighted cells form a closed loop. Switching back and forth between two options works without contradiction — remove any number ruled out by both directions.`;

  return {
    technique: 'nice-loop',
    cycleType: 'continuous',
    nodes,
    edges,
    eliminations,
    explanation,
  };
}

function buildDiscontinuousStrongResult(
  ctx: SearchContext,
  nodes: NiceLoopNode[],
  edges: NiceLoopEdge[],
): NiceLoopResult | null {
  // Two strong links meet at the start node. Assuming the start node is false
  // forces both adjacent strong-link partners to be true, and the alternation
  // closes the chain to a contradiction — so the start node is true. The
  // (cell, digit) at nodes[0] is placed.
  const start = nodes[0];
  const cand = ctx.grid[start.pos.row][start.pos.col];
  if (cand == null || !cand.has(start.digit)) return null;

  const explanation = `Nice Loop (discontinuous): the loop breaks at one cell — the same conclusion follows from both directions. The number at that cell is forced — place it.`;

  return {
    technique: 'nice-loop',
    cycleType: 'discontinuous-strong',
    nodes,
    edges,
    placement: { pos: start.pos, digit: start.digit },
    eliminations: [],
    explanation,
  };
}

function buildDiscontinuousWeakResult(
  ctx: SearchContext,
  nodes: NiceLoopNode[],
  edges: NiceLoopEdge[],
): NiceLoopResult | null {
  // Two weak links meet at the start node. Assuming the start node is true
  // forces both adjacent weak-link partners to be false, and the alternation
  // around the chain closes with a contradiction — so the start node must be
  // false. The digit is eliminated from the start cell.
  const start = nodes[0];
  const cand = ctx.grid[start.pos.row][start.pos.col];
  if (cand == null || !cand.has(start.digit)) return null;

  const explanation = `Nice Loop (discontinuous): the loop breaks at one cell — the same conclusion follows from both directions. Remove the number the loop rules out at that cell.`;

  return {
    technique: 'nice-loop',
    cycleType: 'discontinuous-weak',
    nodes,
    edges,
    eliminations: [{ cell: start.pos, digits: [start.digit] }],
    explanation,
  };
}

/**
 * Nice Loop — continuous and discontinuous cases.
 *
 * Generalises X-Cycle to multi-digit chains. Each node is a (cell, digit)
 * candidate; edges come in two flavours:
 *
 *  - **inter-cell**: same digit, two cells sharing a house. Strong when the
 *    digit appears in only those two cells of the house (conjugate); weak
 *    otherwise.
 *  - **intra-cell**: two different digits in the same cell. Strong when the
 *    cell has only those two as candidates (bivalue); weak otherwise.
 *
 * A nice loop is a closed cycle whose edges alternate strong/weak. There are
 * three useful classes:
 *
 *  - **Continuous**: even-length cycle whose endpoint edges have opposite
 *    types (strong-..-weak or weak-..-strong). The alternation wraps cleanly,
 *    letting each weak link tighten from "at most one true" to "exactly one
 *    true." Each weak edge contributes eliminations:
 *    - inter-cell weak link with digit d, cells A and B: any cell outside the
 *      loop's digit-d footprint that sees both A and B can have d removed.
 *    - intra-cell weak link in cell C: every candidate of C not visited by
 *      the loop at C can be removed.
 *  - **Discontinuous-strong**: odd-length cycle starting and ending with a
 *    strong edge at the same node. That (cell, digit) is forced true — a
 *    placement.
 *  - **Discontinuous-weak**: odd-length cycle starting and ending with a weak
 *    edge at the same node. That (cell, digit) is forced false — the digit
 *    is eliminated from the cell.
 *
 * The search iterates start nodes in row-major (then digit) order, tries each
 * with starting alternation seed strong then weak, and returns the first
 * cycle that yields at least one elimination or a placement.
 */
export function findNiceLoop(board: Board): NiceLoopResult | null {
  const { variant } = board;
  const grid = buildCandidatesGrid(board);
  const houses = buildHouses(variant);
  const adj = buildAdjacency(variant, grid, houses);

  if (adj.size === 0) return null;

  const ctx: SearchContext = { variant, grid, adj };

  const startKeys = [...adj.keys()];
  const starts: NiceLoopNode[] = startKeys.map((k) => {
    const [r, c, d] = k.split(',').map(Number);
    return { pos: { row: r, col: c }, digit: d as Digit };
  });
  starts.sort(compareNodes);

  for (const start of starts) {
    for (const startType of ['strong', 'weak'] as const) {
      const path: NiceLoopNode[] = [start];
      const edges: NiceLoopEdge[] = [];
      const visited = new Set<string>();
      visited.add(nodeKey(start));
      const result = dfs(ctx, start, startType, path, edges, visited);
      if (result !== null) return result;
    }
  }

  return null;
}
