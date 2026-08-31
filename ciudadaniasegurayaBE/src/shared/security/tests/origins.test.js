import { describe, expect, it } from "vitest";

import {
  compileOriginPattern,
  isAllowedOrigin,
  normalizeHttpOrigin,
} from "../origins.js";

describe("origenes HTTP permitidos", () => {
  it("normaliza origenes exactos y rechaza rutas o credenciales", () => {
    expect(normalizeHttpOrigin("https://App.Example.com")).toBe(
      "https://app.example.com",
    );
    expect(() =>
      normalizeHttpOrigin("https://app.example.com/login"),
    ).toThrow(/sin ruta/);
    expect(() =>
      normalizeHttpOrigin("https://user:secret@app.example.com"),
    ).toThrow(/sin ruta/);
  });

  it("acepta un preview fijado al proyecto y equipo", () => {
    const pattern = compileOriginPattern(
      "https://ciudadaniasegurayafe-*-equipo.vercel.app",
    );

    expect(
      isAllowedOrigin(
        "https://ciudadaniasegurayafe-a1b2c3-equipo.vercel.app",
        ["https://app.example.com"],
        [pattern],
      ),
    ).toBe(true);
    expect(
      isAllowedOrigin(
        "https://otro-proyecto-a1b2c3-equipo.vercel.app",
        [],
        [pattern],
      ),
    ).toBe(false);
  });

  it("rechaza comodines amplios o fuera del hostname HTTPS", () => {
    expect(() =>
      compileOriginPattern("https://*.vercel.app"),
    ).toThrow(/fijar el proyecto/);
    expect(() =>
      compileOriginPattern("http://app-*.example.test"),
    ).toThrow(/hostname HTTPS/);
    expect(() =>
      compileOriginPattern("https://app.example.com/*"),
    ).toThrow(/sin ruta/);
  });

  it("permite clientes sin Origin pero no origenes malformados", () => {
    expect(isAllowedOrigin(undefined, [], [])).toBe(true);
    expect(isAllowedOrigin("null", [], [])).toBe(false);
  });
});
