import { success } from "../../../shared/utils/response.js";

export function createStatisticsController(statisticsService) {
  return Object.freeze({
    async overview(request) {
      return success(
        request,
        await statisticsService.overview(request.query),
      );
    },
    async timeseries(request) {
      return success(
        request,
        await statisticsService.timeseries(request.query),
      );
    },
    async hourly(request) {
      return success(request, await statisticsService.hourly(request.query));
    },
    async types(request) {
      return success(request, await statisticsService.types(request.query));
    },
    async hexagon(request) {
      return success(
        request,
        await statisticsService.hexagon({
          ...request.query,
          h3Index: request.params.h3Index,
        }),
      );
    },
  });
}
