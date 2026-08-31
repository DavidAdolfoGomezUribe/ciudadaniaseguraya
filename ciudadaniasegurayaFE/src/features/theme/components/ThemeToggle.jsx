"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  applyBrowserThemeColor,
  applyDocumentTheme,
  DARK_THEME,
  LIGHT_THEME,
  normalizeTheme,
  persistTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
} from "../theme";

const THEME_CHANGE_EVENT = "csy-theme-change";

function getClientTheme() {
  return normalizeTheme(document.documentElement.dataset.theme);
}

function getServerTheme() {
  return LIGHT_THEME;
}

function subscribeToTheme(onStoreChange) {
  const synchronizeTabs = (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyDocumentTheme(normalizeTheme(event.newValue));
    onStoreChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", synchronizeTabs);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", synchronizeTabs);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getClientTheme, getServerTheme);
  const dark = theme === DARK_THEME;

  useEffect(() => {
    const storedTheme = readStoredTheme();
    if (storedTheme === getClientTheme()) return;

    persistTheme(storedTheme);
    window.location.reload();
  }, []);

  useEffect(() => {
    applyBrowserThemeColor(theme);
  }, [theme]);

  const targetTheme = dark ? LIGHT_THEME : DARK_THEME;
  const targetLabel = dark ? "claro" : "oscuro";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Tema oscuro"
      title={`Cambiar al tema ${targetLabel}`}
      className="theme-rocker shrink-0"
      onClick={() => {
        const next = applyDocumentTheme(targetTheme);
        persistTheme(next);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }}
    >
      <span className="theme-rocker__housing" aria-hidden="true">
        <span className="theme-rocker__switch">
          <span className="theme-rocker__mark theme-rocker__mark--off">O</span>
          <span className="theme-rocker__mark theme-rocker__mark--on">I</span>
        </span>
      </span>
    </button>
  );
}
