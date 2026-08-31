import { afterEach, describe, expect, it, vi } from "vitest";

import { incidentReportFormSchema, toIncidentPayload } from "./incident-report.schema";

const validReport = {
  cityId: "64b7f0e4a1c2d3e4f5a6b7c8",
  incidentType: "theft",
  title: "  Hurto en transporte público  ",
  description: "  El incidente ocurrió dentro de un bus urbano.  ",
  date: "2025-01-15",
  time: "12:30",
  latitude: "4.711",
  longitude: "-74.0721",
  locationPrecision: "approximate",
  address: "  Carrera 7 # 10-20  ",
  neighborhood: "  Centro  ",
  sourceUrl: "https://example.com/noticia",
  evidenceDescription: "  Nota publicada por un medio local.  ",
  confirmLocation: true,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("incidentReportFormSchema", () => {
  it("acepta, recorta y convierte un reporte valido", () => {
    expect(incidentReportFormSchema.parse(validReport)).toMatchObject({
      cityId: validReport.cityId,
      incidentType: "theft",
      title: "Hurto en transporte público",
      description: "El incidente ocurrió dentro de un bus urbano.",
      latitude: 4.711,
      longitude: -74.0721,
      address: "Carrera 7 # 10-20",
      neighborhood: "Centro",
      confirmLocation: true,
    });
  });

  it.each([
    [{ cityId: "bogota" }, "cityId"],
    [{ incidentType: "" }, "incidentType"],
    [{ title: "cort" }, "title"],
    [{ description: "muy corta" }, "description"],
    [{ date: "15/01/2025" }, "date"],
    [{ time: "24:01" }, "time"],
    [{ latitude: 91 }, "latitude"],
    [{ longitude: -181 }, "longitude"],
    [{ locationPrecision: "street" }, "locationPrecision"],
    [{ sourceUrl: "javascript:alert(1)" }, "sourceUrl"],
    [{ confirmLocation: false }, "confirmLocation"],
  ])("rechaza un campo incompatible con el contrato: %s", (change, field) => {
    const result = incidentReportFormSchema.safeParse({
      ...validReport,
      ...change,
    });
    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rechaza fechas ubicadas más de cinco minutos en el futuro", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));

    const result = incidentReportFormSchema.safeParse({
      ...validReport,
      date: "2026-07-27",
      time: "12:00",
    });

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["date"],
          message: "La fecha no puede estar más de cinco minutos en el futuro.",
        }),
      ]),
    );
  });

  it("rechaza propiedades adicionales", () => {
    expect(
      incidentReportFormSchema.safeParse({
        ...validReport,
        moderationStatus: "validated",
      }).success,
    ).toBe(false);
  });
});

describe("toIncidentPayload", () => {
  it("crea el payload UTC y omite valores opcionales vacios", () => {
    expect(
      toIncidentPayload({
        ...validReport,
        address: " ",
        neighborhood: "",
        sourceUrl: "",
        evidenceDescription: " ",
      }),
    ).toEqual({
      cityId: validReport.cityId,
      incidentType: "theft",
      title: "Hurto en transporte público",
      description: "El incidente ocurrió dentro de un bus urbano.",
      occurredAt: "2025-01-15T17:30:00.000Z",
      latitude: 4.711,
      longitude: -74.0721,
      locationPrecision: "approximate",
    });
  });
});
