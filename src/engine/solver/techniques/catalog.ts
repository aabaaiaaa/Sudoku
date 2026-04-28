import type { Difficulty } from '../../generator/rate';
import type { TechniqueId } from './index';

export interface TechniqueCatalogEntry {
  id: TechniqueId;
  displayName: string;
  tier: Difficulty;
}

/**
 * Single source of truth for the full set of implemented techniques: their
 * canonical display name and the difficulty tier they belong to. Listed in
 * the same difficulty-ascending order used by the rater and `nextStep`, so
 * iterating the catalog produces a stable, tier-grouped sequence.
 *
 * The Techniques help screen and (later) the technique detail page both
 * consume this array. TASK-056 will extend each entry with its fixture and
 * "when to look for it" description.
 */
export const TECHNIQUE_CATALOG: readonly TechniqueCatalogEntry[] = [
  { id: 'naked-single', displayName: 'Naked Single', tier: 'Easy' },
  { id: 'hidden-single', displayName: 'Hidden Single', tier: 'Medium' },
  { id: 'pointing', displayName: 'Pointing Pair', tier: 'Hard' },
  { id: 'box-line-reduction', displayName: 'Box/Line Reduction', tier: 'Hard' },
  { id: 'naked-pair', displayName: 'Naked Pair', tier: 'Expert' },
  { id: 'naked-triple', displayName: 'Naked Triple', tier: 'Expert' },
  { id: 'naked-quad', displayName: 'Naked Quad', tier: 'Expert' },
  { id: 'hidden-pair', displayName: 'Hidden Pair', tier: 'Expert' },
  { id: 'hidden-triple', displayName: 'Hidden Triple', tier: 'Expert' },
  { id: 'hidden-quad', displayName: 'Hidden Quad', tier: 'Expert' },
  { id: 'x-wing', displayName: 'X-Wing', tier: 'Master' },
  { id: 'swordfish', displayName: 'Swordfish', tier: 'Master' },
  { id: 'jellyfish', displayName: 'Jellyfish', tier: 'Master' },
  { id: 'xy-wing', displayName: 'XY-Wing', tier: 'Diabolical' },
  { id: 'xyz-wing', displayName: 'XYZ-Wing', tier: 'Diabolical' },
  { id: 'w-wing', displayName: 'W-Wing', tier: 'Diabolical' },
  { id: 'simple-coloring', displayName: 'Simple Coloring', tier: 'Diabolical' },
  { id: 'x-cycle', displayName: 'X-Cycle', tier: 'Diabolical' },
  { id: 'empty-rectangle', displayName: 'Empty Rectangle', tier: 'Diabolical' },
  { id: 'skyscraper', displayName: 'Skyscraper', tier: 'Diabolical' },
  { id: 'two-string-kite', displayName: 'Two-String Kite', tier: 'Diabolical' },
  { id: 'unique-rectangle', displayName: 'Unique Rectangle', tier: 'Demonic' },
  { id: 'bug-plus-one', displayName: 'BUG+1', tier: 'Demonic' },
  { id: 'xy-chain', displayName: 'XY-Chain', tier: 'Demonic' },
  { id: 'multi-coloring', displayName: 'Multi-Coloring', tier: 'Demonic' },
  { id: 'als-xz', displayName: 'ALS-XZ', tier: 'Demonic' },
  { id: 'wxyz-wing', displayName: 'WXYZ-Wing', tier: 'Demonic' },
  { id: 'hidden-rectangle', displayName: 'Hidden Rectangle', tier: 'Demonic' },
  {
    id: 'avoidable-rectangle',
    displayName: 'Avoidable Rectangle',
    tier: 'Demonic',
  },
  { id: 'nice-loop', displayName: 'Nice Loop', tier: 'Nightmare' },
  { id: 'grouped-x-cycle', displayName: 'Grouped X-Cycle', tier: 'Nightmare' },
  { id: '3d-medusa', displayName: '3D Medusa', tier: 'Nightmare' },
  { id: 'death-blossom', displayName: 'Death Blossom', tier: 'Nightmare' },
  { id: 'forcing-chains', displayName: 'Forcing Chains', tier: 'Nightmare' },
];
