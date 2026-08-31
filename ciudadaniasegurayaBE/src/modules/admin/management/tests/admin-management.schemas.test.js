import { describe, expect, it } from "vitest";

import { administratorsQuerySchema } from "../validators/admin-management.schemas.js";

describe("schema de consulta de administradores", () => {
  it("acepta y normaliza una busqueda por nombre o correo", () => {
    expect(
      administratorsQuerySchema.parse({
        search: "  admin@example.com  ",
        status: "active",
      }),
    ).toEqual({
      page: 1,
      pageSize: 25,
      search: "admin@example.com",
      status: "active",
    });
  });

  it("rechaza busquedas vacias o que exceden el limite", () => {
    expect(administratorsQuerySchema.safeParse({ search: "   " }).success).toBe(
      false,
    );
    expect(
      administratorsQuerySchema.safeParse({ search: "a".repeat(121) }).success,
    ).toBe(false);
  });
});
