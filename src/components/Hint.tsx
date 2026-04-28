import { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { nextStep, type TechniqueResult } from '../engine/solver/techniques';
import { TECHNIQUE_CATALOG } from '../engine/solver/techniques/catalog';
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
  return TECHNIQUE_CATALOG[result.technique].displayName;
}

/** Extracts the set of cells the hint refers to, for highlighting. */
function cellsFromResult(result: TechniqueResult): Position[] {
  switch (result.technique) {
    case 'naked-single':
    case 'hidden-single':
    case 'bug-plus-one':
      return [result.cell];
    case 'naked-pair':
    case 'naked-triple':
    case 'naked-quad':
    case 'hidden-pair':
    case 'hidden-triple':
    case 'hidden-quad':
    case 'x-wing':
    case 'swordfish':
    case 'jellyfish':
    case 'x-cycle':
      return result.cells;
    case 'pointing':
    case 'box-line-reduction':
      return result.intersectionCells;
    case 'xy-wing':
    case 'xyz-wing':
      return [result.pivot, ...result.pincers];
    case 'w-wing':
      return [...result.bivalues, ...result.strongLink];
    case 'simple-coloring':
      return [...result.colorA, ...result.colorB];
    case 'empty-rectangle':
      return [
        ...result.boxCells,
        result.strongLink.from,
        result.strongLink.to,
      ];
    case 'skyscraper':
      return [...result.roof, ...result.baseCells];
    case 'two-string-kite':
      return [
        result.rowBoxCell,
        result.colBoxCell,
        result.rowTail,
        result.colTail,
      ];
    case 'unique-rectangle':
    case 'hidden-rectangle':
    case 'avoidable-rectangle':
      return [...result.corners];
    case 'xy-chain':
      return result.chain.map((link) => link.pos);
    case 'multi-coloring':
      return [
        ...result.cluster1A,
        ...result.cluster1B,
        ...result.cluster2A,
        ...result.cluster2B,
      ];
    case 'als-xz':
      return [...result.alsA.cells, ...result.alsB.cells];
    case 'wxyz-wing':
      return [result.hinge, ...result.pincers];
    case 'nice-loop':
      return result.nodes.map((n) => n.pos);
    case 'grouped-x-cycle':
      return result.nodes.flatMap((n) => n.cells);
    case '3d-medusa':
      return [
        ...result.colorA.map((n) => n.cell),
        ...result.colorB.map((n) => n.cell),
      ];
    case 'death-blossom':
      return [result.stem, ...result.petals.flatMap((p) => p.als.cells)];
    case 'forcing-chains':
      return [result.source];
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
          <a
            data-testid="hint-learn-more"
            href={`#/learn/${state.result.technique}`}
            className="mt-2 inline-block underline opacity-80"
          >
            Learn more about{' '}
            {TECHNIQUE_CATALOG[state.result.technique].displayName} →
          </a>
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
