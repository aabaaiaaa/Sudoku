import type { Digit } from '../engine/types';

export interface CellProps {
  /** The placed digit in the cell, or null/undefined if empty. */
  value?: Digit | null;
  /** Candidate pencil marks rendered when the cell has no placed value. */
  pencilMarks?: ReadonlySet<Digit> | readonly Digit[];
  /** True when this cell is a clue from the starting puzzle (non-editable). */
  isGiven?: boolean;
  /** True when this cell is currently selected. */
  isSelected?: boolean;
  /** True when this cell shares a row/col/box with the selected cell. */
  isPeerHighlighted?: boolean;
  /** True when this cell contains the same digit as the selected cell. */
  isSameDigitHighlighted?: boolean;
  /** True when this cell has a mistake (duplicate of a peer's digit). */
  isConflict?: boolean;
  /** Number of digits in the variant (defaults to 9 for Classic). */
  digits?: number;
  /** Box width for the pencil-mark sub-grid layout. */
  boxWidth?: number;
  /** Box height for the pencil-mark sub-grid layout. */
  boxHeight?: number;
  /** Optional click handler. */
  onClick?: () => void;
  /** Optional test id; defaults to "cell". */
  testId?: string;
}

/** Default box shapes for the supported variants. */
function defaultBoxShape(digits: number): { boxWidth: number; boxHeight: number } {
  switch (digits) {
    case 4:
      return { boxWidth: 2, boxHeight: 2 };
    case 6:
      return { boxWidth: 3, boxHeight: 2 };
    case 9:
    default:
      return { boxWidth: 3, boxHeight: 3 };
  }
}

function hasDigit(
  marks: ReadonlySet<Digit> | readonly Digit[] | undefined,
  d: Digit,
): boolean {
  if (!marks) return false;
  if (marks instanceof Set) return marks.has(d);
  return (marks as readonly Digit[]).includes(d);
}

/**
 * Renders a single Sudoku cell. Pure and prop-driven — all visual state
 * (selection, highlight, conflict, etc.) is decided by the caller.
 */
export function Cell({
  value,
  pencilMarks,
  isGiven = false,
  isSelected = false,
  isPeerHighlighted = false,
  isSameDigitHighlighted = false,
  isConflict = false,
  digits = 9,
  boxWidth,
  boxHeight,
  onClick,
  testId = 'cell',
}: CellProps) {
  const shape = defaultBoxShape(digits);
  const bw = boxWidth ?? shape.boxWidth;
  const bh = boxHeight ?? shape.boxHeight;

  const classes = ['sudoku-cell'];
  classes.push('aspect-square w-full flex items-center justify-center select-none');

  // Background state classes — ordered by precedence.
  if (isConflict) {
    classes.push('conflict bg-red-200');
  } else if (isSelected) {
    classes.push('selected bg-blue-200');
  } else if (isSameDigitHighlighted) {
    classes.push('same-digit bg-blue-100');
  } else if (isPeerHighlighted) {
    classes.push('peer-highlighted bg-gray-100');
  } else if (isGiven) {
    classes.push('given bg-gray-50');
  } else {
    classes.push('bg-white');
  }

  // Text color / weight.
  if (isGiven) {
    classes.push('text-gray-900 font-bold');
  } else {
    classes.push('text-blue-700');
  }

  classes.push('focus:outline-none');

  const className = classes.join(' ');

  const hasValue = value != null;

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={isSelected}
      className={className}
    >
      {hasValue ? (
        <span className="text-xl sm:text-2xl">{value}</span>
      ) : (
        <PencilMarksGrid
          marks={pencilMarks}
          digits={digits}
          boxWidth={bw}
          boxHeight={bh}
        />
      )}
    </button>
  );
}

interface PencilMarksGridProps {
  marks?: ReadonlySet<Digit> | readonly Digit[];
  digits: number;
  boxWidth: number;
  boxHeight: number;
}

function PencilMarksGrid({ marks, digits, boxWidth, boxHeight }: PencilMarksGridProps) {
  // If no marks at all, render nothing — keeps empty cells visually empty.
  const anyMark = (() => {
    if (!marks) return false;
    if (marks instanceof Set) return marks.size > 0;
    return (marks as readonly Digit[]).length > 0;
  })();
  if (!anyMark) return null;

  const cells: Digit[] = [];
  for (let d = 1; d <= digits; d++) cells.push(d as Digit);

  return (
    <div
      data-testid="pencil-marks"
      className="grid w-full h-full text-[0.55rem] leading-none text-gray-600"
      style={{
        gridTemplateColumns: `repeat(${boxWidth}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${boxHeight}, minmax(0, 1fr))`,
      }}
    >
      {cells.map((d) => (
        <span
          key={d}
          data-testid={`pencil-mark-${d}`}
          className="flex items-center justify-center"
        >
          {hasDigit(marks, d) ? d : ''}
        </span>
      ))}
    </div>
  );
}

export default Cell;
