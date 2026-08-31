import { describe, expect, it } from "vitest";

import {
  oneCalendarYearBefore,
  ROLLING_YEAR_LABEL,
  ROLLING_YEAR_PERIOD,
  rollingYearRange,
} from "./rolling-year";

describe("ventana móvil anual", () => {
  it("representa el mismo instante del año calendario anterior", () => {
    expect(rollingYearRange(new Date("2026-07-27T12:00:00.000Z"))).toEqual({
      from: "2025-07-27T12:00:00.000Z",
      to: "2026-07-27T12:00:00.000Z",
    });
  });

  it("ubica el aniversario de un 29 de febrero al final de febrero", () => {
    expect(oneCalendarYearBefore(new Date("2024-02-29T08:30:00.000Z"))).toEqual(
      new Date("2023-02-28T08:30:00.000Z"),
    );
  });

  it("expone una clave estable y una etiqueta comprensible", () => {
    expect(ROLLING_YEAR_PERIOD).toBe("rolling-year");
    expect(ROLLING_YEAR_LABEL).toBe("Últimos 12 meses");
  });
});
