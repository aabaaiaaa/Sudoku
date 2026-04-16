import type { Position, Variant } from './types';

function posKey(pos: Position): string {
  return `${pos.row},${pos.col}`;
}

function addIfDifferent(set: Position[], seen: Set<string>, candidate: Position, origin: Position): void {
  if (candidate.row === origin.row && candidate.col === origin.col) return;
  const key = posKey(candidate);
  if (seen.has(key)) return;
  seen.add(key);
  set.push(candidate);
}

export function rowPeers(variant: Variant, pos: Position): Position[] {
  const result: Position[] = [];
  for (let c = 0; c < variant.size; c++) {
    if (c === pos.col) continue;
    result.push({ row: pos.row, col: c });
  }
  return result;
}

export function colPeers(variant: Variant, pos: Position): Position[] {
  const result: Position[] = [];
  for (let r = 0; r < variant.size; r++) {
    if (r === pos.row) continue;
    result.push({ row: r, col: pos.col });
  }
  return result;
}

export function boxPeers(variant: Variant, pos: Position): Position[] {
  const result: Position[] = [];
  const boxStartRow = Math.floor(pos.row / variant.boxHeight) * variant.boxHeight;
  const boxStartCol = Math.floor(pos.col / variant.boxWidth) * variant.boxWidth;
  for (let r = boxStartRow; r < boxStartRow + variant.boxHeight; r++) {
    for (let c = boxStartCol; c < boxStartCol + variant.boxWidth; c++) {
      if (r === pos.row && c === pos.col) continue;
      result.push({ row: r, col: c });
    }
  }
  return result;
}

export function peers(variant: Variant, pos: Position): Position[] {
  const result: Position[] = [];
  const seen = new Set<string>();
  for (const p of rowPeers(variant, pos)) addIfDifferent(result, seen, p, pos);
  for (const p of colPeers(variant, pos)) addIfDifferent(result, seen, p, pos);
  for (const p of boxPeers(variant, pos)) addIfDifferent(result, seen, p, pos);
  return result;
}
