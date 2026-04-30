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
    diagram: () => null,
  },
  box: {
    id: 'box',
    term: 'Box',
    definition:
      'One of the small groups outlined by thicker lines. Classic sudoku has nine 3-by-3 boxes; the smaller variants use 2-by-3 or 2-by-2 boxes.',
    diagram: () => null,
  },
  pair: {
    id: 'pair',
    term: 'Pair (and triple, quad)',
    definition:
      'Two cells (or three, or four) in the same row, column, or box that together can only be the same two (or three, or four) numbers.',
    diagram: () => null,
  },
  chain: {
    id: 'chain',
    term: 'Chain',
    definition:
      "A sequence of cells where each step tells you \"if this isn't the number, the next one must be\". Following the chain lets you rule numbers out.",
    diagram: () => null,
  },
  cluster: {
    id: 'cluster',
    term: 'Cluster',
    definition:
      'A group of cells you mark in two alternating colours to see which set of guesses can be true together. If one colour leads to a contradiction, the other colour wins.',
    diagram: () => null,
  },
  'pivot-pincer': {
    id: 'pivot-pincer',
    term: 'Pivot and pincer',
    definition:
      'In some patterns, a cell in the middle (the pivot) is paired with two cells on either side (the pincers). Together they squeeze a number out of any cell that sees both pincers.',
    diagram: () => null,
  },
  placement: {
    id: 'placement',
    term: 'Placement',
    definition:
      "Filling a cell in with its final number — you've worked out for certain what goes there.",
    diagram: () => null,
  },
  elimination: {
    id: 'elimination',
    term: 'Elimination',
    definition:
      "Removing a candidate from a cell because you've ruled it out. The cell still has other possibilities; you've just narrowed them.",
    diagram: () => null,
  },
};
