import type { Variant } from '../types';
import { classicVariant } from './classic';

export const variants: Record<string, Variant> = {
  [classicVariant.id]: classicVariant,
};

export function getVariant(id: string): Variant | undefined {
  return variants[id];
}

export { classicVariant };
