import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Escribe tu correo o nombre de usuario.")
    .max(254, "El identificador es demasiado largo."),
  password: z
    .string()
    .min(1, "Escribe tu contraseña.")
    .max(128, "La contraseña es demasiado larga."),
});

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Usa al menos 3 caracteres.")
      .max(32, "Usa como máximo 32 caracteres.")
      .regex(/^[A-Za-z0-9_.-]+$/, "Usa letras, números, punto, guion o guion bajo."),
    email: z.email("Escribe un correo válido.").max(254),
    password: z
      .string()
      .min(12, "Usa al menos 12 caracteres.")
      .max(128, "Usa como máximo 128 caracteres.")
      .regex(/[a-z]/, "Incluye una letra minúscula.")
      .regex(/[A-Z]/, "Incluye una letra mayúscula.")
      .regex(/\d/, "Incluye un número."),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      error: "Debes aceptar los términos y el aviso de privacidad.",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    username: z.string(),
    email: z.email(),
    role: z.string(),
    status: z.string(),
    emailVerified: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    lastLoginAt: z.string().nullable(),
    authProviders: z.array(z.enum(["password", "google"])).optional(),
  }),
  accessToken: z.string().min(1),
  accessTokenExpiresIn: z.string(),
  refreshTokenExpiresAt: z.string(),
});
