import { toObjectId } from "../../../shared/utils/object-id.js";

export function createCitiesRepository(db) {
  const collection = db.collection("cities");

  return Object.freeze({
    listActive() {
      return collection
        .find(
          { active: true },
          {
            projection: {
              name: 1,
              slug: 1,
              countryCode: 1,
              timezone: 1,
              boundary: 1,
              center: 1,
              bounds: 1,
              boundarySource: 1,
            },
          },
        )
        .sort({ name: 1 })
        .toArray();
    },
    findActiveById(cityId) {
      return collection.findOne(
        {
          _id: toObjectId(cityId),
          active: true,
        },
        {
          projection: {
            name: 1,
            slug: 1,
            countryCode: 1,
            timezone: 1,
            boundary: 1,
            center: 1,
            bounds: 1,
            boundarySource: 1,
            active: 1,
          },
        },
      );
    },
  });
}
