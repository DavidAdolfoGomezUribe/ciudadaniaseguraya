import {
  cellToBoundary,
  cellToLatLng,
  getResolution,
  gridDisk,
  isValidCell,
  latLngToCell,
} from "h3-js";

import { AppError } from "../../../shared/errors/app-error.js";

export function toGeoJsonPoint({ latitude, longitude }) {
  return {
    type: "Point",
    coordinates: [longitude, latitude],
  };
}

export function coordinatesFromPoint(point) {
  const [longitude, latitude] = point.coordinates;
  return { latitude, longitude };
}

export function h3Cell(latitude, longitude, resolution) {
  const index = latLngToCell(latitude, longitude, resolution);

  if (!isValidCell(index) || getResolution(index) !== resolution) {
    throw new Error("No fue posible generar un indice H3 valido");
  }

  return index;
}

export function h3CellsForResolutions(
  latitude,
  longitude,
  resolutions,
) {
  return Object.fromEntries(
    resolutions.map((resolution) => [
      String(resolution),
      h3Cell(latitude, longitude, resolution),
    ]),
  );
}

export function neighboringCells(index, radius = 1) {
  return gridDisk(index, radius);
}

export function h3Center(index) {
  const [latitude, longitude] = cellToLatLng(index);
  return {
    latitude,
    longitude,
    point: toGeoJsonPoint({ latitude, longitude }),
  };
}

export function h3Boundary(index) {
  const coordinates = cellToBoundary(index, true).map(
    ([longitude, latitude]) => [longitude, latitude],
  );
  coordinates.push([...coordinates[0]]);

  return {
    type: "Polygon",
    coordinates: [coordinates],
  };
}

export function assertValidH3Cell(index) {
  if (!isValidCell(index)) {
    throw new AppError({
      code: "INVALID_H3_INDEX",
      message: "El indice H3 no es valido",
      statusCode: 400,
    });
  }

  return index;
}

export { getResolution as h3Resolution };
