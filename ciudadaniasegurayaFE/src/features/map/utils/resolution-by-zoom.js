export function resolutionByZoom(zoom) {
  if (!Number.isFinite(zoom)) return 4;
  if (zoom < 6) return 4;
  if (zoom < 8) return 5;
  if (zoom < 10) return 6;
  if (zoom < 12) return 7;
  if (zoom < 14) return 8;
  return 9;
}
