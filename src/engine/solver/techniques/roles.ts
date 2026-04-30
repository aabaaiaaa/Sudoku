export type CellRole =
  | 'pattern-primary'
  | 'pattern-secondary'
  | 'pivot'
  | 'pincer'
  | 'cluster-a'
  | 'cluster-b'
  | 'chain-link'
  | 'corner'
  | 'elimination'
  | 'placement';

export const roleLabels: Record<CellRole, string> = {
  'pattern-primary': 'Pattern',
  'pattern-secondary': 'Supporting cells',
  'pivot': 'Centre cell',
  'pincer': 'Side cell',
  'cluster-a': 'Group A',
  'cluster-b': 'Group B',
  'chain-link': 'Chain step',
  'corner': 'Rectangle corner',
  'elimination': 'Cells affected',
  'placement': 'Place number here',
};

// Precedence: placement and elimination beat all pattern roles;
// pattern-primary beats all other pattern roles including pattern-secondary.
const ROLE_PRECEDENCE: readonly CellRole[] = [
  'placement',
  'elimination',
  'pattern-primary',
  'pivot',
  'pincer',
  'cluster-a',
  'cluster-b',
  'chain-link',
  'corner',
  'pattern-secondary',
];

/**
 * Given a list of roles assigned to the same cell, return the single role that
 * wins by the precedence chain above. `placement` beats `elimination` beats all
 * pattern roles; `pattern-primary` beats `pattern-secondary`.
 */
export function mergeCellRoles(roles: CellRole[]): CellRole {
  if (roles.length === 0) throw new Error('mergeCellRoles: empty roles array');
  let bestIndex = ROLE_PRECEDENCE.indexOf(roles[0]);
  let bestRole = roles[0];
  for (let i = 1; i < roles.length; i++) {
    const idx = ROLE_PRECEDENCE.indexOf(roles[i]);
    if (idx < bestIndex) {
      bestIndex = idx;
      bestRole = roles[i];
    }
  }
  return bestRole;
}
