import { describe, expect, it } from "vitest";

import { fillRollingMonths } from "./chart-formatters";

describe("fillRollingMonths", () => {
  it("ordena los doce meses móviles y completa los meses sin datos", () => {
    const result = fillRollingMonths(
      [
        {
          key: "2025-08",
          label: "Agosto 2025",
          incidentCount: 2,
        },
        {
          key: "2026-07",
          label: "Julio 2026",
          incidentCount: 4,
        },
      ],
      "2026-07-27T12:00:00.000Z",
    );

    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({
      key: "2025-08",
      label: "Ago 25",
      incidentCount: 2,
    });
    expect(result.at(-1)).toEqual({
      key: "2026-07",
      label: "Jul 26",
      incidentCount: 4,
    });
    expect(result[1].incidentCount).toBe(0);
  });
});
