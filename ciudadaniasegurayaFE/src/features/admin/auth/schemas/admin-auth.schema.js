import { z } from "zod";

export const adminLoginSchema = z.object({
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

export const adminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable().optional(),
  role: z.enum(["admin", "superadmin"]),
  permissions: z.array(z.string()).default([]),
  status: z.enum(["active", "suspended", "deleted"]).default("active"),
  lastLoginAt: z.string().nullable().optional(),
});

export const adminSessionSchema = z.object({
  accessToken: z.string().min(1),
  user: adminUserSchema,
});
