import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DARK_THEME,
  LIGHT_THEME,
  THEME_BROWSER_COLORS,
  THEME_STORAGE_KEY,
} from "../theme";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = LIGHT_THEME;
    const themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    themeMeta.content = THEME_BROWSER_COLORS[LIGHT_THEME];
    themeMeta.dataset.testThemeMeta = "";
    document.head.append(themeMeta);
  });

  afterEach(() => {
    document.querySelector("meta[data-test-theme-meta]")?.remove();
  });

  it("activa el tema oscuro y conserva la preferencia", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = await screen.findByRole("switch", { name: "Tema oscuro" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAttribute("title", "Cambiar al tema oscuro");

    await user.click(toggle);

    expect(document.documentElement).toHaveAttribute("data-theme", DARK_THEME);
    expect(document.documentElement.style.colorScheme).toBe(DARK_THEME);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(DARK_THEME);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      THEME_BROWSER_COLORS[DARK_THEME],
    );
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAccessibleName("Tema oscuro");
    expect(toggle).toHaveAttribute("title", "Cambiar al tema claro");
  });

  it("respeta el tema aplicado antes de la hidratación", async () => {
    document.documentElement.dataset.theme = DARK_THEME;

    render(<ThemeToggle />);

    const toggle = await screen.findByRole("switch", { name: "Tema oscuro" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await waitFor(() => {
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        THEME_BROWSER_COLORS[DARK_THEME],
      );
    });
  });

  it("sincroniza cambios realizados en otra pestaña", async () => {
    render(<ThemeToggle />);
    await screen.findByRole("switch", { name: "Tema oscuro" });

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: DARK_THEME,
      }),
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", DARK_THEME);
      expect(screen.getByRole("switch", { name: "Tema oscuro" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
  });
});
