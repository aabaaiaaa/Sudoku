import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import type { Cell, Digit, Position, Variant } from '../engine/types';
import { findConflicts } from '../engine/board';

interface BoardProps {
  store?: typeof gameStore;
  onSelectCell?: (pos: Position) => void;
}

interface CellViewProps {
  cell: Cell;
  row: number;
  col: number;
  variant: Variant;
  selected: boolean;
  conflict: boolean;
  onClick: () => void;
}

/** Returns Tailwind border classes that render thicker lines at box boundaries. */
function cellBorderClasses(row: number, col: number, variant: Variant): string {
  const classes: string[] = [];
  // Always draw a thin border on every cell; then override the right / bottom
  // edges at box boundaries with a thicker border. The outermost edges are
  // covered by the outer ring on the container, so we only need to worry about
  // internal separators here.
  classes.push('border border-gray-400');

  // Thicker right border at box column boundaries (not the last column — outer ring handles that).
  if ((col + 1) % variant.boxWidth === 0 && col !== variant.size - 1) {
    classes.push('border-r-2 border-r-gray-900');
  }
  // Thicker bottom border at box row boundaries (not the last row).
  if ((row + 1) % variant.boxHeight === 0 && row !== variant.size - 1) {
    classes.push('border-b-2 border-b-gray-900');
  }
  // Thicker left border at box column start (not the first column).
  if (col % variant.boxWidth === 0 && col !== 0) {
    classes.push('border-l-2 border-l-gray-900');
  }
  // Thicker top border at box row start (not the first row).
  if (row % variant.boxHeight === 0 && row !== 0) {
    classes.push('border-t-2 border-t-gray-900');
  }

  return classes.join(' ');
}

function CellView({ cell, row, col, variant, selected, conflict, onClick }: CellViewProps) {
  const borderClasses = cellBorderClasses(row, col, variant);
  const bgClass = conflict
    ? 'bg-red-200'
    : selected
      ? 'bg-blue-200'
      : cell.given
        ? 'bg-gray-100'
        : 'bg-white';
  const textClass = cell.given ? 'text-gray-900 font-bold' : 'text-blue-700';
  const conflictClass = conflict ? 'conflict' : '';

  return (
    <button
      type="button"
      data-testid={`cell-r${row}-c${col}`}
      onClick={onClick}
      className={`aspect-square w-full flex items-center justify-center select-none ${bgClass} ${borderClasses} ${textClass} ${conflictClass} focus:outline-none`}
    >
      {cell.value != null ? (
        <span className="text-xl sm:text-2xl">{cell.value}</span>
      ) : cell.notes.size > 0 ? (
        <NotesGrid notes={cell.notes} variant={variant} />
      ) : null}
    </button>
  );
}

interface NotesGridProps {
  notes: Set<Digit>;
  variant: Variant;
}

/** Renders pencil marks in a sub-grid shaped like the variant's box. */
function NotesGrid({ notes, variant }: NotesGridProps) {
  return (
    <div
      className="grid w-full h-full text-[0.55rem] leading-none text-gray-600"
      style={{
        gridTemplateColumns: `repeat(${variant.boxWidth}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${variant.boxHeight}, minmax(0, 1fr))`,
      }}
    >
      {variant.digits.map((d) => (
        <span key={d} className="flex items-center justify-center">
          {notes.has(d) ? d : ''}
        </span>
      ))}
    </div>
  );
}

export function Board({ store = gameStore, onSelectCell }: BoardProps) {
  const board = useStore(store, (s) => s.board);
  const selection = useStore(store, (s) => s.selection);
  const select = useStore(store, (s) => s.select);

  const variant = board.variant;

  const conflictKeys = new Set(
    findConflicts(board).map((p) => `${p.row},${p.col}`),
  );

  const handleSelect = (pos: Position) => {
    if (onSelectCell) {
      onSelectCell(pos);
    } else {
      select(pos);
    }
  };

  return (
    <div
      data-testid="sudoku-board"
      className="grid w-full max-w-md mx-auto border-2 border-gray-900 bg-gray-900"
      style={{
        gridTemplateColumns: `repeat(${variant.size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${variant.size}, minmax(0, 1fr))`,
        aspectRatio: '1 / 1',
      }}
    >
      {board.cells.map((row, r) =>
        row.map((cell, c) => {
          const isSelected = selection?.row === r && selection?.col === c;
          return (
            <CellView
              key={`${r}-${c}`}
              cell={cell}
              row={r}
              col={c}
              variant={variant}
              selected={isSelected}
              conflict={conflictKeys.has(`${r},${c}`)}
              onClick={() => handleSelect({ row: r, col: c })}
            />
          );
        }),
      )}
    </div>
  );
}

export default Board;
