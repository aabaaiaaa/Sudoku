import type { ReactElement } from 'react';

export type GlossaryTermId =
  | 'candidate'
  | 'box'
  | 'pair'
  | 'chain'
  | 'cluster'
  | 'pivot-pincer'
  | 'placement'
  | 'elimination';

export interface GlossaryEntry {
  id: GlossaryTermId;
  term: string;
  definition: string;
  /** Tiny inline SVG (≤ 120×120px) shown next to the definition. */
  diagram: () => ReactElement | null;
}

export const GLOSSARY: Record<GlossaryTermId, GlossaryEntry> = {
  candidate: {
    id: 'candidate',
    term: 'Candidate',
    definition:
      'A small number you write in a cell to remember a possibility before committing.',
    diagram: () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
        <rect x="2" y="2" width="56" height="56" fill="#fff" stroke="#888" strokeWidth="2" rx="4"/>
        <text x="8" y="16" fontSize="10" fill="#666" fontFamily="monospace">1 3</text>
        <text x="30" y="40" fontSize="24" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">5</text>
      </svg>
    ),
  },
  box: {
    id: 'box',
    term: 'Box',
    definition:
      'One of the small groups outlined by thicker lines. Classic sudoku has nine 3-by-3 boxes; the smaller variants use 2-by-3 or 2-by-2 boxes.',
    diagram: () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
        <rect x="2" y="2" width="76" height="76" fill="#eef3fa" stroke="#333" strokeWidth="3" rx="2"/>
        <line x1="28" y1="2" x2="28" y2="78" stroke="#aaa" strokeWidth="1"/>
        <line x1="54" y1="2" x2="54" y2="78" stroke="#aaa" strokeWidth="1"/>
        <line x1="2" y1="28" x2="78" y2="28" stroke="#aaa" strokeWidth="1"/>
        <line x1="2" y1="54" x2="78" y2="54" stroke="#aaa" strokeWidth="1"/>
      </svg>
    ),
  },
  pair: {
    id: 'pair',
    term: 'Pair (and triple, quad)',
    definition:
      'Two cells (or three, or four) in the same row, column, or box that together can only be the same two (or three, or four) numbers.',
    diagram: () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40" aria-hidden="true">
        <rect x="2" y="2" width="36" height="36" fill="#fff3bf" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="20" y="26" fontSize="18" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">4</text>
        <rect x="42" y="2" width="36" height="36" fill="#fff3bf" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="60" y="26" fontSize="18" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">7</text>
      </svg>
    ),
  },
  chain: {
    id: 'chain',
    term: 'Chain',
    definition:
      "A sequence of cells where each step tells you \"if this isn't the number, the next one must be\". Following the chain lets you rule numbers out.",
    diagram: () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40" aria-hidden="true">
        <defs>
          <marker id="glossary-arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#555"/>
          </marker>
        </defs>
        <rect x="2" y="4" width="30" height="30" fill="#e0e7ff" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="17" y="24" fontSize="14" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">A</text>
        <line x1="34" y1="19" x2="44" y2="19" stroke="#555" strokeWidth="2" markerEnd="url(#glossary-arr)"/>
        <rect x="46" y="4" width="30" height="30" fill="#e0e7ff" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="61" y="24" fontSize="14" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">B</text>
        <line x1="78" y1="19" x2="88" y2="19" stroke="#555" strokeWidth="2" markerEnd="url(#glossary-arr)"/>
        <rect x="90" y="4" width="30" height="30" fill="#e0e7ff" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="105" y="24" fontSize="14" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">C</text>
      </svg>
    ),
  },
  cluster: {
    id: 'cluster',
    term: 'Cluster',
    definition:
      'A group of cells you mark in two alternating colours to see which set of guesses can be true together. If one colour leads to a contradiction, the other colour wins.',
    diagram: () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
        <rect x="2" y="2" width="36" height="36" fill="#bbf7d0" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="20" y="26" fontSize="16" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">A</text>
        <rect x="42" y="2" width="36" height="36" fill="#fed7aa" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="60" y="26" fontSize="16" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">B</text>
        <rect x="2" y="42" width="36" height="36" fill="#fed7aa" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="20" y="66" fontSize="16" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">B</text>
        <rect x="42" y="42" width="36" height="36" fill="#bbf7d0" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="60" y="66" fontSize="16" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">A</text>
      </svg>
    ),
  },
  'pivot-pincer': {
    id: 'pivot-pincer',
    term: 'Pivot and pincer',
    definition:
      'In some patterns, a cell in the middle (the pivot) is paired with two cells on either side (the pincers). Together they squeeze a number out of any cell that sees both pincers.',
    diagram: () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40" aria-hidden="true">
        <rect x="2" y="4" width="30" height="30" fill="#ddd6fe" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="17" y="24" fontSize="11" fill="#1a1a1a" textAnchor="middle" fontFamily="sans-serif">side</text>
        <rect x="46" y="4" width="30" height="30" fill="#c7d2fe" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="61" y="24" fontSize="11" fill="#1a1a1a" textAnchor="middle" fontFamily="sans-serif">mid</text>
        <rect x="90" y="4" width="30" height="30" fill="#ddd6fe" stroke="#888" strokeWidth="2" rx="3"/>
        <text x="105" y="24" fontSize="11" fill="#1a1a1a" textAnchor="middle" fontFamily="sans-serif">side</text>
      </svg>
    ),
  },
  placement: {
    id: 'placement',
    term: 'Placement',
    definition:
      "Filling a cell in with its final number — you've worked out for certain what goes there.",
    diagram: () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
        <rect x="2" y="2" width="56" height="56" fill="#bbf7d0" stroke="#888" strokeWidth="2" rx="4"/>
        <text x="30" y="42" fontSize="32" fill="#1a1a1a" textAnchor="middle" fontFamily="monospace">7</text>
      </svg>
    ),
  },
  elimination: {
    id: 'elimination',
    term: 'Elimination',
    definition:
      "Removing a candidate from a cell because you've ruled it out. The cell still has other possibilities; you've just narrowed them.",
    diagram: () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
        <rect x="2" y="2" width="56" height="56" fill="#fecaca" stroke="#888" strokeWidth="2" rx="4"/>
        <text x="30" y="42" fontSize="32" fill="#888" textAnchor="middle" fontFamily="monospace" textDecoration="line-through">3</text>
        <line x1="10" y1="10" x2="50" y2="50" stroke="#ef4444" strokeWidth="3"/>
        <line x1="50" y1="10" x2="10" y2="50" stroke="#ef4444" strokeWidth="3"/>
      </svg>
    ),
  },
};
