import { describe, expect, it } from "vitest";

import { createH3Layer } from "./createH3Layer";

const normalIndex = "8866e4281bfffff";
const selectedIndex = "8866e429b7fffff";
const cells = [
  {
    h3Index: normalIndex,
    color: "#2563EB",
    incidentCount: 0,
    level: 0,
  },
  {
    h3Index: selectedIndex,
    color: "#EF4444",
    incidentCount: 12,
    level: 4,
  },
];

describe("capa principal H3", () => {
  it("usa límites reales, cobertura completa y contornos dobles en píxeles", () => {
    const layer = createH3Layer({
      cells,
      selectedH3Index: selectedIndex,
      interactive: true,
      onHover: () => {},
      onClick: () => {},
    });

    expect(layer.props).toMatchObject({
      coverage: 1,
      highPrecision: true,
      filled: true,
      stroked: true,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 2,
      lineWidthMaxPixels: 6,
      pickable: true,
    });
    expect(layer.props.getLineWidth(cells[0])).toBe(2);
    expect(layer.props.getLineWidth(cells[1])).toBe(6);
  });
});
