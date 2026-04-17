import { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { nextStep, type TechniqueResult } from '../engine/solver/techniques';
import type { Board, Position } from '../engine/types';

interface HintProps {
  /** Optional store override, primarily for tests. */
  store?: typeof gameStore;
  /**
   * Optional board override. When provided, the hint is computed from this
   * board rather than the store's board. Useful for tests / storybook.
   */
  board?: Board;
  /**
   * Optional callback invoked with the positions of the cells the hint
   * touches. Consumers can use this to visually highlight those cells on
   * the board. Called with an empty array when no hint is available.
   */
  onHighlight?: (cells: Position[]) => void;
}

/** Human-readable label for each technique id. */
function techniqueLabel(result: TechniqueResult): string {
  switch (result.technique) {
    case 'naked-single':
      return 'Naked Single';
    case 'hidden-single':
      return 'Hidden Single';
    case 'naked-pair':
      return 'Naked Pair';
    case 'naked-triple':
      return 'Naked Triple';
    case 'pointing':
      return 'Pointing';
    case 'box-line-reduction':
      return 'Box/Line Reduction';
    case 'x-wing':
      return 'X-Wing';
  }
}

/** Extracts the set of cells the hint refers to, for highlighting. */
function cellsFromResult(result: TechniqueResult): Position[] {
  switch (result.technique) {
    case 'naked-single':
    case 'hidden-single':
      return [result.cell];
    case 'naked-pair':
    case 'naked-triple':
      return result.cells;
    case 'pointing':
    case 'box-line-reduction':
      return result.intersectionCells;
    case 'x-wing':
      return result.cells;
  }
}

type HintState =
  | { kind: 'idle' }
  | { kind: 'hit'; result: TechniqueResult }
  | { kind: 'miss' };

export function Hint({ store = gameStore, board, onHighlight }: HintProps) {
  const storeBoard = useStore(store, (s) => s.board);
  const activeBoard = board ?? storeBoard;

  const [state, setState] = useState<HintState>({ kind: 'idle' });

  const handleClick = () => {
    const result = nextStep(activeBoard);
    if (result == null) {
      setState({ kind: 'miss' });
      onHighlight?.([]);
      return;
    }
    setState({ kind: 'hit', result });
    onHighlight?.(cellsFromResult(result));
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="hint-button"
        onClick={handleClick}
        className="btn self-start"
      >
        💡 Hint
      </button>
      {state.kind === 'hit' && (
        <div
          role="status"
          data-testid="hint-panel"
          className="card p-3 text-sm"
        >
          <div data-testid="hint-technique" className="font-semibold">
            {techniqueLabel(state.result)}
          </div>
          <div data-testid="hint-explanation" className="opacity-80">
            {state.result.explanation}
          </div>
        </div>
      )}
      {state.kind === 'miss' && (
        <div
          role="status"
          data-testid="hint-panel"
          className="card p-3 text-sm opacity-80"
        >
          No available hint. Try checking your entries.
        </div>
      )}
    </div>
  );
}

export default Hint;
