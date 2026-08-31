const OPENSTREETMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

export function createOpenStreetMapStyle(tileUrl) {
  return {
    version: 8,
    name: "OpenStreetMap con calles",
    sources: {
      openstreetmap: {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: OPENSTREETMAP_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: "openstreetmap-streets",
        type: "raster",
        source: "openstreetmap",
        minzoom: 0,
        maxzoom: 20,
        paint: {
          "raster-opacity": 0.92,
          "raster-saturation": -0.12,
          "raster-contrast": 0.04,
        },
      },
    ],
  };
}
