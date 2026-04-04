export const THEME_STORAGE_KEY = 'theme-preference';
export const THEME_CHANGE_EVENT = 'theme-change';
export const THEME_SNAPSHOT_SEPARATOR = ':';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
}

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: '系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
}

export function serializeThemeState(state: ThemeState): string {
  return `${state.preference}${THEME_SNAPSHOT_SEPARATOR}${state.resolvedTheme}`;
}

export function parseThemeSnapshot(snapshot: string): ThemeState {
  const [preference, resolvedTheme] = snapshot.split(THEME_SNAPSHOT_SEPARATOR);
  return {
    preference: isThemePreference(preference) ? preference : 'system',
    resolvedTheme: resolvedTheme === 'dark' ? 'dark' : 'light',
  };
}

export function getServerThemeSnapshot(): string {
  return serializeThemeState({ preference: 'system', resolvedTheme: 'light' });
}

export function getBrowserThemeSnapshot(): string {
  if (typeof window === 'undefined') {
    return getServerThemeSnapshot();
  }

  const preference = isThemePreference(document.documentElement.dataset.themePreference)
    ? document.documentElement.dataset.themePreference
    : 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  return serializeThemeState({
    preference,
    resolvedTheme: resolveTheme(preference, prefersDark),
  });
}

export function applyTheme(preference: ThemePreference, resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = preference;
}

export function setThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') return;

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedTheme = resolveTheme(preference, prefersDark);

  localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyTheme(preference, resolvedTheme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
}

export function subscribeThemeChange(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handleThemeChange = () => onStoreChange();
  const handleSystemChange = () => {
    const { preference } = parseThemeSnapshot(getBrowserThemeSnapshot());
    if (preference !== 'system') return;
    applyTheme('system', resolveTheme('system', media.matches));
    onStoreChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  media.addEventListener('change', handleSystemChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    media.removeEventListener('change', handleSystemChange);
  };
}

export function getThemeInitScript(): string {
  return `
    (() => {
      try {
        const storageKey = '${THEME_STORAGE_KEY}';
        const root = document.documentElement;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const stored = localStorage.getItem(storageKey);
        const preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
        const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
        root.classList.toggle('dark', resolved === 'dark');
        root.style.colorScheme = resolved;
        root.dataset.theme = resolved;
        root.dataset.themePreference = preference;
      } catch (error) {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
        document.documentElement.dataset.theme = 'light';
        document.documentElement.dataset.themePreference = 'system';
      }
    })();
  `;
}
