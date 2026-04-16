export type Digit = number;

export interface Variant {
  id: string;
  size: number;
  boxWidth: number;
  boxHeight: number;
  digits: readonly Digit[];
}

export interface Position {
  row: number;
  col: number;
}

export interface Cell {
  value: Digit | null;
  notes: Set<Digit>;
  given: boolean;
}

export interface Board {
  variant: Variant;
  cells: Cell[][];
}

export type MoveKind = 'place' | 'erase' | 'note-add' | 'note-remove';

export interface Move {
  kind: MoveKind;
  position: Position;
  digit: Digit | null;
  previous: Cell;
}

export function createEmptyCell(given = false): Cell {
  return { value: null, notes: new Set<Digit>(), given };
}

export function createGivenCell(value: Digit): Cell {
  return { value, notes: new Set<Digit>(), given: true };
}

export function cloneCell(cell: Cell): Cell {
  return { value: cell.value, notes: new Set(cell.notes), given: cell.given };
}

export function createEmptyBoard(variant: Variant): Board {
  const cells: Cell[][] = [];
  for (let r = 0; r < variant.size; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < variant.size; c++) {
      row.push(createEmptyCell());
    }
    cells.push(row);
  }
  return { variant, cells };
}

export function cloneBoard(board: Board): Board {
  return {
    variant: board.variant,
    cells: board.cells.map((row) => row.map(cloneCell)),
  };
}
