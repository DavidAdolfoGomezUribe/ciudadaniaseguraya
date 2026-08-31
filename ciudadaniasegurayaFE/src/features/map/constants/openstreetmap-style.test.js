import { describe, expect, it } from "vitest";

import { createOpenStreetMapStyle } from "./openstreetmap-style";

describe("createOpenStreetMapStyle", () => {
  it("crea un mapa de calles con teselas y atribución de OpenStreetMap", () => {
    const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    const style = createOpenStreetMapStyle(tileUrl);

    expect(style.version).toBe(8);
    expect(style.sources.openstreetmap).toMatchObject({
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
    });
    expect(style.sources.openstreetmap.attribution).toContain("OpenStreetMap");
    expect(style.layers).toContainEqual(
      expect.objectContaining({
        id: "openstreetmap-streets",
        type: "raster",
        source: "openstreetmap",
      }),
    );
  });
});
