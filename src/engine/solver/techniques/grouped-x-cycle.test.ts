import { describe, it, expect } from 'vitest';
import {
  findGroupedXCycle,
  type GroupedXCycleElimination,
  type GroupedXCycleNode,
} from './grouped-x-cycle';
import { fixture } from './grouped-x-cycle.fixture';
import { createEmptyBoard, createGivenCell } from '../../types';
import { classicVariant, miniVariant, sixVariant } from '../../variants';
import type { Board, Digit, Position, Variant } from '../../types';

function variantFor(name: 'classic' | 'six' | 'mini'): Variant {
  if (name === 'classic') return classicVariant;
  if (name === 'six') return sixVariant;
  return miniVariant;
}

function parseBoardString(name: 'classic' | 'six' | 'mini', s: string): Board {
  const variant = variantFor(name);
  const cleaned = s.replace(/\s+/g, '');
  const expected = variant.size * variant.size;
  if (cleaned.length !== expected) {
    throw new Error(`Expected ${expected} cells, got ${cleaned.length}`);
  }
  const board = createEmptyBoard(variant);
  for (let i = 0; i < expected; i++) {
    const ch = cleaned[i];
    const r = Math.floor(i / variant.size);
    const c = i % variant.size;
    if (ch === '.' || ch === '0') continue;
    const d = Number.parseInt(ch, 10);
    if (!Number.isInteger(d) || d < 1 || d > variant.size) {
      throw new Error(`Bad cell '${ch}' at index ${i}`);
    }
    board.cells[r][c] = createGivenCell(d as Digit);
  }
  return board;
}

function findElim(
  eliminations: GroupedXCycleElimination[],
  pos: Position,
): GroupedXCycleElimination | undefined {
  return eliminations.find(
    (e) => e.cell.row === pos.row && e.cell.col === pos.col,
  );
}

function nodeCellsKey(node: GroupedXCycleNode): string {
  return [...node.cells]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => `${p.row},${p.col}`)
    .join('|');
}

describe('findGroupedXCycle', () => {
  it('returns null for an empty classic board (no strong links anywhere)', () => {
    const board = createEmptyBoard(classicVariant);
    expect(findGroupedXCycle(board)).toBeNull();
  });

  it('returns null on a Mini board (4×4 has no usable groups for cycles)', () => {
    const board = createEmptyBoard(miniVariant);
    board.cells[0][0] = createGivenCell(1);
    expect(findGroupedXCycle(board)).toBeNull();
  });

  it('does not duplicate the regular X-Cycle (any cycle returned must include a group)', () => {
    // The X-Cycle fixture is a 4-corner classic continuous cycle on digit 1
    // composed entirely of single-cell nodes. findGroupedXCycle must not
    // duplicate that pattern — but on a sparse board it may legitimately find
    // an unrelated grouped pattern. The contract is therefore: the result is
    // either null, or a cycle that contains at least one group node.
    const board = parseBoardString(
      'classic',
      '234.56.78' +
        '.........' +
        '.........' +
        '.........' +
        '.........' +
        '567.82.34' +
        '.........' +
        '.........' +
        '.........',
    );
    const result = findGroupedXCycle(board);
    if (result !== null) {
      expect(result.nodes.some((n) => n.isGroup)).toBe(true);
    }
  });

  it('finds the continuous grouped nice loop in the fixture', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findGroupedXCycle(board);

    expect(result).not.toBeNull();
    expect(result!.technique).toBe('grouped-x-cycle');
    expect(result!.digit).toBe(1);
    expect(result!.cycleType).toBe('continuous');

    // Cycle visits four nodes: the box-1 row-2 group {R1C0, R1C1}, then
    // R1C5, R2C5, R2C2 (all 0-indexed). At least one node must be a group.
    expect(result!.nodes).toHaveLength(4);
    const groupNodes = result!.nodes.filter((n) => n.isGroup);
    expect(groupNodes.length).toBeGreaterThanOrEqual(1);

    // The set of cells visited by the cycle is exactly the five cells of the
    // pattern, regardless of which node the DFS chooses to start from.
    const cycleCells = new Set<string>();
    for (const node of result!.nodes) {
      for (const cell of node.cells) cycleCells.add(`${cell.row},${cell.col}`);
    }
    expect(cycleCells).toEqual(
      new Set(['1,0', '1,1', '1,5', '2,2', '2,5']),
    );

    // The DFS starts row-major at the earliest node with a strong outgoing
    // edge — that is the group G = {R1C0, R1C1}. Verify the precise order
    // and edge types.
    expect(result!.nodes[0].isGroup).toBe(true);
    expect(nodeCellsKey(result!.nodes[0])).toBe('1,0|1,1');
    expect(nodeCellsKey(result!.nodes[1])).toBe('1,5');
    expect(nodeCellsKey(result!.nodes[2])).toBe('2,5');
    expect(nodeCellsKey(result!.nodes[3])).toBe('2,2');

    expect(result!.edges).toHaveLength(4);
    expect(result!.edges.map((e) => e.type)).toEqual([
      'strong',
      'weak',
      'strong',
      'weak',
    ]);
    expect(result!.edges[0].house).toBe('row 2');
    expect(result!.edges[1].house).toBe('column 6');
    expect(result!.edges[2].house).toBe('row 3');
    expect(result!.edges[3].house).toBe('box 1');

    // Continuous cycles produce eliminations, no placement.
    expect(result!.placement).toBeUndefined();

    // Twelve eliminations: the three box-1 row-1 cells, the three box-2 row-1
    // cells, and the six column-6 cells in rows 4-9 (1-indexed).
    expect(result!.eliminations).toHaveLength(12);
    const expectedElims: Position[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 3, col: 5 },
      { row: 4, col: 5 },
      { row: 5, col: 5 },
      { row: 6, col: 5 },
      { row: 7, col: 5 },
      { row: 8, col: 5 },
    ];
    for (const pos of expectedElims) {
      const elim = findElim(result!.eliminations, pos);
      expect(
        elim,
        `expected elimination at (${pos.row}, ${pos.col})`,
      ).toBeDefined();
      expect(elim!.digits).toEqual([1]);
    }

    // None of the cycle cells are themselves eliminations.
    for (const key of ['1,0', '1,1', '1,5', '2,2', '2,5']) {
      const [r, c] = key.split(',').map(Number);
      expect(findElim(result!.eliminations, { row: r, col: c })).toBeUndefined();
    }

    expect(result!.explanation).toContain('Grouped X-Cycle');
    expect(result!.explanation).toContain('continuous');
  });

  it('fixture deduction matches the finder output', () => {
    const board = parseBoardString(fixture.variant, fixture.board);
    const result = findGroupedXCycle(board);

    expect(result).not.toBeNull();
    expect(fixture.deduction.eliminations).toBeDefined();
    for (const expected of fixture.deduction.eliminations!) {
      const got = findElim(result!.eliminations, expected.pos);
      expect(got).toBeDefined();
      expect(got!.digits).toEqual(expected.digits);
    }

    // The fixture's patternCells are exactly the cells visited by the cycle.
    const finderCellSet = new Set<string>();
    for (const node of result!.nodes) {
      for (const cell of node.cells) {
        finderCellSet.add(`${cell.row},${cell.col}`);
      }
    }
    const fixtureCellSet = new Set(
      fixture.patternCells.map((p) => `${p.row},${p.col}`),
    );
    expect(finderCellSet).toEqual(fixtureCellSet);
  });
});
