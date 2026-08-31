import { success } from "../../../shared/utils/response.js";

export function createGeolocationController(geolocationService) {
  return Object.freeze({
    async cities(request) {
      return success(request, await geolocationService.cities());
    },
    async configuration(request) {
      return success(request, geolocationService.configuration());
    },
    async cell(request) {
      return success(request, geolocationService.cell(request.query));
    },
    async heatmap(request) {
      return success(
        request,
        await geolocationService.heatmap(request.query),
      );
    },
    async hexagon(request) {
      return success(
        request,
        await geolocationService.hexagon({
          ...request.params,
          ...request.query,
        }),
      );
    },
  });
}
