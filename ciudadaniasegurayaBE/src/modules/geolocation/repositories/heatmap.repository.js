import { toObjectId } from "../../../shared/utils/object-id.js";

const VISIBLE_STATUSES = Object.freeze([
  "community_confirmed",
  "admin_verified",
]);

function viewportPolygon({ north, south, east, west }) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

function annualMatch({
  cityId,
  resolution,
  from,
  to,
  incidentType,
  h3Index,
  bounds,
}) {
  const h3Field = `h3Cells.${resolution}`;
  return {
    cityId: toObjectId(cityId),
    status: { $in: [...VISIBLE_STATUSES] },
    deletedAt: null,
    occurredAt: {
      $gte: from,
      $lte: to,
    },
    [h3Field]: h3Index ?? { $type: "string" },
    ...(incidentType ? { incidentType } : {}),
    ...(bounds
      ? {
          location: {
            $geoWithin: {
              $geometry: viewportPolygon(bounds),
            },
          },
        }
      : {}),
  };
}

function annualPipeline(input, limit = null) {
  const h3Field = `$h3Cells.${input.resolution}`;
  const pipeline = [
    {
      $match: annualMatch(input),
    },
    {
      $group: {
        _id: {
          h3Index: h3Field,
          incidentType: "$incidentType",
        },
        incidentCount: { $sum: 1 },
        lastUpdatedAt: { $max: "$updatedAt" },
      },
    },
    {
      $group: {
        _id: "$_id.h3Index",
        incidentCount: { $sum: "$incidentCount" },
        incidentTypes: {
          $push: {
            k: "$_id.incidentType",
            v: "$incidentCount",
          },
        },
        lastUpdatedAt: { $max: "$lastUpdatedAt" },
      },
    },
    {
      $project: {
        _id: 0,
        h3Index: "$_id",
        h3Resolution: { $literal: input.resolution },
        month: { $literal: null },
        incidentCount: 1,
        incidentTypes: { $arrayToObject: "$incidentTypes" },
        lastUpdatedAt: 1,
      },
    },
  ];

  if (limit) {
    pipeline.push({ $limit: limit });
  }

  return pipeline;
}

export function createHeatmapRepository(db) {
  const collection = db.collection("hex_monthly_stats");
  const incidents = db.collection("incidents");

  return Object.freeze({
    async adjustMany(adjustments, delta, now) {
      if (adjustments.length === 0) {
        return [];
      }

      await collection.bulkWrite(
        adjustments.map((adjustment) => ({
          updateOne: {
            filter: {
              cityId: toObjectId(adjustment.cityId),
              month: adjustment.month,
              h3Resolution: adjustment.h3Resolution,
              h3Index: adjustment.h3Index,
              ...(delta < 0 ? { incidentCount: { $gte: 1 } } : {}),
            },
            update: {
              $inc: {
                incidentCount: delta,
                [`incidentTypes.${adjustment.incidentType}`]: delta,
              },
              $set: {
                lastUpdatedAt: now,
              },
              $setOnInsert: {
                cityId: toObjectId(adjustment.cityId),
                month: adjustment.month,
                h3Resolution: adjustment.h3Resolution,
                h3Index: adjustment.h3Index,
                center: adjustment.center,
                level: 0,
                color: "#2563EB",
              },
            },
            upsert: delta > 0,
          },
        })),
        { ordered: true },
      );

      return collection
        .find({
          $or: adjustments.map((adjustment) => ({
            cityId: toObjectId(adjustment.cityId),
            month: adjustment.month,
            h3Resolution: adjustment.h3Resolution,
            h3Index: adjustment.h3Index,
          })),
        })
        .toArray();
    },
    updateStyles(styles, now) {
      if (styles.length === 0) {
        return Promise.resolve();
      }

      return collection.bulkWrite(
        styles.map(({ id, incidentCount, level, color }) => ({
          updateOne: {
            filter: {
              _id: id,
              incidentCount,
            },
            update: {
              $set: {
                level,
                color,
                lastUpdatedAt: now,
              },
            },
          },
        })),
      );
    },
    async queryViewport(input) {
      if (!input.month) {
        return incidents
          .aggregate(
            annualPipeline(
              {
                ...input,
                bounds: {
                  north: input.north,
                  south: input.south,
                  east: input.east,
                  west: input.west,
                },
              },
              10_000,
            ),
          )
          .toArray();
      }

      const filter = {
        cityId: toObjectId(input.cityId),
        month: input.month,
        h3Resolution: input.resolution,
        center: {
          $geoWithin: {
            $geometry: viewportPolygon(input),
          },
        },
      };

      if (input.incidentType) {
        filter[`incidentTypes.${input.incidentType}`] = { $gt: 0 };
      }

      return collection
        .find(filter, {
          projection: {
            h3Index: 1,
            h3Resolution: 1,
            month: 1,
            incidentCount: 1,
            incidentTypes: 1,
            level: 1,
            color: 1,
            lastUpdatedAt: 1,
          },
        })
        .limit(10_000)
        .toArray();
    },
    async findCell(input) {
      if (!input.month) {
        const [stat] = await incidents
          .aggregate(annualPipeline(input))
          .toArray();
        return stat ?? null;
      }

      return collection.findOne({
        cityId: toObjectId(input.cityId),
        month: input.month,
        h3Resolution: input.resolution,
        h3Index: input.h3Index,
      });
    },
  });
}
