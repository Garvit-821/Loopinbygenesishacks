import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Shared with public/theme-init.js, which applies the theme before first paint. Keep both in sync. */
export const THEME_STORAGE_KEY = 'loopin.theme';
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f5f5f7', dark: '#000000' };

export const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function subscribeSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY);
  if (!query) return () => undefined;
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.(DARK_QUERY).matches ?? false;
}

/** Apply the theme to <html> and the theme-color metas (same rules as public/theme-init.js). */
function applyTheme(preference: ThemePreference, resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    if (preference === 'system') {
      // Restore the media-query defaults so the browser follows the system theme again.
      meta.content = meta.media.includes('dark') ? THEME_COLORS.dark : THEME_COLORS.light;
    } else {
      meta.content = THEME_COLORS[resolved];
    }
  });
}

interface ThemeContextValue {
  /** What the user picked. */
  theme: ThemePreference;
  /** What is on screen right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredPreference);
  const systemDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => false);
  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useLayoutEffect(() => {
    applyTheme(theme, resolvedTheme);
  }, [theme, resolvedTheme]);

  // Follow changes made in other tabs.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setThemeState(isPreference(event.newValue) ? event.newValue : 'system');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisted (storage blocked); still applies for this session.
    }
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
