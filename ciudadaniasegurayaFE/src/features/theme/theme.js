export const LIGHT_THEME = "light";
export const DARK_THEME = "dark";
export const THEME_STORAGE_KEY = "csy-theme";

export const THEME_BROWSER_COLORS = Object.freeze({
  [LIGHT_THEME]: "#eeeadd",
  [DARK_THEME]: "#27160e",
});

export function normalizeTheme(value) {
  return value === DARK_THEME ? DARK_THEME : LIGHT_THEME;
}

export function readStoredTheme(storage) {
  try {
    const source = storage ?? window.localStorage;
    return normalizeTheme(source.getItem(THEME_STORAGE_KEY));
  } catch {
    return LIGHT_THEME;
  }
}

export function persistTheme(theme, storage) {
  const normalized = normalizeTheme(theme);
  try {
    const target = storage ?? window.localStorage;
    target.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // La interfaz conserva el tema de la pestaña aunque el storage esté bloqueado.
  }
  if (typeof document !== "undefined") {
    document.cookie = `${THEME_STORAGE_KEY}=${normalized}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
}

export function applyBrowserThemeColor(theme, target = document) {
  const normalized = normalizeTheme(theme);
  target
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_BROWSER_COLORS[normalized]);
  return normalized;
}

export function applyDocumentTheme(theme, root = document.documentElement) {
  const normalized = normalizeTheme(theme);
  root.dataset.theme = normalized;
  root.style.colorScheme = normalized;
  applyBrowserThemeColor(normalized);
  return normalized;
}
