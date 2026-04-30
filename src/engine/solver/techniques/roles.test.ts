import { describe, it, expect } from 'vitest';
import { mergeCellRoles, type CellRole } from './roles';

describe('mergeCellRoles', () => {
  it('returns the single role when given one', () => {
    expect(mergeCellRoles(['elimination'])).toBe('elimination');
  });

  it('placement beats elimination', () => {
    expect(mergeCellRoles(['elimination', 'placement'])).toBe('placement');
  });

  it('elimination beats pattern-primary', () => {
    expect(mergeCellRoles(['pattern-primary', 'elimination'])).toBe('elimination');
  });

  it('pattern-primary beats pattern-secondary', () => {
    expect(mergeCellRoles(['pattern-secondary', 'pattern-primary'])).toBe('pattern-primary');
  });

  it('placement beats every other role', () => {
    const roles: CellRole[] = [
      'pattern-secondary',
      'corner',
      'chain-link',
      'cluster-b',
      'placement',
    ];
    expect(mergeCellRoles(roles)).toBe('placement');
  });

  it('elimination beats all pattern roles', () => {
    const roles: CellRole[] = [
      'pivot',
      'pincer',
      'cluster-a',
      'pattern-primary',
      'elimination',
    ];
    expect(mergeCellRoles(roles)).toBe('elimination');
  });

  it('pattern-primary beats pivot, pincer, cluster, chain-link, corner, pattern-secondary', () => {
    const roles: CellRole[] = [
      'pattern-secondary',
      'corner',
      'chain-link',
      'cluster-b',
      'cluster-a',
      'pincer',
      'pivot',
      'pattern-primary',
    ];
    expect(mergeCellRoles(roles)).toBe('pattern-primary');
  });

  it('throws on empty array', () => {
    expect(() => mergeCellRoles([])).toThrow();
  });
});
