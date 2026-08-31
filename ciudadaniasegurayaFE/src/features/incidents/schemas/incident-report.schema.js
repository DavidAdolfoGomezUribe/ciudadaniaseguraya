import { z } from "zod";

const httpUrlOrEmpty = z
  .string()
  .max(2048, "La URL es demasiado larga.")
  .refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Usa una URL HTTP o HTTPS válida.");

export const incidentReportFormSchema = z
  .object({
    cityId: z.string().regex(/^[a-f\d]{24}$/i, "Selecciona una ciudad."),
    incidentType: z.string().min(1, "Selecciona un tipo de incidente."),
    title: z
      .string()
      .trim()
      .min(5, "Escribe al menos 5 caracteres.")
      .max(120, "Usa como máximo 120 caracteres."),
    description: z
      .string()
      .trim()
      .min(10, "Escribe al menos 10 caracteres.")
      .max(2000, "Usa como máximo 2.000 caracteres."),
    date: z.string().date("Selecciona una fecha válida."),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Selecciona una hora válida."),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    locationPrecision: z.enum(["exact", "approximate", "hexagon"]),
    address: z.string().trim().max(200).optional(),
    neighborhood: z.string().trim().max(100).optional(),
    sourceUrl: httpUrlOrEmpty.optional(),
    evidenceDescription: z.string().trim().max(500).optional(),
    confirmLocation: z.literal(true, {
      error: "Confirma que la ubicación corresponde al incidente.",
    }),
  })
  .strict()
  .refine(
    ({ date, time }) => {
      const occurredAt = new Date(`${date}T${time}:00-05:00`);
      return (
        !Number.isNaN(occurredAt.getTime()) &&
        occurredAt.getTime() <= Date.now() + 5 * 60 * 1000
      );
    },
    {
      message: "La fecha no puede estar más de cinco minutos en el futuro.",
      path: ["date"],
    },
  )
  .refine(
    ({ latitude, longitude }) =>
      latitude >= -4.6 && latitude <= 13.7 && longitude >= -79.2 && longitude <= -66.5,
    {
      message: "Selecciona una ubicación dentro de los límites generales de Colombia.",
      path: ["latitude"],
    },
  );

export function toIncidentPayload(values) {
  return {
    cityId: values.cityId,
    incidentType: values.incidentType,
    title: values.title.trim(),
    description: values.description.trim(),
    occurredAt: new Date(`${values.date}T${values.time}:00-05:00`).toISOString(),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    locationPrecision: values.locationPrecision,
    ...(values.address?.trim() ? { address: values.address.trim() } : {}),
    ...(values.neighborhood?.trim()
      ? { neighborhood: values.neighborhood.trim() }
      : {}),
    ...(values.sourceUrl?.trim() ? { sourceUrl: values.sourceUrl.trim() } : {}),
    ...(values.evidenceDescription?.trim()
      ? { evidenceDescription: values.evidenceDescription.trim() }
      : {}),
  };
}
