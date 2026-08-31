import { describe, expect, it } from "vitest";

import { safeReturnTo } from "./safe-return-to";

describe("safeReturnTo", () => {
  it.each([
    ["/", "/"],
    ["/cuenta", "/cuenta"],
    [
      "/reportar-incidente?source=login#ubicacion",
      "/reportar-incidente?source=login#ubicacion",
    ],
  ])("conserva una ruta interna valida", (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "\\\\evil.example",
    "/safe\\evil",
    "/safe\0evil",
    "",
    null,
    undefined,
  ])("rechaza un destino externo o malformado: %s", (value) => {
    expect(safeReturnTo(value, "/login")).toBe("/login");
  });
});
