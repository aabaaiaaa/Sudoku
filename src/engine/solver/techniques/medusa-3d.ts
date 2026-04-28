import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface Medusa3DNode {
  cell: Position;
  digit: Digit;
}

export interface Medusa3DElimination {
  cell: Position;
  digits: Digit[];
}

export type Medusa3DRule =
  /** Two same-colored candidates in a single cell — that color is invalid. */
  | 'color-twice-in-cell'
  /** Two same-colored cells for the same digit in a single house — that color
   *  is invalid. */
  | 'color-twice-in-house'
  /** A non-cluster candidate sees both colors of the same digit. */
  | 'sees-both-colors';

export interface Medusa3DResult {
  technique: '3d-medusa';
  /** Cluster nodes colored A, sorted (row, col, digit). */
  colorA: Medusa3DNode[];
  /** Cluster nodes colored B, sorted (row, col, digit). */
  colorB: Medusa3DNode[];
  /** Which rule produced the eliminations. */
  rule: Medusa3DRule;
  /** For 'color-*' rules: the color invalidated (and therefore eliminated). */
  invalidColor: 'A' | 'B' | null;
  /** For 'color-twice-in-cell': the cell containing two same-colored digits. */
  conflictCell: Position | null;
  /** For 'color-twice-in-cell': the two digits in that cell, in ascending order. */
  conflictDigits: [Digit, Digit] | null;
  /** For 'color-twice-in-house': the house description. */
  conflictHouse: string | null;
  /** For 'color-twice-in-house': the digit and the two cells. */
  conflictHouseDigit: Digit | null;
  conflictHouseCells: [Position, Position] | null;
  eliminations: Medusa3DElimination[];
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

function nodeKey(row: number, col: number, digit: Digit): string {
  return `${row},${col},${digit}`;
}

function parseNodeKey(key: string): Medusa3DNode {
  const [r, c, d] = key.split(',').map(Number);
  return { cell: { row: r, col: c }, digit: d };
}

function nodeOrder(a: Medusa3DNode, b: Medusa3DNode): number {
  return (
    a.cell.row - b.cell.row ||
    a.cell.col - b.cell.col ||
    a.digit - b.digit
  );
}

function cellLabel(p: Position): string {
  return `R${p.row + 1}C${p.col + 1}`;
}

function nodeLabel(n: Medusa3DNode): string {
  return `${n.digit}@${cellLabel(n.cell)}`;
}

/**
 * 3D Medusa: an extension of Simple Coloring that colors candidates across
 * multiple digits simultaneously.
 *
 * Build a graph whose nodes are the (cell, digit) pairs of every candidate.
 * Two nodes are connected by a strong link when one of them must be the digit
 * if the other is not:
 *
 *   1. **Cell link**: a bivalue cell with candidates {d1, d2} contributes the
 *      edge (cell, d1) — (cell, d2). Exactly one of the two candidates is the
 *      true value.
 *   2. **House link**: in any house where some digit has exactly two candidate
 *      cells, those two cells are joined for that digit. Exactly one of them
 *      holds the digit.
 *
 * Two-color each connected component (cluster). Within a cluster, exactly one
 * colour is "true": every node in the true colour is the value of its cell;
 * every node in the false colour is not. Three rules detect a contradiction
 * or yield eliminations:
 *
 *   - **Twice in a cell** (Rule 1): if two candidates in a single cell share a
 *     colour, that colour cannot be true (the cell would need both digits).
 *   - **Twice in a house** (Rule 2): if two cells of a single house share a
 *     colour for the same digit, that colour cannot be true (the digit would
 *     appear twice in the house).
 *   - **Sees both colours** (Rule 4): if a non-cluster candidate (cell, digit)
 *     shares a house with a cluster cell coloured A *and* a cluster cell
 *     coloured B that both hold the same digit, then whichever colour is true,
 *     the candidate is eliminated.
 *
 * Iteration order is deterministic. Components are visited in row-major order
 * of their lowest (row, col, digit) node. Within a component, conflict checks
 * iterate digits ascending, then houses (rows, columns, boxes), then cell
 * pairs in row-major order; Rule 1 is checked before Rule 2 per cell. The
 * first rule firing returns its eliminations.
 */
export function find3DMedusa(board: Board): Medusa3DResult | null {
  const { variant } = board;
  const grid = buildCandidatesGrid(board);
  const houses = buildHouses(variant);

  // Build adjacency over (cell, digit) nodes.
  const adjacency = new Map<string, string[]>();
  const addEdge = (a: string, b: string): void => {
    const adjA = adjacency.get(a) ?? [];
    if (!adjA.includes(b)) adjA.push(b);
    adjacency.set(a, adjA);
    const adjB = adjacency.get(b) ?? [];
    if (!adjB.includes(a)) adjB.push(a);
    adjacency.set(b, adjB);
  };

  // Cell strong links from bivalue cells.
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      const cand = grid[r][c];
      if (cand == null || cand.size !== 2) continue;
      const [d1, d2] = [...cand].sort((a, b) => a - b);
      addEdge(nodeKey(r, c, d1), nodeKey(r, c, d2));
    }
  }

  // House strong links: for each (house, digit) with exactly two candidate
  // cells, link those two cells for that digit.
  for (const house of houses) {
    for (const digit of variant.digits) {
      const cellsWithDigit: Position[] = [];
      for (const cell of house.cells) {
        const cand = grid[cell.row][cell.col];
        if (cand != null && cand.has(digit)) cellsWithDigit.push(cell);
      }
      if (cellsWithDigit.length === 2) {
        addEdge(
          nodeKey(cellsWithDigit[0].row, cellsWithDigit[0].col, digit),
          nodeKey(cellsWithDigit[1].row, cellsWithDigit[1].col, digit),
        );
      }
    }
  }

  if (adjacency.size === 0) return null;

  // Order nodes for deterministic component traversal.
  const allNodeKeys: string[] = [];
  for (const k of adjacency.keys()) allNodeKeys.push(k);
  allNodeKeys.sort((ka, kb) => nodeOrder(parseNodeKey(ka), parseNodeKey(kb)));

  const visited = new Set<string>();

  for (const startKey of allNodeKeys) {
    if (visited.has(startKey)) continue;

    // BFS-color the component.
    const color = new Map<string, 'A' | 'B'>();
    color.set(startKey, 'A');
    visited.add(startKey);
    const queue: string[] = [startKey];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const next: 'A' | 'B' = color.get(cur) === 'A' ? 'B' : 'A';
      for (const n of adjacency.get(cur) ?? []) {
        if (color.has(n)) continue;
        color.set(n, next);
        visited.add(n);
        queue.push(n);
      }
    }

    if (color.size < 2) continue;

    const colorA: Medusa3DNode[] = [];
    const colorB: Medusa3DNode[] = [];
    const colorOf = new Map<string, 'A' | 'B'>();
    for (const [k, c] of color) {
      colorOf.set(k, c);
      const node = parseNodeKey(k);
      if (c === 'A') colorA.push(node);
      else colorB.push(node);
    }
    colorA.sort(nodeOrder);
    colorB.sort(nodeOrder);

    // Set of cluster node keys for fast lookup.
    const clusterKeys = new Set<string>();
    for (const k of color.keys()) clusterKeys.add(k);

    // Index nodes for rule checks.
    // cellsByColor[color]: map from cell key to digits coloured that colour
    // at that cell (so a cell can have one or two digits per colour).
    const cellNodes = new Map<string, Medusa3DNode[]>();
    for (const node of [...colorA, ...colorB]) {
      const ck = `${node.cell.row},${node.cell.col}`;
      const arr = cellNodes.get(ck) ?? [];
      arr.push(node);
      cellNodes.set(ck, arr);
    }

    // ------------------------------------------------------------
    // Rule 1: two same-coloured candidates in a single cell.
    // ------------------------------------------------------------
    let rule1Color: 'A' | 'B' | null = null;
    let rule1Cell: Position | null = null;
    let rule1Digits: [Digit, Digit] | null = null;
    // Iterate cells in row-major order.
    const cellKeysInOrder = [...cellNodes.keys()].sort((a, b) => {
      const [ar, ac] = a.split(',').map(Number);
      const [br, bc] = b.split(',').map(Number);
      return ar - br || ac - bc;
    });
    outer1: for (const ck of cellKeysInOrder) {
      const nodes = cellNodes.get(ck)!;
      for (const which of ['A', 'B'] as const) {
        const sameColor = nodes
          .filter((n) => colorOf.get(nodeKey(n.cell.row, n.cell.col, n.digit)) === which)
          .sort((a, b) => a.digit - b.digit);
        if (sameColor.length >= 2) {
          rule1Color = which;
          rule1Cell = sameColor[0].cell;
          rule1Digits = [sameColor[0].digit, sameColor[1].digit];
          break outer1;
        }
      }
    }

    if (rule1Color !== null && rule1Cell !== null && rule1Digits !== null) {
      const eliminations = buildColorEliminations(
        rule1Color === 'A' ? colorA : colorB,
      );
      const invalidNodes = (rule1Color === 'A' ? colorA : colorB)
        .map(nodeLabel)
        .join(',');
      const explanation =
        `3D Medusa: cluster A=[${colorA.map(nodeLabel).join(',')}] B=[${colorB.map(nodeLabel).join(',')}]; ` +
        `colour ${rule1Color} contains both ${rule1Digits[0]} and ${rule1Digits[1]} at ${cellLabel(rule1Cell)}, ` +
        `so colour ${rule1Color} is invalid; eliminate ${invalidNodes}`;
      return {
        technique: '3d-medusa',
        colorA,
        colorB,
        rule: 'color-twice-in-cell',
        invalidColor: rule1Color,
        conflictCell: rule1Cell,
        conflictDigits: rule1Digits,
        conflictHouse: null,
        conflictHouseDigit: null,
        conflictHouseCells: null,
        eliminations,
        explanation,
      };
    }

    // ------------------------------------------------------------
    // Rule 2: two same-coloured cells for the same digit in a house.
    // ------------------------------------------------------------
    let rule2Color: 'A' | 'B' | null = null;
    let rule2Digit: Digit | null = null;
    let rule2House: string | null = null;
    let rule2Cells: [Position, Position] | null = null;
    outer2: for (const digit of variant.digits) {
      for (const house of houses) {
        const inCluster: { cell: Position; col: 'A' | 'B' }[] = [];
        for (const cell of house.cells) {
          const k = nodeKey(cell.row, cell.col, digit);
          const c = colorOf.get(k);
          if (c !== undefined) inCluster.push({ cell, col: c });
        }
        // Sort by row-major within the house.
        inCluster.sort(
          (a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col,
        );
        for (const which of ['A', 'B'] as const) {
          const same = inCluster.filter((e) => e.col === which);
          if (same.length >= 2) {
            rule2Color = which;
            rule2Digit = digit;
            rule2House = house.description;
            rule2Cells = [same[0].cell, same[1].cell];
            break outer2;
          }
        }
      }
    }

    if (
      rule2Color !== null &&
      rule2Digit !== null &&
      rule2House !== null &&
      rule2Cells !== null
    ) {
      const eliminations = buildColorEliminations(
        rule2Color === 'A' ? colorA : colorB,
      );
      const invalidNodes = (rule2Color === 'A' ? colorA : colorB)
        .map(nodeLabel)
        .join(',');
      const explanation =
        `3D Medusa: cluster A=[${colorA.map(nodeLabel).join(',')}] B=[${colorB.map(nodeLabel).join(',')}]; ` +
        `colour ${rule2Color} places ${rule2Digit} at both ${cellLabel(rule2Cells[0])} and ${cellLabel(rule2Cells[1])} in ${rule2House}, ` +
        `so colour ${rule2Color} is invalid; eliminate ${invalidNodes}`;
      return {
        technique: '3d-medusa',
        colorA,
        colorB,
        rule: 'color-twice-in-house',
        invalidColor: rule2Color,
        conflictCell: null,
        conflictDigits: null,
        conflictHouse: rule2House,
        conflictHouseDigit: rule2Digit,
        conflictHouseCells: rule2Cells,
        eliminations,
        explanation,
      };
    }

    // ------------------------------------------------------------
    // Rule 4: a non-cluster candidate sees both colours of its digit.
    // ------------------------------------------------------------
    const elims: Medusa3DElimination[] = [];
    for (let r = 0; r < variant.size; r++) {
      for (let c = 0; c < variant.size; c++) {
        const cand = grid[r][c];
        if (cand == null) continue;
        const target: Position = { row: r, col: c };
        const eliminated: Digit[] = [];
        for (const digit of variant.digits) {
          if (!cand.has(digit)) continue;
          if (clusterKeys.has(nodeKey(r, c, digit))) continue;
          let seesA = false;
          let seesB = false;
          for (const node of colorA) {
            if (node.digit !== digit) continue;
            if (sharesHouse(variant, target, node.cell)) {
              seesA = true;
              break;
            }
          }
          if (!seesA) continue;
          for (const node of colorB) {
            if (node.digit !== digit) continue;
            if (sharesHouse(variant, target, node.cell)) {
              seesB = true;
              break;
            }
          }
          if (seesA && seesB) eliminated.push(digit);
        }
        if (eliminated.length > 0) {
          eliminated.sort((a, b) => a - b);
          elims.push({ cell: target, digits: eliminated });
        }
      }
    }

    if (elims.length > 0) {
      const elimList = elims
        .map((e) => `${cellLabel(e.cell)}={${e.digits.join(',')}}`)
        .join(',');
      const explanation =
        `3D Medusa: cluster A=[${colorA.map(nodeLabel).join(',')}] B=[${colorB.map(nodeLabel).join(',')}]; ` +
        `each eliminated candidate sees both an A and a B node for its digit; eliminate ${elimList}`;
      return {
        technique: '3d-medusa',
        colorA,
        colorB,
        rule: 'sees-both-colors',
        invalidColor: null,
        conflictCell: null,
        conflictDigits: null,
        conflictHouse: null,
        conflictHouseDigit: null,
        conflictHouseCells: null,
        eliminations: elims,
        explanation,
      };
    }
  }

  return null;
}

function buildColorEliminations(
  nodes: Medusa3DNode[],
): Medusa3DElimination[] {
  const byCell = new Map<string, { cell: Position; digits: Set<Digit> }>();
  for (const n of nodes) {
    const key = `${n.cell.row},${n.cell.col}`;
    const entry = byCell.get(key) ?? { cell: n.cell, digits: new Set<Digit>() };
    entry.digits.add(n.digit);
    byCell.set(key, entry);
  }
  const out: Medusa3DElimination[] = [];
  for (const [, entry] of byCell) {
    const digits = [...entry.digits].sort((a, b) => a - b);
    out.push({ cell: entry.cell, digits });
  }
  out.sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
  return out;
}
