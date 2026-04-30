import { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '../store/game';
import { nextStep, type TechniqueResult } from '../engine/solver/techniques';
import { TECHNIQUE_CATALOG } from '../engine/solver/techniques/catalog';
import type { Board, Position } from '../engine/types';
import type { CellRole } from '../engine/solver/techniques/roles';

export interface HintHighlight {
  pos: Position;
  role: CellRole;
}

interface HintProps {
  /** Optional store override, primarily for tests. */
  store?: typeof gameStore;
  /**
   * Optional board override. When provided, the hint is computed from this
   * board rather than the store's board. Useful for tests / storybook.
   */
  board?: Board;
  /**
   * Optional callback invoked with the highlighted cells the hint refers to,
   * each annotated with a role. Consumers can use this to visually highlight
   * those cells on the board. Called with an empty array when no hint is
   * available.
   */
  onHighlight?: (highlights: HintHighlight[]) => void;
}

/** Human-readable label for each technique id. */
function techniqueLabel(result: TechniqueResult): string {
  return TECHNIQUE_CATALOG[result.technique].displayName;
}

/** Convenience constructor for a HintHighlight. */
function h(pos: Position, role: CellRole): HintHighlight {
  return { pos, role };
}

/** Extracts the set of cells the hint refers to, annotated with roles. */
function cellsAndRolesFromResult(result: TechniqueResult): HintHighlight[] {
  switch (result.technique) {
    case 'naked-single':
    case 'hidden-single':
    case 'bug-plus-one':
      return [h(result.cell, 'placement')];
    case 'naked-pair':
    case 'naked-triple':
    case 'naked-quad':
    case 'hidden-pair':
    case 'hidden-triple':
    case 'hidden-quad':
      return result.cells.map((pos) => h(pos, 'pattern-primary'));
    case 'x-wing':
    case 'swordfish':
    case 'jellyfish':
      return result.cells.map((pos) => h(pos, 'pattern-primary'));
    case 'x-cycle':
      return result.cells.map((pos) => h(pos, 'chain-link'));
    case 'pointing':
    case 'box-line-reduction':
      return result.intersectionCells.map((pos) => h(pos, 'pattern-primary'));
    case 'xy-wing':
    case 'xyz-wing':
      return [
        h(result.pivot, 'pivot'),
        ...result.pincers.map((pos) => h(pos, 'pincer')),
      ];
    case 'w-wing':
      return [
        ...result.bivalues.map((pos) => h(pos, 'pattern-primary')),
        ...result.strongLink.map((pos) => h(pos, 'pattern-secondary')),
      ];
    case 'simple-coloring':
      return [
        ...result.colorA.map((pos) => h(pos, 'cluster-a')),
        ...result.colorB.map((pos) => h(pos, 'cluster-b')),
      ];
    case 'empty-rectangle':
      return [
        ...result.boxCells.map((pos) => h(pos, 'pattern-primary')),
        h(result.strongLink.from, 'pattern-secondary'),
        h(result.strongLink.to, 'pattern-secondary'),
      ];
    case 'skyscraper':
      return [
        ...result.roof.map((pos) => h(pos, 'pattern-primary')),
        ...result.baseCells.map((pos) => h(pos, 'pattern-secondary')),
      ];
    case 'two-string-kite':
      return [
        h(result.rowBoxCell, 'pattern-primary'),
        h(result.colBoxCell, 'pattern-primary'),
        h(result.rowTail, 'pattern-secondary'),
        h(result.colTail, 'pattern-secondary'),
      ];
    case 'unique-rectangle':
    case 'hidden-rectangle':
    case 'avoidable-rectangle':
      return [...result.corners].map((pos) => h(pos, 'corner'));
    case 'xy-chain':
      return result.chain.map((link) => h(link.pos, 'chain-link'));
    case 'multi-coloring':
      return [
        ...result.cluster1A.map((pos) => h(pos, 'cluster-a')),
        ...result.cluster2A.map((pos) => h(pos, 'cluster-a')),
        ...result.cluster1B.map((pos) => h(pos, 'cluster-b')),
        ...result.cluster2B.map((pos) => h(pos, 'cluster-b')),
      ];
    case 'als-xz':
      return [
        ...result.alsA.cells.map((pos) => h(pos, 'cluster-a')),
        ...result.alsB.cells.map((pos) => h(pos, 'cluster-b')),
      ];
    case 'wxyz-wing':
      return [
        h(result.hinge, 'pivot'),
        ...result.pincers.map((pos) => h(pos, 'pincer')),
      ];
    case 'nice-loop':
      return result.nodes.map((n) => h(n.pos, 'chain-link'));
    case 'grouped-x-cycle':
      return result.nodes.flatMap((n) => n.cells.map((pos) => h(pos, 'chain-link')));
    case '3d-medusa':
      return [
        ...result.colorA.map((n) => h(n.cell, 'cluster-a')),
        ...result.colorB.map((n) => h(n.cell, 'cluster-b')),
      ];
    case 'death-blossom':
      return [
        h(result.stem, 'pivot'),
        ...result.petals.flatMap((p) => p.als.cells.map((pos) => h(pos, 'pincer'))),
      ];
    case 'forcing-chains':
      return [h(result.source, 'pivot')];
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
    onHighlight?.(cellsAndRolesFromResult(result));
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
