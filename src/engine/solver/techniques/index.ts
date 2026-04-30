import type { Board } from '../../types';
import { findNakedSingle, type NakedSingleResult } from './naked-single';
import { findHiddenSingle, type HiddenSingleResult } from './hidden-single';
import {
  findNakedPair,
  findNakedTriple,
  type NakedSubsetResult,
} from './naked-subset';
import {
  findPointing,
  findBoxLineReduction,
  type IntersectionResult,
} from './intersection';
import { findXWing, type XWingResult } from './x-wing';
import { findHiddenPair, type HiddenPairResult } from './hidden-pair';
import { findHiddenTriple, type HiddenTripleResult } from './hidden-triple';
import { findNakedQuad, type NakedQuadResult } from './naked-quad';
import { findHiddenQuad, type HiddenQuadResult } from './hidden-quad';
import { findSwordfish, type SwordfishResult } from './swordfish';
import { findJellyfish, type JellyfishResult } from './jellyfish';
import { findXyWing, type XYWingResult } from './xy-wing';
import { findXyzWing, type XYZWingResult } from './xyz-wing';
import { findWWing, type WWingResult } from './w-wing';
import { findSimpleColoring, type SimpleColoringResult } from './simple-coloring';
import { findXCycle, type XCycleResult } from './x-cycle';
import { findEmptyRectangle, type EmptyRectangleResult } from './empty-rectangle';
import { findSkyscraper, type SkyscraperResult } from './skyscraper';
import { findTwoStringKite, type TwoStringKiteResult } from './two-string-kite';
import {
  findUniqueRectangle,
  type UniqueRectangleResult,
} from './unique-rectangle';
import { findBugPlus1, type BugPlus1Result } from './bug';
import { findXyChain, type XyChainResult } from './xy-chain';
import { findMultiColoring, type MultiColoringResult } from './multi-coloring';
import { findAlsXz, type AlsXzResult } from './als-xz';
import { findWxyzWing, type WxyzWingResult } from './wxyz-wing';
import {
  findHiddenRectangle,
  type HiddenRectangleResult,
} from './hidden-rectangle';
import {
  findAvoidableRectangle,
  type AvoidableRectangleResult,
} from './avoidable-rectangle';
import { findNiceLoop, type NiceLoopResult } from './nice-loop';
import {
  findGroupedXCycle,
  type GroupedXCycleResult,
} from './grouped-x-cycle';
import { find3DMedusa, type Medusa3DResult } from './medusa-3d';
import { findDeathBlossom, type DeathBlossomResult } from './death-blossom';
import { findForcingChains, type ForcingChainsResult } from './forcing-chains';

export type TechniqueId =
  | 'naked-single'
  | 'hidden-single'
  | 'pointing'
  | 'box-line-reduction'
  | 'naked-pair'
  | 'naked-triple'
  | 'naked-quad'
  | 'hidden-pair'
  | 'hidden-triple'
  | 'hidden-quad'
  | 'x-wing'
  | 'swordfish'
  | 'jellyfish'
  | 'xy-wing'
  | 'xyz-wing'
  | 'w-wing'
  | 'simple-coloring'
  | 'x-cycle'
  | 'empty-rectangle'
  | 'skyscraper'
  | 'two-string-kite'
  | 'unique-rectangle'
  | 'bug-plus-one'
  | 'xy-chain'
  | 'multi-coloring'
  | 'als-xz'
  | 'wxyz-wing'
  | 'hidden-rectangle'
  | 'avoidable-rectangle'
  | 'nice-loop'
  | 'grouped-x-cycle'
  | '3d-medusa'
  | 'death-blossom'
  | 'forcing-chains';

export type TechniqueResult =
  | NakedSingleResult
  | HiddenSingleResult
  | NakedSubsetResult
  | IntersectionResult
  | XWingResult
  | HiddenPairResult
  | HiddenTripleResult
  | NakedQuadResult
  | HiddenQuadResult
  | SwordfishResult
  | JellyfishResult
  | XYWingResult
  | XYZWingResult
  | WWingResult
  | SimpleColoringResult
  | XCycleResult
  | EmptyRectangleResult
  | SkyscraperResult
  | TwoStringKiteResult
  | UniqueRectangleResult
  | BugPlus1Result
  | XyChainResult
  | MultiColoringResult
  | AlsXzResult
  | WxyzWingResult
  | HiddenRectangleResult
  | AvoidableRectangleResult
  | NiceLoopResult
  | GroupedXCycleResult
  | Medusa3DResult
  | DeathBlossomResult
  | ForcingChainsResult;

export interface Technique {
  id: TechniqueId;
  find: (board: Board) => TechniqueResult | null;
}

/**
 * Techniques listed in increasing order of difficulty. `nextStep` walks this
 * list and returns the first technique that makes progress on the board.
 *
 * The canonical source of order is `TECHNIQUE_ORDER` in
 * `engine/solver/techniques/catalog.ts` — this cascade MUST match it exactly.
 * The rater's internal cascade in `engine/generator/rate.ts` is independent
 * and may differ; it does not need to follow the catalog.
 */
export const techniques: readonly Technique[] = [
  { id: 'naked-single', find: findNakedSingle },
  { id: 'hidden-single', find: findHiddenSingle },
  { id: 'pointing', find: findPointing },
  { id: 'box-line-reduction', find: findBoxLineReduction },
  { id: 'naked-pair', find: findNakedPair },
  { id: 'naked-triple', find: findNakedTriple },
  { id: 'naked-quad', find: findNakedQuad },
  { id: 'hidden-pair', find: findHiddenPair },
  { id: 'hidden-triple', find: findHiddenTriple },
  { id: 'hidden-quad', find: findHiddenQuad },
  { id: 'x-wing', find: findXWing },
  { id: 'swordfish', find: findSwordfish },
  { id: 'jellyfish', find: findJellyfish },
  { id: 'xy-wing', find: findXyWing },
  { id: 'xyz-wing', find: findXyzWing },
  { id: 'w-wing', find: findWWing },
  { id: 'simple-coloring', find: findSimpleColoring },
  { id: 'x-cycle', find: findXCycle },
  { id: 'empty-rectangle', find: findEmptyRectangle },
  { id: 'skyscraper', find: findSkyscraper },
  { id: 'two-string-kite', find: findTwoStringKite },
  { id: 'unique-rectangle', find: findUniqueRectangle },
  { id: 'bug-plus-one', find: findBugPlus1 },
  { id: 'xy-chain', find: findXyChain },
  { id: 'multi-coloring', find: findMultiColoring },
  { id: 'als-xz', find: findAlsXz },
  { id: 'wxyz-wing', find: findWxyzWing },
  { id: 'hidden-rectangle', find: findHiddenRectangle },
  { id: 'avoidable-rectangle', find: findAvoidableRectangle },
  { id: 'nice-loop', find: findNiceLoop },
  { id: 'grouped-x-cycle', find: findGroupedXCycle },
  { id: '3d-medusa', find: find3DMedusa },
  { id: 'death-blossom', find: findDeathBlossom },
  { id: 'forcing-chains', find: findForcingChains },
];

/**
 * Lookup table mapping each technique id to its finder function. Used by the
 * round-trip fixture test and any consumer that needs to run a specific
 * technique by id without walking the full cascade.
 */
export const FINDER_BY_ID: Record<TechniqueId, (board: Board) => TechniqueResult | null> = {
  'naked-single': findNakedSingle,
  'hidden-single': findHiddenSingle,
  'pointing': findPointing,
  'box-line-reduction': findBoxLineReduction,
  'naked-pair': findNakedPair,
  'naked-triple': findNakedTriple,
  'naked-quad': findNakedQuad,
  'hidden-pair': findHiddenPair,
  'hidden-triple': findHiddenTriple,
  'hidden-quad': findHiddenQuad,
  'x-wing': findXWing,
  'swordfish': findSwordfish,
  'jellyfish': findJellyfish,
  'xy-wing': findXyWing,
  'xyz-wing': findXyzWing,
  'w-wing': findWWing,
  'simple-coloring': findSimpleColoring,
  'x-cycle': findXCycle,
  'empty-rectangle': findEmptyRectangle,
  'skyscraper': findSkyscraper,
  'two-string-kite': findTwoStringKite,
  'unique-rectangle': findUniqueRectangle,
  'bug-plus-one': findBugPlus1,
  'xy-chain': findXyChain,
  'multi-coloring': findMultiColoring,
  'als-xz': findAlsXz,
  'wxyz-wing': findWxyzWing,
  'hidden-rectangle': findHiddenRectangle,
  'avoidable-rectangle': findAvoidableRectangle,
  'nice-loop': findNiceLoop,
  'grouped-x-cycle': findGroupedXCycle,
  '3d-medusa': find3DMedusa,
  'death-blossom': findDeathBlossom,
  'forcing-chains': findForcingChains,
};

/**
 * Apply the technique list in order and return the first result that makes
 * progress on the board, or null if no implemented technique advances it.
 */
export function nextStep(board: Board): TechniqueResult | null {
  for (const technique of techniques) {
    const result = technique.find(board);
    if (result !== null) return result;
  }
  return null;
}

export type {
  NakedSingleResult,
  HiddenSingleResult,
  NakedSubsetResult,
  IntersectionResult,
  XWingResult,
  HiddenPairResult,
  HiddenTripleResult,
  NakedQuadResult,
  HiddenQuadResult,
  SwordfishResult,
  JellyfishResult,
  XYWingResult,
  XYZWingResult,
  WWingResult,
  SimpleColoringResult,
  XCycleResult,
  EmptyRectangleResult,
  SkyscraperResult,
  TwoStringKiteResult,
  UniqueRectangleResult,
  BugPlus1Result,
  XyChainResult,
  MultiColoringResult,
  AlsXzResult,
  WxyzWingResult,
  HiddenRectangleResult,
  AvoidableRectangleResult,
  NiceLoopResult,
  GroupedXCycleResult,
  Medusa3DResult,
  DeathBlossomResult,
  ForcingChainsResult,
};
