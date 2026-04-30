import { peers } from '../../peers';
import type { Board, Digit, Position, Variant } from '../../types';

export interface ForcingChainsImplication {
  pos: Position;
  digit: Digit;
}

export interface ForcingChainsBranch {
  /** The candidate hypothesised at the source cell. */
  candidate: Digit;
  /**
   * Sequence of (cell, digit) placements derived from the hypothesis. The
   * first entry is always the source hypothesis; subsequent entries are
   * naked-single and hidden-single placements forced by propagation.
   */
  implications: ForcingChainsImplication[];
  /**
   * True if propagation reached a contradiction (a cell with no candidates,
   * a house missing a required digit, or two conflicting placements). A
   * contradicting branch contributes nothing to the common deduction.
   */
  contradicted: boolean;
}

export interface ForcingChainsElimination {
  cell: Position;
  digits: Digit[];
}

export interface ForcingChainsResult {
  technique: 'forcing-chains';
  /** The cell whose candidates anchor the chains. */
  source: Position;
  /** The source cell's candidates, ascending. */
  sourceDigits: Digit[];
  /** One branch per source candidate, in source-digit ascending order. */
  branches: ForcingChainsBranch[];
  /** A common forced placement (when found), else null. */
  placement: { pos: Position; digit: Digit } | null;
  /** Common forced eliminations (when no placement is found), else empty. */
  eliminations: ForcingChainsElimination[];
  explanation: string;
}

/** Cap chain depth (placements per branch) to keep runtime bounded. */
const MAX_IMPLICATIONS = 50;

interface House {
  cells: Position[];
}

interface BranchState {
  variant: Variant;
  /** Candidate set per empty cell; null for placed (given or propagated). */
  cands: (Set<Digit> | null)[][];
  /** True if the cell holds a value (given or placed during propagation). */
  placed: boolean[][];
  /** The digit placed at the cell (givens or propagation), null otherwise. */
  value: (Digit | null)[][];
  /** Sequence of placements derived during propagation. */
  implications: ForcingChainsImplication[];
  /** Set of (cell, digit) candidate keys eliminated during propagation. */
  eliminated: Set<string>;
  contradicted: boolean;
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
    houses.push({ cells });
  }
  for (let c = 0; c < size; c++) {
    const cells: Position[] = [];
    for (let r = 0; r < size; r++) cells.push({ row: r, col: c });
    houses.push({ cells });
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
      houses.push({ cells });
    }
  }
  return houses;
}

function elimKey(p: Position, d: Digit): string {
  return `${p.row},${p.col},${d}`;
}

function cellKey(p: Position): string {
  return `${p.row},${p.col}`;
}

function buildInitialState(
  board: Board,
  initialGrid: (Set<Digit> | null)[][],
): BranchState {
  const { variant, cells } = board;
  const size = variant.size;
  const cands: (Set<Digit> | null)[][] = [];
  const placed: boolean[][] = [];
  const value: (Digit | null)[][] = [];
  for (let r = 0; r < size; r++) {
    const cr: (Set<Digit> | null)[] = [];
    const pr: boolean[] = [];
    const vr: (Digit | null)[] = [];
    for (let c = 0; c < size; c++) {
      const givenVal = cells[r][c].value;
      if (givenVal != null) {
        cr.push(null);
        pr.push(true);
        vr.push(givenVal);
      } else {
        const orig = initialGrid[r][c];
        cr.push(orig != null ? new Set(orig) : null);
        pr.push(false);
        vr.push(null);
      }
    }
    cands.push(cr);
    placed.push(pr);
    value.push(vr);
  }
  return {
    variant,
    cands,
    placed,
    value,
    implications: [],
    eliminated: new Set<string>(),
    contradicted: false,
  };
}

function placeOne(
  state: BranchState,
  pos: Position,
  digit: Digit,
): void {
  if (state.contradicted) return;
  if (state.implications.length >= MAX_IMPLICATIONS) return;
  if (state.placed[pos.row][pos.col]) {
    if (state.value[pos.row][pos.col] !== digit) {
      state.contradicted = true;
    }
    return;
  }
  const cand = state.cands[pos.row][pos.col];
  if (cand == null || !cand.has(digit)) {
    state.contradicted = true;
    return;
  }

  state.placed[pos.row][pos.col] = true;
  state.value[pos.row][pos.col] = digit;
  state.implications.push({ pos: { row: pos.row, col: pos.col }, digit });

  for (const d of cand) {
    if (d !== digit) state.eliminated.add(elimKey(pos, d));
  }
  state.cands[pos.row][pos.col] = new Set([digit]);

  for (const p of peers(state.variant, pos)) {
    if (state.placed[p.row][p.col]) continue;
    const pCand = state.cands[p.row][p.col];
    if (pCand == null) continue;
    if (pCand.has(digit)) {
      pCand.delete(digit);
      state.eliminated.add(elimKey(p, digit));
      if (pCand.size === 0) {
        state.contradicted = true;
        return;
      }
    }
  }
}

function findNextSingle(
  state: BranchState,
  houses: House[],
): { pos: Position; digit: Digit } | null {
  const size = state.variant.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.placed[r][c]) continue;
      const cand = state.cands[r][c];
      if (cand != null && cand.size === 1) {
        const [d] = cand;
        return { pos: { row: r, col: c }, digit: d };
      }
    }
  }
  for (const house of houses) {
    for (const digit of state.variant.digits) {
      let alreadyPlaced = false;
      let count = 0;
      let only: Position | null = null;
      for (const cp of house.cells) {
        if (state.placed[cp.row][cp.col]) {
          if (state.value[cp.row][cp.col] === digit) {
            alreadyPlaced = true;
            break;
          }
        } else {
          const cellCand = state.cands[cp.row][cp.col];
          if (cellCand != null && cellCand.has(digit)) {
            count++;
            only = cp;
            if (count > 1) break;
          }
        }
      }
      if (alreadyPlaced) continue;
      if (count === 0) {
        state.contradicted = true;
        return null;
      }
      if (count === 1 && only != null) {
        return { pos: only, digit };
      }
    }
  }
  return null;
}

function propagateBranch(
  board: Board,
  initialGrid: (Set<Digit> | null)[][],
  source: Position,
  hypothesis: Digit,
  houses: House[],
): BranchState {
  const state = buildInitialState(board, initialGrid);
  placeOne(state, source, hypothesis);
  while (
    !state.contradicted &&
    state.implications.length < MAX_IMPLICATIONS
  ) {
    const next = findNextSingle(state, houses);
    if (next == null) break;
    placeOne(state, next.pos, next.digit);
  }
  return state;
}

function buildExplanation(
  _source: Position,
  _sourceDigits: Digit[],
  _branches: ForcingChainsBranch[],
  forced:
    | { kind: 'placement'; pos: Position; digit: Digit }
    | { kind: 'elimination'; eliminations: ForcingChainsElimination[] },
): string {
  if (forced.kind === 'placement') {
    return `Every possible number for the highlighted cell leads to placing ${forced.digit}. Put ${forced.digit} in the highlighted cell.`;
  } else {
    return `Every possible number for the highlighted cell leads to the same removal. Remove the highlighted candidates from those cells.`;
  }
}

/**
 * Forcing Chains: pick a cell with N candidates {d1, ..., dN}; for each
 * candidate, hypothesise it as the cell's value and follow the chain of
 * naked-single and hidden-single implications that flow from it. If every
 * non-contradicting branch ends up placing the same digit at the same cell,
 * that placement is forced; if every non-contradicting branch eliminates the
 * same (cell, digit) candidate, that elimination is forced.
 *
 * Branches that hit a contradiction (a cell with no candidates, a house with
 * no place for one of its digits, or two conflicting forced placements) are
 * excluded from the intersection — their hypothesis is impossible. If only
 * one branch is non-contradictory, its full set of implications is forced.
 *
 * Per branch the search is bounded to {@link MAX_IMPLICATIONS} placements,
 * which keeps the worst case linear in board size and far short of solving
 * the puzzle outright.
 *
 * Iteration order is deterministic: source cells are ranked first by
 * candidate count ascending (smaller cells produce shorter, easier-to-read
 * chains), then row-major. Candidates within a source are tried ascending.
 * Common placements are preferred over common eliminations, then ordered
 * row-major + digit ascending. The first valid deduction is returned.
 */
export function findForcingChains(board: Board): ForcingChainsResult | null {
  const { variant } = board;
  const initialGrid = buildCandidatesGrid(board);
  const houses = buildHouses(variant);

  const sources: { pos: Position; digits: Digit[] }[] = [];
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      const cand = initialGrid[r][c];
      if (cand != null && cand.size >= 2) {
        const digits = [...cand].sort((a, b) => a - b);
        sources.push({ pos: { row: r, col: c }, digits });
      }
    }
  }
  sources.sort((a, b) => {
    const da = a.digits.length - b.digits.length;
    if (da !== 0) return da;
    return a.pos.row - b.pos.row || a.pos.col - b.pos.col;
  });

  for (const src of sources) {
    const { pos: source, digits: sourceDigits } = src;
    const branches: ForcingChainsBranch[] = [];
    const placementsPerBranch: (Map<string, Digit> | null)[] = [];
    const eliminationsPerBranch: (Set<string> | null)[] = [];
    let allContradicted = true;

    for (const d of sourceDigits) {
      const state = propagateBranch(board, initialGrid, source, d, houses);
      branches.push({
        candidate: d,
        implications: state.implications,
        contradicted: state.contradicted,
      });
      if (state.contradicted) {
        placementsPerBranch.push(null);
        eliminationsPerBranch.push(null);
      } else {
        allContradicted = false;
        const placedMap = new Map<string, Digit>();
        for (const impl of state.implications) {
          if (impl.pos.row === source.row && impl.pos.col === source.col) {
            continue;
          }
          placedMap.set(cellKey(impl.pos), impl.digit);
        }
        placementsPerBranch.push(placedMap);
        eliminationsPerBranch.push(state.eliminated);
      }
    }

    if (allContradicted) continue;

    let intersectPlacements: Map<string, Digit> | null = null;
    for (const pm of placementsPerBranch) {
      if (pm == null) continue;
      if (intersectPlacements == null) {
        intersectPlacements = new Map(pm);
      } else {
        for (const [k, v] of [...intersectPlacements]) {
          if (pm.get(k) !== v) intersectPlacements.delete(k);
        }
      }
    }

    if (intersectPlacements != null && intersectPlacements.size > 0) {
      const entries = [...intersectPlacements.entries()].map(([k, d]) => {
        const [r, c] = k.split(',').map(Number);
        return { pos: { row: r, col: c }, digit: d };
      });
      entries.sort(
        (a, b) =>
          a.pos.row - b.pos.row ||
          a.pos.col - b.pos.col ||
          a.digit - b.digit,
      );
      const chosen = entries[0];
      const explanation = buildExplanation(source, sourceDigits, branches, {
        kind: 'placement',
        pos: chosen.pos,
        digit: chosen.digit,
      });
      return {
        technique: 'forcing-chains',
        source,
        sourceDigits,
        branches,
        placement: { pos: chosen.pos, digit: chosen.digit },
        eliminations: [],
        explanation,
      };
    }

    let intersectElims: Set<string> | null = null;
    for (const es of eliminationsPerBranch) {
      if (es == null) continue;
      if (intersectElims == null) {
        intersectElims = new Set(es);
      } else {
        for (const k of [...intersectElims]) {
          if (!es.has(k)) intersectElims.delete(k);
        }
      }
    }

    if (intersectElims != null && intersectElims.size > 0) {
      const elimsByCell = new Map<string, ForcingChainsElimination>();
      for (const k of intersectElims) {
        const [rs, cs, ds] = k.split(',');
        const r = Number(rs);
        const c = Number(cs);
        const d = Number(ds) as Digit;
        if (r === source.row && c === source.col) continue;
        const ck = `${r},${c}`;
        let entry = elimsByCell.get(ck);
        if (entry == null) {
          entry = { cell: { row: r, col: c }, digits: [] };
          elimsByCell.set(ck, entry);
        }
        if (!entry.digits.includes(d)) entry.digits.push(d);
      }
      if (elimsByCell.size > 0) {
        const eliminations = [...elimsByCell.values()].sort(
          (a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col,
        );
        for (const e of eliminations) e.digits.sort((a, b) => a - b);
        const explanation = buildExplanation(source, sourceDigits, branches, {
          kind: 'elimination',
          eliminations,
        });
        return {
          technique: 'forcing-chains',
          source,
          sourceDigits,
          branches,
          placement: null,
          eliminations,
          explanation,
        };
      }
    }
  }

  return null;
}
