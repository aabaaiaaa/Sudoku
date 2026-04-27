import type { Board, Digit, Position } from '../../types';
import {
  findNakedQuad as findNakedQuadImpl,
  type NakedSubsetElimination,
  type NakedSubsetResult,
} from './naked-subset';

export type NakedQuadElimination = NakedSubsetElimination;

export interface NakedQuadResult extends Omit<NakedSubsetResult, 'technique' | 'size'> {
  technique: 'naked-quad';
  size: 4;
}

export function findNakedQuad(board: Board): NakedQuadResult | null {
  const result = findNakedQuadImpl(board);
  if (result === null) return null;
  return result as NakedQuadResult;
}

export type { Digit, Position };
