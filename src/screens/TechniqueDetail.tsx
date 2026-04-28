import { useEffect, useMemo, useState } from 'react';
import { Board } from '../components/Board';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { createGameStore } from '../store/game';
import { TECHNIQUE_CATALOG } from '../engine/solver/techniques/catalog';
import {
  classicVariant,
  miniVariant,
  sixVariant,
} from '../engine/variants';
import {
  cloneCell,
  createEmptyBoard,
  createGivenCell,
} from '../engine/types';
import type {
  Board as BoardType,
  Digit,
  Position,
  Variant,
} from '../engine/types';
import type { TechniqueId } from '../engine/solver/techniques';

import { fixture as hiddenPairFixture } from '../engine/solver/techniques/hidden-pair.fixture';
import { fixture as hiddenTripleFixture } from '../engine/solver/techniques/hidden-triple.fixture';
import { fixture as nakedQuadFixture } from '../engine/solver/techniques/naked-quad.fixture';
import { fixture as hiddenQuadFixture } from '../engine/solver/techniques/hidden-quad.fixture';
import { fixture as swordfishFixture } from '../engine/solver/techniques/swordfish.fixture';
import { fixture as jellyfishFixture } from '../engine/solver/techniques/jellyfish.fixture';
import { fixture as xyWingFixture } from '../engine/solver/techniques/xy-wing.fixture';
import { fixture as xyzWingFixture } from '../engine/solver/techniques/xyz-wing.fixture';
import { fixture as wWingFixture } from '../engine/solver/techniques/w-wing.fixture';
import { fixture as simpleColoringFixture } from '../engine/solver/techniques/simple-coloring.fixture';
import { fixture as xCycleFixture } from '../engine/solver/techniques/x-cycle.fixture';
import { fixture as emptyRectangleFixture } from '../engine/solver/techniques/empty-rectangle.fixture';
import { fixture as skyscraperFixture } from '../engine/solver/techniques/skyscraper.fixture';
import { fixture as twoStringKiteFixture } from '../engine/solver/techniques/two-string-kite.fixture';
import { fixture as uniqueRectangleFixture } from '../engine/solver/techniques/unique-rectangle.fixture';
import { fixture as bugFixture } from '../engine/solver/techniques/bug.fixture';
import { fixture as xyChainFixture } from '../engine/solver/techniques/xy-chain.fixture';
import { fixture as multiColoringFixture } from '../engine/solver/techniques/multi-coloring.fixture';
import { fixture as alsXzFixture } from '../engine/solver/techniques/als-xz.fixture';
import { fixture as wxyzWingFixture } from '../engine/solver/techniques/wxyz-wing.fixture';
import { fixture as hiddenRectangleFixture } from '../engine/solver/techniques/hidden-rectangle.fixture';
import { fixture as avoidableRectangleFixture } from '../engine/solver/techniques/avoidable-rectangle.fixture';
import { fixture as niceLoopFixture } from '../engine/solver/techniques/nice-loop.fixture';
import { fixture as groupedXCycleFixture } from '../engine/solver/techniques/grouped-x-cycle.fixture';
import { fixture as medusa3DFixture } from '../engine/solver/techniques/medusa-3d.fixture';
import { fixture as deathBlossomFixture } from '../engine/solver/techniques/death-blossom.fixture';
import { fixture as forcingChainsFixture } from '../engine/solver/techniques/forcing-chains.fixture';

/**
 * Shape of a technique fixture (mirrors the per-technique fixture files;
 * structurally identical across all of them per requirements §8.4). TASK-056
 * will replace this lookup with the canonical entry on `TECHNIQUE_CATALOG`.
 */
interface TechniqueFixture {
  variant: 'classic' | 'six' | 'mini';
  board: string;
  patternCells: Position[];
  deduction: {
    eliminations?: Array<{ pos: Position; digits: Digit[] }>;
    placement?: { pos: Position; digit: Digit };
  };
  description: string;
}

const FIXTURES: Partial<Record<TechniqueId, TechniqueFixture>> = {
  'hidden-pair': hiddenPairFixture,
  'hidden-triple': hiddenTripleFixture,
  'naked-quad': nakedQuadFixture,
  'hidden-quad': hiddenQuadFixture,
  swordfish: swordfishFixture,
  jellyfish: jellyfishFixture,
  'xy-wing': xyWingFixture,
  'xyz-wing': xyzWingFixture,
  'w-wing': wWingFixture,
  'simple-coloring': simpleColoringFixture,
  'x-cycle': xCycleFixture,
  'empty-rectangle': emptyRectangleFixture,
  skyscraper: skyscraperFixture,
  'two-string-kite': twoStringKiteFixture,
  'unique-rectangle': uniqueRectangleFixture,
  'bug-plus-one': bugFixture,
  'xy-chain': xyChainFixture,
  'multi-coloring': multiColoringFixture,
  'als-xz': alsXzFixture,
  'wxyz-wing': wxyzWingFixture,
  'hidden-rectangle': hiddenRectangleFixture,
  'avoidable-rectangle': avoidableRectangleFixture,
  'nice-loop': niceLoopFixture,
  'grouped-x-cycle': groupedXCycleFixture,
  '3d-medusa': medusa3DFixture,
  'death-blossom': deathBlossomFixture,
  'forcing-chains': forcingChainsFixture,
};

type WalkthroughStep = 'initial' | 'pattern' | 'deduction' | 'applied';

function variantFor(name: TechniqueFixture['variant']): Variant {
  if (name === 'classic') return classicVariant;
  if (name === 'six') return sixVariant;
  return miniVariant;
}

function parseFixtureBoard(fixture: TechniqueFixture): BoardType {
  const variant = variantFor(fixture.variant);
  const cleaned = fixture.board.replace(/\s+/g, '');
  const expected = variant.size * variant.size;
  if (cleaned.length !== expected) {
    throw new Error(
      `Fixture board has ${cleaned.length} cells, expected ${expected}`,
    );
  }
  const board = createEmptyBoard(variant);
  for (let i = 0; i < expected; i++) {
    const ch = cleaned[i];
    const r = Math.floor(i / variant.size);
    const c = i % variant.size;
    if (ch === '.' || ch === '0') continue;
    const d = Number.parseInt(ch, 10);
    if (Number.isInteger(d) && d >= 1 && d <= variant.size) {
      board.cells[r][c] = createGivenCell(d as Digit);
    }
  }
  return board;
}

function cloneBoard(board: BoardType): BoardType {
  return {
    variant: board.variant,
    cells: board.cells.map((row) => row.map(cloneCell)),
  };
}

/**
 * Returns the board state to display for a given walkthrough step. Steps
 * `initial` and `pattern` show the unchanged fixture (highlighting happens via
 * the side panel). `deduction` pre-populates the cells touched by the
 * elimination with the full candidate set so the player can see what will be
 * removed. `applied` mutates those cells to reflect the deduction outcome —
 * either a placement or the surviving candidates after elimination.
 */
function boardForStep(
  initial: BoardType,
  fixture: TechniqueFixture,
  step: WalkthroughStep,
): BoardType {
  if (step === 'initial' || step === 'pattern') return initial;

  const board = cloneBoard(initial);
  const variant = board.variant;

  if (step === 'deduction') {
    if (fixture.deduction.eliminations) {
      for (const elim of fixture.deduction.eliminations) {
        const cell = board.cells[elim.pos.row][elim.pos.col];
        if (cell.value != null) continue;
        board.cells[elim.pos.row][elim.pos.col] = {
          ...cell,
          notes: new Set<Digit>(variant.digits),
        };
      }
    }
    return board;
  }

  // applied
  if (fixture.deduction.placement) {
    const { pos, digit } = fixture.deduction.placement;
    board.cells[pos.row][pos.col] = {
      value: digit,
      notes: new Set<Digit>(),
      given: false,
    };
  }
  if (fixture.deduction.eliminations) {
    for (const elim of fixture.deduction.eliminations) {
      const cell = board.cells[elim.pos.row][elim.pos.col];
      if (cell.value != null) continue;
      const remaining = new Set<Digit>();
      for (const d of variant.digits) {
        if (!elim.digits.includes(d)) remaining.add(d);
      }
      board.cells[elim.pos.row][elim.pos.col] = { ...cell, notes: remaining };
    }
  }
  return board;
}

function formatPosition(pos: Position): string {
  return `r${pos.row + 1}c${pos.col + 1}`;
}

function deductionSummary(fixture: TechniqueFixture): string {
  const parts: string[] = [];
  if (fixture.deduction.placement) {
    const { pos, digit } = fixture.deduction.placement;
    parts.push(`Place ${digit} at ${formatPosition(pos)}`);
  }
  if (fixture.deduction.eliminations) {
    for (const elim of fixture.deduction.eliminations) {
      parts.push(
        `Remove ${elim.digits.join(',')} from ${formatPosition(elim.pos)}`,
      );
    }
  }
  return parts.join('; ');
}

interface TechniqueDetailProps {
  id: TechniqueId;
  /** Optional callback invoked when the user taps the Back action. */
  onBack?: () => void;
}

export function TechniqueDetail({ id, onBack }: TechniqueDetailProps) {
  const entry = useMemo(
    () => TECHNIQUE_CATALOG.find((e) => e.id === id),
    [id],
  );
  const fixture = useMemo<TechniqueFixture | undefined>(
    () => FIXTURES[id],
    [id],
  );

  const initialBoard = useMemo(
    () => (fixture ? parseFixtureBoard(fixture) : null),
    [fixture],
  );

  // Per requirements §8.3, walkthrough state lives only in this component —
  // never in the game store.
  const [step, setStep] = useState<WalkthroughStep>('initial');
  useEffect(() => {
    setStep('initial');
  }, [id]);

  // Isolated game-store instance scoped to the detail page. Reusing
  // `createGameStore` lets us pass the store straight into <Board /> without
  // duplicating the cell/selection contract; the store's `newGame` etc. are
  // never called here so worker generation isn't triggered.
  const store = useMemo(() => {
    const variant = fixture?.variant ?? 'classic';
    const s = createGameStore(variant);
    if (initialBoard) s.setState({ board: initialBoard });
    return s;
  }, [fixture?.variant, initialBoard]);

  useEffect(() => {
    if (!fixture || !initialBoard) return;
    store.setState({
      board: boardForStep(initialBoard, fixture, step),
      selection: null,
    });
  }, [step, store, fixture, initialBoard]);

  if (!entry) {
    return (
      <div data-testid="technique-detail" className="p-4">
        <p>Unknown technique.</p>
      </div>
    );
  }

  const slug = entry.tier.toLowerCase();

  if (!fixture || !initialBoard) {
    return (
      <div
        data-testid="technique-detail"
        data-technique-id={id}
        className="p-4 space-y-3"
      >
        {onBack ? (
          <button
            type="button"
            data-testid="technique-detail-back"
            onClick={onBack}
            className="text-sm underline"
          >
            ← Back
          </button>
        ) : null}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{entry.displayName}</h1>
          <DifficultyBadge difficulty={slug} />
        </div>
        <p>Walkthrough not yet available for this technique.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="technique-detail"
      data-technique-id={id}
      data-walkthrough-step={step}
      className="p-4 space-y-4 overflow-y-auto"
      style={{ maxHeight: '100vh', paddingBottom: '5rem' }}
    >
      {onBack ? (
        <button
          type="button"
          data-testid="technique-detail-back"
          onClick={onBack}
          className="text-sm underline"
        >
          ← Back
        </button>
      ) : null}

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{entry.displayName}</h1>
          <DifficultyBadge difficulty={slug} />
        </div>
        <p
          data-testid="technique-detail-description"
          className="text-sm leading-relaxed"
          style={{ color: 'var(--fg)' }}
        >
          {fixture.description}
        </p>
      </header>

      <Board store={store} />

      <section
        data-testid="walkthrough-panel"
        className="rounded-md border p-3 text-sm space-y-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div data-testid="walkthrough-step" className="font-medium">
          {step === 'initial' && 'Tap Highlight pattern to begin.'}
          {step === 'pattern' && (
            <span>
              Pattern cells:{' '}
              <span data-testid="walkthrough-pattern-cells">
                {fixture.patternCells.map(formatPosition).join(', ')}
              </span>
            </span>
          )}
          {step === 'deduction' && (
            <span data-testid="walkthrough-deduction">
              {deductionSummary(fixture)}
            </span>
          )}
          {step === 'applied' && <span>Deduction applied to the board.</span>}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="walkthrough-highlight"
          onClick={() => setStep('pattern')}
          disabled={step !== 'initial'}
          className="px-3 py-2 rounded-md border disabled:opacity-50"
          style={{ borderColor: 'var(--border)' }}
        >
          Highlight pattern
        </button>
        <button
          type="button"
          data-testid="walkthrough-show-deduction"
          onClick={() => setStep('deduction')}
          disabled={step !== 'pattern'}
          className="px-3 py-2 rounded-md border disabled:opacity-50"
          style={{ borderColor: 'var(--border)' }}
        >
          Show deduction
        </button>
        <button
          type="button"
          data-testid="walkthrough-apply"
          onClick={() => setStep('applied')}
          disabled={step !== 'deduction'}
          className="px-3 py-2 rounded-md border disabled:opacity-50"
          style={{ borderColor: 'var(--border)' }}
        >
          Apply
        </button>
        <button
          type="button"
          data-testid="walkthrough-reset"
          onClick={() => setStep('initial')}
          disabled={step === 'initial'}
          className="px-3 py-2 rounded-md border disabled:opacity-50"
          style={{ borderColor: 'var(--border)' }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default TechniqueDetail;
