import { peers } from './peers';
import type { Board, Digit, Position, Variant } from './types';
import { cloneBoard, createEmptyBoard } from './types';
import { getVariant } from './variants';

export { cloneBoard };

export function emptyBoard(variant: Variant): Board {
  return createEmptyBoard(variant);
}

function digitToChar(d: Digit): string {
  if (d >= 1 && d <= 9) return String(d);
  throw new Error(`Unsupported digit for serialization: ${d}`);
}

function charToDigit(ch: string): Digit {
  const n = Number(ch);
  if (!Number.isInteger(n) || n < 1 || n > 9) {
    throw new Error(`Invalid digit character: ${ch}`);
  }
  return n;
}

function notesToString(notes: Set<Digit>): string {
  return [...notes].sort((a, b) => a - b).map(digitToChar).join('');
}

function stringToNotes(s: string): Set<Digit> {
  const notes = new Set<Digit>();
  for (const ch of s) notes.add(charToDigit(ch));
  return notes;
}

export function serialize(board: Board): string {
  const { variant, cells } = board;
  const size = variant.size;
  const values: string[] = [];
  const givens: string[] = [];
  const notes: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = cells[r][c];
      values.push(cell.value == null ? '.' : digitToChar(cell.value));
      givens.push(cell.given ? '1' : '0');
      notes.push(notesToString(cell.notes));
    }
  }
  return `${variant.id}|${values.join('')}|${givens.join('')}|${notes.join(',')}`;
}

export function deserialize(input: string): Board {
  const parts = input.split('|');
  if (parts.length !== 4) {
    throw new Error(`Invalid serialized board: expected 4 sections, got ${parts.length}`);
  }
  const [variantId, valueStr, givenStr, notesStr] = parts;
  const variant = getVariant(variantId);
  if (!variant) {
    throw new Error(`Unknown variant: ${variantId}`);
  }
  const total = variant.size * variant.size;
  if (valueStr.length !== total) {
    throw new Error(`Invalid values length: expected ${total}, got ${valueStr.length}`);
  }
  if (givenStr.length !== total) {
    throw new Error(`Invalid givens length: expected ${total}, got ${givenStr.length}`);
  }
  const noteSegments = notesStr.split(',');
  if (noteSegments.length !== total) {
    throw new Error(`Invalid notes length: expected ${total}, got ${noteSegments.length}`);
  }
  const board = emptyBoard(variant);
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / variant.size);
    const c = i % variant.size;
    const vCh = valueStr[i];
    const gCh = givenStr[i];
    const cell = board.cells[r][c];
    cell.value = vCh === '.' ? null : charToDigit(vCh);
    cell.given = gCh === '1';
    cell.notes = stringToNotes(noteSegments[i]);
  }
  return board;
}

export function isComplete(board: Board): boolean {
  const { variant, cells } = board;
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      if (cells[r][c].value == null) return false;
    }
  }
  return findConflicts(board).length === 0;
}

export function findConflicts(board: Board): Position[] {
  const { variant, cells } = board;
  const keys = new Set<string>();
  for (let r = 0; r < variant.size; r++) {
    for (let c = 0; c < variant.size; c++) {
      const value = cells[r][c].value;
      if (value == null) continue;
      for (const p of peers(variant, { row: r, col: c })) {
        if (cells[p.row][p.col].value === value) {
          keys.add(`${r},${c}`);
          break;
        }
      }
    }
  }
  return [...keys].map((k) => {
    const [r, c] = k.split(',').map(Number);
    return { row: r, col: c };
  });
}
