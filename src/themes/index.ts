export type ThemeId = 'light' | 'dark' | 'notepad' | 'space';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
}

export const themes: Record<ThemeId, ThemeDefinition> = {
  light: { id: 'light', label: 'Light' },
  dark: { id: 'dark', label: 'Dark' },
  notepad: { id: 'notepad', label: 'Notepad' },
  space: { id: 'space', label: 'Space' },
};

export function getTheme(id: ThemeId): ThemeDefinition {
  return themes[id];
}
