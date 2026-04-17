import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import type { Cell, Digit, Position, Variant } from '../engine/types';
import { completedDigits, findConflicts } from '../engine/board';

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
  completed: boolean;
  highlighted: boolean;
  onClick: () => void;
}

/**
 * Thicker borders at box boundaries. Uses inline style so colors can come from
 * the active theme's `--border` variable.
 */
function cellBorderStyle(row: number, col: number, variant: Variant): React.CSSProperties {
  const thin = '1px solid var(--border)';
  const thick = '2px solid var(--fg)';
  const atBoxRight = (col + 1) % variant.boxWidth === 0 && col !== variant.size - 1;
  const atBoxBottom = (row + 1) % variant.boxHeight === 0 && row !== variant.size - 1;
  const atBoxLeft = col % variant.boxWidth === 0 && col !== 0;
  const atBoxTop = row % variant.boxHeight === 0 && row !== 0;
  return {
    borderTop: atBoxTop ? thick : thin,
    borderRight: atBoxRight ? thick : thin,
    borderBottom: atBoxBottom ? thick : thin,
    borderLeft: atBoxLeft ? thick : thin,
  };
}

function CellView({
  cell,
  row,
  col,
  variant,
  selected,
  conflict,
  completed,
  highlighted,
  onClick,
}: CellViewProps) {
  const bg = conflict
    ? 'var(--cell-conflict)'
    : selected
      ? 'var(--cell-selected)'
      : highlighted
        ? 'var(--cell-highlight)'
        : completed
          ? 'var(--cell-completed)'
          : cell.given
            ? 'var(--cell-given-bg, var(--cell-bg))'
            : 'var(--cell-bg)';
  const fg = cell.given ? 'var(--cell-given)' : 'var(--accent)';
  const conflictClass = conflict ? 'conflict' : '';

  return (
    <button
      type="button"
      data-testid={`cell-r${row}-c${col}`}
      onClick={onClick}
      className={`aspect-square w-full flex items-center justify-center select-none ${cell.given ? 'font-bold' : ''} ${conflictClass} focus:outline-none`}
      style={{
        background: bg,
        color: fg,
        ...cellBorderStyle(row, col, variant),
      }}
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
      className="grid w-full h-full text-[0.55rem] leading-none opacity-70"
      style={{
        gridTemplateColumns: `repeat(${variant.boxWidth}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${variant.boxHeight}, minmax(0, 1fr))`,
        color: 'var(--fg)',
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
  const highlightedDigit = useStore(store, (s) => s.highlightedDigit);
  const select = useStore(store, (s) => s.select);

  const variant = board.variant;

  const conflictKeys = new Set(
    findConflicts(board).map((p) => `${p.row},${p.col}`),
  );
  const completed = completedDigits(board);

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
      className="grid w-full max-w-md mx-auto rounded-md overflow-hidden shadow-sm"
      style={{
        gridTemplateColumns: `repeat(${variant.size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${variant.size}, minmax(0, 1fr))`,
        aspectRatio: '1 / 1',
        border: '2px solid var(--fg)',
        background: 'var(--cell-bg)',
      }}
    >
      {board.cells.map((row, r) =>
        row.map((cell, c) => {
          const isSelected = selection?.row === r && selection?.col === c;
          const isHighlighted =
            !isSelected &&
            cell.value != null &&
            highlightedDigit != null &&
            cell.value === highlightedDigit;
          const isCompleted =
            !isSelected &&
            !isHighlighted &&
            cell.value != null &&
            completed.has(cell.value);
          return (
            <CellView
              key={`${r}-${c}`}
              cell={cell}
              row={r}
              col={c}
              variant={variant}
              selected={isSelected}
              conflict={conflictKeys.has(`${r},${c}`)}
              completed={isCompleted}
              highlighted={isHighlighted}
              onClick={() => handleSelect({ row: r, col: c })}
            />
          );
        }),
      )}
    </div>
  );
}

export default Board;
