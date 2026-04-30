import { useEffect, useMemo, useState } from 'react';
import { Board } from '../components/Board';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { createGameStore } from '../store/game';
import {
  TECHNIQUE_CATALOG,
  type TechniqueFixture,
} from '../engine/solver/techniques/catalog';
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
import { roleLabels, mergeCellRoles } from '../engine/solver/techniques/roles';
import { GLOSSARY } from '../engine/solver/techniques/glossary';
import type { CellRole } from '../engine/solver/techniques/roles';
import type { GlossaryTermId } from '../engine/solver/techniques/glossary';

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

function GlossarySection({ terms }: { terms: GlossaryTermId[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section data-testid="glossary-section" className="text-sm">
      <button
        type="button"
        data-testid="glossary-toggle"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 font-medium underline"
      >
        {open ? '▾' : '▸'} Terms used here
      </button>
      {open && (
        <ul data-testid="glossary-list" className="mt-2 space-y-2">
          {terms.map(termId => {
            const entry = GLOSSARY[termId];
            const Diagram = entry.diagram;
            return (
              <li key={termId} className="flex gap-2 items-start">
                <div className="flex-shrink-0"><Diagram /></div>
                <div>
                  <strong>{entry.term}</strong>: {entry.definition}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface TechniqueDetailProps {
  id: TechniqueId;
  /** Optional callback invoked when the user taps the Back action. */
  onBack?: () => void;
}

export function TechniqueDetail({ id, onBack }: TechniqueDetailProps) {
  const entry = TECHNIQUE_CATALOG[id];
  const fixture = entry.fixture;

  const initialBoard = useMemo(
    () => parseFixtureBoard(fixture),
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
    const s = createGameStore(fixture.variant);
    s.setState({ board: initialBoard });
    return s;
  }, [fixture.variant, initialBoard]);

  useEffect(() => {
    store.setState({
      board: boardForStep(initialBoard, fixture, step),
      selection: null,
    });
  }, [step, store, fixture, initialBoard]);

  // Build cellHighlights based on walkthrough step
  const cellHighlights: Array<{ pos: Position; role: CellRole }> = useMemo(() => {
    if (step === 'initial') return [];

    // Start with fixture pattern roles
    const roleMap = new Map<string, CellRole>();
    for (const { pos, role } of fixture.roles) {
      const key = `${pos.row},${pos.col}`;
      const existing = roleMap.get(key);
      roleMap.set(key, existing ? mergeCellRoles([existing, role]) : role);
    }

    if (step === 'pattern') {
      return [...roleMap.entries()].map(([k, role]) => {
        const [row, col] = k.split(',').map(Number);
        return { pos: { row, col }, role };
      });
    }

    // For deduction and applied steps, overlay deduction roles (placement/elimination win)
    if (fixture.deduction.placement) {
      const { pos } = fixture.deduction.placement;
      const key = `${pos.row},${pos.col}`;
      roleMap.set(key, 'placement');
    }
    if (fixture.deduction.eliminations) {
      for (const elim of fixture.deduction.eliminations) {
        const key = `${elim.pos.row},${elim.pos.col}`;
        const existing = roleMap.get(key);
        roleMap.set(key, existing ? mergeCellRoles([existing, 'elimination']) : 'elimination');
      }
    }
    return [...roleMap.entries()].map(([k, role]) => {
      const [row, col] = k.split(',').map(Number);
      return { pos: { row, col }, role };
    });
  }, [step, fixture]);

  const slug = entry.tier.toLowerCase();

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

      {/* Legend strip - show roles used by this fixture */}
      {(() => {
        const usedRoles = [...new Set(fixture.roles.map(r => r.role))];
        if (usedRoles.length === 0) return null;
        return (
          <div data-testid="role-legend" className="flex flex-wrap gap-2 text-xs">
            {usedRoles.map(role => (
              <div key={role} className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: `var(--role-${role})` }}
                />
                <span>{roleLabels[role]}</span>
              </div>
            ))}
          </div>
        );
      })()}

      <Board store={store} cellHighlights={cellHighlights} />

      <section
        data-testid="walkthrough-panel"
        className="rounded-md border p-3 text-sm space-y-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div data-testid="walkthrough-step" className="font-medium">
          {step === 'initial' && 'Tap Highlight pattern to begin.'}
          {step === 'pattern' && (
            <span data-testid="walkthrough-pattern-cells">
              {fixture.roles.length === 1
                ? 'The highlighted cell is the pattern to look for.'
                : 'The highlighted cells form the technique\'s pattern. The legend below shows what each colour means.'}
            </span>
          )}
          {step === 'deduction' && (
            <span data-testid="walkthrough-deduction">
              {fixture.deduction.placement
                ? `Place ${fixture.deduction.placement.digit} in the highlighted cell.`
                : fixture.deduction.eliminations && fixture.deduction.eliminations.length > 0
                  ? (() => {
                      const allDigits = [...new Set(fixture.deduction.eliminations.flatMap(e => e.digits))].sort((a, b) => a - b);
                      const digitsStr = allDigits.length === 1
                        ? String(allDigits[0])
                        : allDigits.length === 2
                          ? `${allDigits[0]} and ${allDigits[1]}`
                          : allDigits.slice(0, -1).join(', ') + ', and ' + allDigits[allDigits.length - 1];
                      return `Remove ${digitsStr} from the highlighted cells.`;
                    })()
                  : 'Deduction applied.'}
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

      {entry.glossaryTerms && entry.glossaryTerms.length > 0 && (
        <GlossarySection terms={entry.glossaryTerms} />
      )}
    </div>
  );
}

export default TechniqueDetail;
