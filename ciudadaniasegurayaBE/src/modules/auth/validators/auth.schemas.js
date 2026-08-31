import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(
    /^[A-Za-z0-9_.-]+$/,
    "Solo se permiten letras, numeros, punto, guion y guion bajo",
  );

export const displayNameSchema = z.string().trim().min(2).max(100);

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Debe incluir una minuscula")
  .regex(/[A-Z]/, "Debe incluir una mayuscula")
  .regex(/\d/, "Debe incluir un numero");

export const registerBodySchema = z
  .object({
    email: z.email().max(254),
    username: usernameSchema,
    displayName: displayNameSchema.optional(),
    password: passwordSchema,
  })
  .strict()
  .describe("Datos de registro");

export const loginBodySchema = z
  .object({
    identifier: z.string().trim().min(3).max(254),
    password: z.string().min(1).max(128),
  })
  .strict()
  .describe("Credenciales de acceso");

export const googleCredentialBodySchema = z
  .object({
    credential: z.string().trim().min(100).max(16_384),
  })
  .strict()
  .describe("Credencial ID emitida por Google Identity Services");

export const emptyOptionalBodySchema = z
  .null()
  .optional()
  .describe("La operacion no acepta datos en el body");
