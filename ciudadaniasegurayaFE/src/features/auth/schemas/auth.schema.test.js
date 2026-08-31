import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "./auth.schema";

const validRegistration = {
  username: "usuario_seguro",
  email: "persona@example.com",
  password: "Clave-Segura-2026",
  confirmPassword: "Clave-Segura-2026",
  acceptTerms: true,
};

describe("loginSchema", () => {
  it("acepta y normaliza un identificador valido", () => {
    expect(
      loginSchema.parse({
        identifier: "  usuario_seguro  ",
        password: "secreto",
      }),
    ).toEqual({
      identifier: "usuario_seguro",
      password: "secreto",
    });
  });

  it.each([
    [{ identifier: "", password: "" }, "identifier"],
    [{ identifier: "ab", password: "secreto" }, "identifier"],
    [{ identifier: "usuario", password: "" }, "password"],
    [{ identifier: "usuario", password: "x".repeat(129) }, "password"],
  ])("rechaza credenciales invalidas %#", (input, field) => {
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });
});

describe("registerSchema", () => {
  it("acepta un registro compatible con el backend", () => {
    expect(registerSchema.parse(validRegistration)).toEqual(validRegistration);
  });

  it.each([
    [{ username: "ab" }, "username"],
    [{ username: "usuario con espacio" }, "username"],
    [{ email: "correo-invalido" }, "email"],
    [{ password: "demasiado-corta" }, "password"],
    [{ password: "clave-sin-mayuscula-2026" }, "password"],
    [{ password: "CLAVE-SIN-MINUSCULA-2026" }, "password"],
    [{ password: "ClaveSinNumeroSeguro" }, "password"],
    [{ confirmPassword: "Otra-Clave-2026" }, "confirmPassword"],
    [{ acceptTerms: false }, "acceptTerms"],
  ])("rechaza un registro invalido en %s", (change, field) => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      ...change,
    });
    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });
});
