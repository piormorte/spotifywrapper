export type ThemePreference = 'system' | 'light' | 'dark';

/** Applies the theme to <html>. "system" defers to prefers-color-scheme. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset['theme'];
  else root.dataset['theme'] = preference;
}

export const THEME_SEGMENTS = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
] as const satisfies readonly { value: ThemePreference; label: string }[];
