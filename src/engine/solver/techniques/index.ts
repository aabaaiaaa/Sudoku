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

export type TechniqueId =
  | 'naked-single'
  | 'hidden-single'
  | 'naked-pair'
  | 'naked-triple'
  | 'pointing'
  | 'box-line-reduction'
  | 'x-wing'
  | 'hidden-pair'
  | 'hidden-triple';

export type TechniqueResult =
  | NakedSingleResult
  | HiddenSingleResult
  | NakedSubsetResult
  | IntersectionResult
  | XWingResult;

export interface Technique {
  id: TechniqueId;
  find: (board: Board) => TechniqueResult | null;
}

/**
 * Techniques listed in increasing order of difficulty. `nextStep` walks this
 * list and returns the first technique that makes progress on the board.
 */
export const techniques: readonly Technique[] = [
  { id: 'naked-single', find: findNakedSingle },
  { id: 'hidden-single', find: findHiddenSingle },
  { id: 'naked-pair', find: findNakedPair },
  { id: 'naked-triple', find: findNakedTriple },
  { id: 'pointing', find: findPointing },
  { id: 'box-line-reduction', find: findBoxLineReduction },
  { id: 'x-wing', find: findXWing },
];

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
};
