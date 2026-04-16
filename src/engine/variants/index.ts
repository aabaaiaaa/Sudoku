import type { Variant } from '../types';
import { classicVariant } from './classic';
import { miniVariant } from './mini';
import { sixVariant } from './six';

export const variants: Record<string, Variant> = {
  [classicVariant.id]: classicVariant,
  [miniVariant.id]: miniVariant,
  [sixVariant.id]: sixVariant,
};

export function getVariant(id: string): Variant | undefined {
  return variants[id];
}

export { classicVariant, miniVariant, sixVariant };
