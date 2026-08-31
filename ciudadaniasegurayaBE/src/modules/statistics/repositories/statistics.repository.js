import { toObjectId } from "../../../shared/utils/object-id.js";

export const PUBLIC_STATISTICS_STATUSES = Object.freeze([
  "community_confirmed",
  "admin_verified",
]);

const GROUP_FORMATS = Object.freeze({
  year: "%Y",
  month: "%Y-%m",
  day: "%Y-%m-%d",
  hour: "%Y-%m-%dT%H:00",
});

export function buildStatisticsMatch({
  cityId,
  h3Index,
  h3Indexes,
  h3Resolution,
  from,
  to,
  incidentType,
}) {
  const match = {
    status: { $in: [...PUBLIC_STATISTICS_STATUSES] },
    deletedAt: null,
    occurredAt: {
      $gte: from,
      $lte: to,
    },
  };

  if (cityId) {
    match.cityId = toObjectId(cityId);
  }
  if (incidentType) {
    match.incidentType = incidentType;
  }
  if (h3Indexes?.length) {
    match[`h3Cells.${h3Resolution}`] = { $in: h3Indexes };
  } else if (h3Index) {
    match[`h3Cells.${h3Resolution}`] = h3Index;
  }

  return match;
}

export function createStatisticsRepository(db) {
  const incidents = db.collection("incidents");

  return Object.freeze({
    async overview(input) {
      const [result] = await incidents
        .aggregate([
          { $match: buildStatisticsMatch(input) },
          {
            $group: {
              _id: null,
              incidentCount: { $sum: 1 },
              communityConfirmedCount: {
                $sum: {
                  $cond: [{ $eq: ["$status", "community_confirmed"] }, 1, 0],
                },
              },
              adminVerifiedCount: {
                $sum: {
                  $cond: [{ $eq: ["$status", "admin_verified"] }, 1, 0],
                },
              },
              firstOccurredAt: { $min: "$occurredAt" },
              lastOccurredAt: { $max: "$occurredAt" },
              lastUpdatedAt: { $max: "$updatedAt" },
            },
          },
          { $project: { _id: 0 } },
        ])
        .toArray();

      return (
        result ?? {
          incidentCount: 0,
          communityConfirmedCount: 0,
          adminVerifiedCount: 0,
          firstOccurredAt: null,
          lastOccurredAt: null,
          lastUpdatedAt: null,
        }
      );
    },

    async timeseries(input) {
      return incidents
        .aggregate([
          { $match: buildStatisticsMatch(input) },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: "$occurredAt",
                  format: GROUP_FORMATS[input.groupBy],
                  timezone: input.timezone,
                },
              },
              incidentCount: { $sum: 1 },
              lastUpdatedAt: { $max: "$updatedAt" },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              key: "$_id",
              incidentCount: 1,
              lastUpdatedAt: 1,
            },
          },
        ])
        .toArray();
    },

    async hourly(input) {
      return incidents
        .aggregate([
          { $match: buildStatisticsMatch(input) },
          {
            $group: {
              _id: {
                $hour: {
                  date: "$occurredAt",
                  timezone: input.timezone,
                },
              },
              incidentCount: { $sum: 1 },
              lastUpdatedAt: { $max: "$updatedAt" },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              hour: "$_id",
              incidentCount: 1,
              lastUpdatedAt: 1,
            },
          },
        ])
        .toArray();
    },

    async types(input) {
      return incidents
        .aggregate([
          { $match: buildStatisticsMatch(input) },
          {
            $group: {
              _id: "$incidentType",
              incidentCount: { $sum: 1 },
              lastUpdatedAt: { $max: "$updatedAt" },
            },
          },
          { $sort: { incidentCount: -1, _id: 1 } },
          {
            $project: {
              _id: 0,
              incidentType: "$_id",
              incidentCount: 1,
              lastUpdatedAt: 1,
            },
          },
        ])
        .toArray();
    },

    async byHexagons(input) {
      const h3Field = `$h3Cells.${input.h3Resolution}`;
      return incidents
        .aggregate([
          { $match: buildStatisticsMatch(input) },
          {
            $group: {
              _id: h3Field,
              incidentCount: { $sum: 1 },
              lastUpdatedAt: { $max: "$updatedAt" },
            },
          },
          {
            $project: {
              _id: 0,
              h3Index: "$_id",
              incidentCount: 1,
              lastUpdatedAt: 1,
            },
          },
        ])
        .toArray();
    },
  });
}
