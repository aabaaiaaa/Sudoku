import { peers } from '../../peers';
import type { Board, Digit, Position } from '../../types';

export interface NakedSingleResult {
  technique: 'naked-single';
  cell: Position;
  digit: Digit;
  explanation: string;
}

export function findNakedSingle(board: Board): NakedSingleResult | null {
  const { variant, cells } = board;
  const size = variant.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c].value != null) continue;
      const used = new Set<Digit>();
      for (const p of peers(variant, { row: r, col: c })) {
        const v = cells[p.row][p.col].value;
        if (v != null) used.add(v);
      }
      const candidates: Digit[] = [];
      for (const d of variant.digits) {
        if (!used.has(d)) candidates.push(d);
        if (candidates.length > 1) break;
      }
      if (candidates.length === 1) {
        const digit = candidates[0];
        return {
          technique: 'naked-single',
          cell: { row: r, col: c },
          digit,
          explanation: `R${r + 1}C${c + 1} has only ${digit} as a candidate`,
        };
      }
    }
  }
  return null;
}
