import type { Difficulty } from '../../generator/rate';
import type { TechniqueId } from './index';
import type { Digit, Position } from '../../types';
import type { CellRole } from './roles';
import type { GlossaryTermId } from './glossary';

import { fixture as nakedSingleFixture } from './naked-single.fixture';
import { fixture as hiddenSingleFixture } from './hidden-single.fixture';
import { fixture as pointingFixture } from './pointing.fixture';
import { fixture as boxLineReductionFixture } from './box-line-reduction.fixture';
import { fixture as nakedPairFixture } from './naked-pair.fixture';
import { fixture as nakedTripleFixture } from './naked-triple.fixture';
import { fixture as nakedQuadFixture } from './naked-quad.fixture';
import { fixture as hiddenPairFixture } from './hidden-pair.fixture';
import { fixture as hiddenTripleFixture } from './hidden-triple.fixture';
import { fixture as hiddenQuadFixture } from './hidden-quad.fixture';
import { fixture as xWingFixture } from './x-wing.fixture';
import { fixture as swordfishFixture } from './swordfish.fixture';
import { fixture as jellyfishFixture } from './jellyfish.fixture';
import { fixture as xyWingFixture } from './xy-wing.fixture';
import { fixture as xyzWingFixture } from './xyz-wing.fixture';
import { fixture as wWingFixture } from './w-wing.fixture';
import { fixture as simpleColoringFixture } from './simple-coloring.fixture';
import { fixture as xCycleFixture } from './x-cycle.fixture';
import { fixture as emptyRectangleFixture } from './empty-rectangle.fixture';
import { fixture as skyscraperFixture } from './skyscraper.fixture';
import { fixture as twoStringKiteFixture } from './two-string-kite.fixture';
import { fixture as uniqueRectangleFixture } from './unique-rectangle.fixture';
import { fixture as bugFixture } from './bug.fixture';
import { fixture as xyChainFixture } from './xy-chain.fixture';
import { fixture as multiColoringFixture } from './multi-coloring.fixture';
import { fixture as alsXzFixture } from './als-xz.fixture';
import { fixture as wxyzWingFixture } from './wxyz-wing.fixture';
import { fixture as hiddenRectangleFixture } from './hidden-rectangle.fixture';
import { fixture as avoidableRectangleFixture } from './avoidable-rectangle.fixture';
import { fixture as niceLoopFixture } from './nice-loop.fixture';
import { fixture as groupedXCycleFixture } from './grouped-x-cycle.fixture';
import { fixture as medusa3DFixture } from './medusa-3d.fixture';
import { fixture as deathBlossomFixture } from './death-blossom.fixture';
import { fixture as forcingChainsFixture } from './forcing-chains.fixture';

/** A cell position paired with the display role it plays in a technique fixture. */
export interface FixtureCellRole {
  pos: Position;
  role: CellRole;
}

/**
 * Canonical shape of every technique fixture file. Each `<name>.fixture.ts`
 * exports a value structurally compatible with this interface; the catalog
 * widens the per-file types into this single shared definition so consumers
 * (the help index, the detail page, the hint Learn-more link) only need one
 * import.
 *
 * TODO: `patternCells` was removed in iteration 7 and replaced with `roles`.
 */
export interface TechniqueFixture {
  variant: 'classic' | 'six' | 'mini';
  board: string;
  roles: FixtureCellRole[];
  deduction: {
    eliminations?: Array<{ pos: Position; digits: Digit[] }>;
    placement?: { pos: Position; digit: Digit };
  };
  description: string;
}

export interface TechniqueCatalogEntry {
  displayName: string;
  tier: Difficulty;
  fixture: TechniqueFixture;
  description: string;
  /** Glossary terms shown in the "Terms used here" section on the technique's page. */
  glossaryTerms?: GlossaryTermId[];
}

/**
 * Single source of truth for every implemented technique: its display name,
 * difficulty tier, hand-authored demonstration fixture, and "When to look
 * for it" description. The Techniques help index, the detail page, and the
 * Hint panel's Learn-more link all read from this record.
 */
export const TECHNIQUE_CATALOG: Record<TechniqueId, TechniqueCatalogEntry> = {
  'naked-single': {
    displayName: 'Naked Single',
    tier: 'Easy',
    fixture: nakedSingleFixture,
    description: nakedSingleFixture.description,
    glossaryTerms: ['placement'],
  },
  'hidden-single': {
    displayName: 'Hidden Single',
    tier: 'Medium',
    fixture: hiddenSingleFixture,
    description: hiddenSingleFixture.description,
    glossaryTerms: ['placement'],
  },
  pointing: {
    displayName: 'Pointing Pair',
    tier: 'Hard',
    fixture: pointingFixture,
    description: pointingFixture.description,
    glossaryTerms: ['box', 'elimination'],
  },
  'box-line-reduction': {
    displayName: 'Box/Line Reduction',
    tier: 'Hard',
    fixture: boxLineReductionFixture,
    description: boxLineReductionFixture.description,
    glossaryTerms: ['box', 'elimination'],
  },
  'naked-pair': {
    displayName: 'Naked Pair',
    tier: 'Hard',
    fixture: nakedPairFixture,
    description: nakedPairFixture.description,
    glossaryTerms: ['pair', 'elimination'],
  },
  'naked-triple': {
    displayName: 'Naked Triple',
    tier: 'Hard',
    fixture: nakedTripleFixture,
    description: nakedTripleFixture.description,
    glossaryTerms: ['pair', 'elimination'],
  },
  'naked-quad': {
    displayName: 'Naked Quad',
    tier: 'Hard',
    fixture: nakedQuadFixture,
    description: nakedQuadFixture.description,
    glossaryTerms: ['pair', 'elimination'],
  },
  'hidden-pair': {
    displayName: 'Hidden Pair',
    tier: 'Hard',
    fixture: hiddenPairFixture,
    description: hiddenPairFixture.description,
    glossaryTerms: ['pair', 'candidate', 'elimination'],
  },
  'hidden-triple': {
    displayName: 'Hidden Triple',
    tier: 'Hard',
    fixture: hiddenTripleFixture,
    description: hiddenTripleFixture.description,
    glossaryTerms: ['pair', 'candidate', 'elimination'],
  },
  'hidden-quad': {
    displayName: 'Hidden Quad',
    tier: 'Hard',
    fixture: hiddenQuadFixture,
    description: hiddenQuadFixture.description,
    glossaryTerms: ['pair', 'candidate', 'elimination'],
  },
  'x-wing': {
    displayName: 'X-Wing',
    tier: 'Expert',
    fixture: xWingFixture,
    description: xWingFixture.description,
    glossaryTerms: ['candidate', 'elimination'],
  },
  swordfish: {
    displayName: 'Swordfish',
    tier: 'Expert',
    fixture: swordfishFixture,
    description: swordfishFixture.description,
    glossaryTerms: ['candidate', 'elimination'],
  },
  jellyfish: {
    displayName: 'Jellyfish',
    tier: 'Expert',
    fixture: jellyfishFixture,
    description: jellyfishFixture.description,
    glossaryTerms: ['candidate', 'elimination'],
  },
  'xy-wing': {
    displayName: 'XY-Wing',
    tier: 'Expert',
    fixture: xyWingFixture,
    description: xyWingFixture.description,
    glossaryTerms: ['pivot-pincer', 'candidate', 'elimination'],
  },
  'xyz-wing': {
    displayName: 'XYZ-Wing',
    tier: 'Expert',
    fixture: xyzWingFixture,
    description: xyzWingFixture.description,
    glossaryTerms: ['pivot-pincer', 'candidate', 'elimination'],
  },
  'w-wing': {
    displayName: 'W-Wing',
    tier: 'Expert',
    fixture: wWingFixture,
    description: wWingFixture.description,
    glossaryTerms: ['candidate', 'elimination'],
  },
  'simple-coloring': {
    displayName: 'Simple Coloring',
    tier: 'Expert',
    fixture: simpleColoringFixture,
    description: simpleColoringFixture.description,
    glossaryTerms: ['cluster', 'candidate', 'elimination'],
  },
  'x-cycle': {
    displayName: 'X-Cycle',
    tier: 'Expert',
    fixture: xCycleFixture,
    description: xCycleFixture.description,
    glossaryTerms: ['chain', 'candidate', 'elimination'],
  },
  'empty-rectangle': {
    displayName: 'Empty Rectangle',
    tier: 'Expert',
    fixture: emptyRectangleFixture,
    description: emptyRectangleFixture.description,
    glossaryTerms: ['box', 'candidate', 'elimination'],
  },
  skyscraper: {
    displayName: 'Skyscraper',
    tier: 'Expert',
    fixture: skyscraperFixture,
    description: skyscraperFixture.description,
    glossaryTerms: ['candidate', 'elimination'],
  },
  'two-string-kite': {
    displayName: 'Two-String Kite',
    tier: 'Expert',
    fixture: twoStringKiteFixture,
    description: twoStringKiteFixture.description,
    glossaryTerms: ['box', 'candidate', 'elimination'],
  },
  'unique-rectangle': {
    displayName: 'Unique Rectangle',
    tier: 'Master',
    fixture: uniqueRectangleFixture,
    description: uniqueRectangleFixture.description,
  },
  'bug-plus-one': {
    displayName: 'BUG+1',
    tier: 'Master',
    fixture: bugFixture,
    description: bugFixture.description,
  },
  'xy-chain': {
    displayName: 'XY-Chain',
    tier: 'Master',
    fixture: xyChainFixture,
    description: xyChainFixture.description,
  },
  'multi-coloring': {
    displayName: 'Multi-Coloring',
    tier: 'Master',
    fixture: multiColoringFixture,
    description: multiColoringFixture.description,
  },
  'als-xz': {
    displayName: 'ALS-XZ',
    tier: 'Master',
    fixture: alsXzFixture,
    description: alsXzFixture.description,
  },
  'wxyz-wing': {
    displayName: 'WXYZ-Wing',
    tier: 'Master',
    fixture: wxyzWingFixture,
    description: wxyzWingFixture.description,
  },
  'hidden-rectangle': {
    displayName: 'Hidden Rectangle',
    tier: 'Master',
    fixture: hiddenRectangleFixture,
    description: hiddenRectangleFixture.description,
  },
  'avoidable-rectangle': {
    displayName: 'Avoidable Rectangle',
    tier: 'Master',
    fixture: avoidableRectangleFixture,
    description: avoidableRectangleFixture.description,
  },
  'nice-loop': {
    displayName: 'Nice Loop',
    tier: 'Nightmare',
    fixture: niceLoopFixture,
    description: niceLoopFixture.description,
  },
  'grouped-x-cycle': {
    displayName: 'Grouped X-Cycle',
    tier: 'Nightmare',
    fixture: groupedXCycleFixture,
    description: groupedXCycleFixture.description,
  },
  '3d-medusa': {
    displayName: '3D Medusa',
    tier: 'Nightmare',
    fixture: medusa3DFixture,
    description: medusa3DFixture.description,
  },
  'death-blossom': {
    displayName: 'Death Blossom',
    tier: 'Nightmare',
    fixture: deathBlossomFixture,
    description: deathBlossomFixture.description,
  },
  'forcing-chains': {
    displayName: 'Forcing Chains',
    tier: 'Nightmare',
    fixture: forcingChainsFixture,
    description: forcingChainsFixture.description,
  },
};

/**
 * Stable display order for the techniques list. Mirrors the difficulty-
 * ascending order used by the rater so iterating produces a tier-grouped
 * sequence (Easy first, Nightmare last). Consumers that just need to walk
 * every entry should map this list through `TECHNIQUE_CATALOG`.
 */
export const TECHNIQUE_ORDER: readonly TechniqueId[] = [
  'naked-single',
  'hidden-single',
  'pointing',
  'box-line-reduction',
  'naked-pair',
  'naked-triple',
  'naked-quad',
  'hidden-pair',
  'hidden-triple',
  'hidden-quad',
  'x-wing',
  'swordfish',
  'jellyfish',
  'xy-wing',
  'xyz-wing',
  'w-wing',
  'simple-coloring',
  'x-cycle',
  'empty-rectangle',
  'skyscraper',
  'two-string-kite',
  'unique-rectangle',
  'bug-plus-one',
  'xy-chain',
  'multi-coloring',
  'als-xz',
  'wxyz-wing',
  'hidden-rectangle',
  'avoidable-rectangle',
  'nice-loop',
  'grouped-x-cycle',
  '3d-medusa',
  'death-blossom',
  'forcing-chains',
];
