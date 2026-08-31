const objectIdSchema = { bsonType: "objectId" };
const nullableObjectIdSchema = { bsonType: ["objectId", "null"] };
const dateSchema = { bsonType: "date" };
const nullableDateSchema = { bsonType: ["date", "null"] };

const pointSchema = {
  bsonType: "object",
  required: ["type", "coordinates"],
  properties: {
    type: { enum: ["Point"] },
    coordinates: {
      bsonType: "array",
      minItems: 2,
      maxItems: 2,
      items: { bsonType: ["double", "int", "long", "decimal"] },
    },
  },
};

function jsonSchema(required, properties, constraints = {}) {
  return {
    $jsonSchema: {
      bsonType: "object",
      required,
      properties,
      additionalProperties: true,
      ...constraints,
    },
  };
}

export const collectionDefinitions = [
  {
    name: "users",
    validator: jsonSchema(
      [
        "email",
        "normalizedEmail",
        "username",
        "normalizedUsername",
        "role",
        "status",
        "emailVerified",
        "createdAt",
        "updatedAt",
      ],
      {
        email: { bsonType: "string" },
        normalizedEmail: { bsonType: "string" },
        username: { bsonType: "string" },
        normalizedUsername: { bsonType: "string" },
        displayName: { bsonType: ["string", "null"] },
        passwordHash: { bsonType: "string" },
        googleSubject: { bsonType: "string" },
        role: { enum: ["user", "admin", "superadmin"] },
        status: { enum: ["active", "suspended", "deleted"] },
        emailVerified: { bsonType: "bool" },
        adminMetadata: {
          bsonType: "object",
          properties: {
            promotedAt: dateSchema,
            promotedBy: nullableObjectIdSchema,
            promotionReason: { bsonType: "string" },
            promotionRequestId: nullableObjectIdSchema,
            promotionEffectsCompletedAt: nullableDateSchema,
            demotedAt: nullableDateSchema,
            demotedBy: nullableObjectIdSchema,
            demotionReason: { bsonType: "string" },
            suspensionReason: { bsonType: ["string", "null"] },
            deletedBy: nullableObjectIdSchema,
            deletionReason: { bsonType: "string" },
            isBootstrapSuperadmin: { bsonType: "bool" },
          },
        },
        createdAt: dateSchema,
        updatedAt: dateSchema,
        deletedAt: nullableDateSchema,
        lastLoginAt: nullableDateSchema,
      },
      {
        anyOf: [
          { required: ["passwordHash"] },
          { required: ["googleSubject"] },
        ],
      },
    ),
  },
  {
    name: "refresh_tokens",
    validator: jsonSchema(
      ["userId", "tokenHash", "expiresAt", "createdAt"],
      {
        userId: objectIdSchema,
        tokenHash: { bsonType: "string" },
        expiresAt: dateSchema,
        createdAt: dateSchema,
        revokedAt: nullableDateSchema,
        replacedByTokenHash: { bsonType: ["string", "null"] },
      },
    ),
  },
  {
    name: "admin_refresh_tokens",
    validator: jsonSchema(
      [
        "userId",
        "sessionId",
        "tokenHash",
        "expiresAt",
        "createdAt",
        "revokedAt",
      ],
      {
        userId: objectIdSchema,
        sessionId: { bsonType: "string" },
        tokenHash: { bsonType: "string" },
        expiresAt: dateSchema,
        createdAt: dateSchema,
        revokedAt: nullableDateSchema,
        replacedByTokenHash: { bsonType: ["string", "null"] },
        lastUsedAt: nullableDateSchema,
        ipAddress: { bsonType: ["string", "null"] },
        userAgent: { bsonType: ["string", "null"] },
      },
    ),
  },
  {
    name: "cities",
    validator: jsonSchema(
      [
        "name",
        "slug",
        "countryCode",
        "timezone",
        "active",
        "createdAt",
        "updatedAt",
      ],
      {
        name: { bsonType: "string" },
        slug: { bsonType: "string" },
        countryCode: { bsonType: "string" },
        timezone: { bsonType: "string" },
        active: { bsonType: "bool" },
        boundary: {
          bsonType: ["object", "null"],
          properties: {
            type: { enum: ["Polygon", "MultiPolygon"] },
            coordinates: { bsonType: "array" },
          },
        },
        center: {
          ...pointSchema,
          bsonType: ["object", "null"],
        },
        bounds: {
          bsonType: ["object", "null"],
          required: ["north", "south", "east", "west"],
          properties: {
            north: { bsonType: ["double", "int", "long", "decimal"] },
            south: { bsonType: ["double", "int", "long", "decimal"] },
            east: { bsonType: ["double", "int", "long", "decimal"] },
            west: { bsonType: ["double", "int", "long", "decimal"] },
          },
        },
        boundarySource: {
          bsonType: ["object", "null"],
          properties: {
            name: { bsonType: "string" },
            url: { bsonType: "string" },
            license: { bsonType: "string" },
            retrievedAt: { bsonType: "string" },
            simplificationToleranceDegrees: {
              bsonType: ["double", "int", "long", "decimal"],
            },
          },
        },
        createdAt: dateSchema,
        updatedAt: dateSchema,
      },
    ),
  },
  {
    name: "incidents",
    validator: jsonSchema(
      [
        "cityId",
        "incidentType",
        "title",
        "description",
        "occurredAt",
        "reportedAt",
        "location",
        "locationPrecision",
        "h3Index",
        "h3Resolution",
        "h3Cells",
        "status",
        "verification",
        "createdBy",
        "createdByRole",
        "statisticsApplied",
        "createdAt",
        "updatedAt",
      ],
      {
        cityId: objectIdSchema,
        incidentType: { bsonType: "string" },
        title: { bsonType: "string" },
        description: { bsonType: "string" },
        occurredAt: dateSchema,
        reportedAt: dateSchema,
        location: pointSchema,
        locationPrecision: { enum: ["exact", "approximate", "hexagon"] },
        address: { bsonType: ["string", "null"] },
        neighborhood: { bsonType: ["string", "null"] },
        h3Index: { bsonType: "string" },
        h3Resolution: { bsonType: "int" },
        h3Cells: {
          bsonType: "object",
          additionalProperties: { bsonType: "string" },
        },
        sourceUrls: {
          bsonType: "array",
          items: { bsonType: "string" },
        },
        status: {
          enum: [
            "pending",
            "community_confirmed",
            "admin_verified",
            "rejected",
            "archived",
          ],
        },
        verification: {
          bsonType: "object",
          required: ["method", "confirmationCount"],
          properties: {
            method: { enum: ["none", "community", "admin"] },
            confirmationCount: { bsonType: "int" },
            verifiedAt: nullableDateSchema,
            verifiedBy: nullableObjectIdSchema,
          },
        },
        evidenceDescription: { bsonType: ["string", "null"] },
        locationConfirmed: { bsonType: ["bool", "null"] },
        submissionSource: {
          enum: ["citizen", "admin", "ai_scraper"],
        },
        createdBy: nullableObjectIdSchema,
        createdByRole: {
          enum: ["user", "admin", "superadmin", null],
        },
        statisticsApplied: { bsonType: "bool" },
        createdAt: dateSchema,
        updatedAt: dateSchema,
        deletedAt: nullableDateSchema,
        mergedInto: nullableObjectIdSchema,
      },
    ),
  },
  {
    name: "incident_reports",
    validator: jsonSchema(
      [
        "incidentId",
        "reporterUserId",
        "incidentType",
        "description",
        "occurredAt",
        "location",
        "h3Index",
        "status",
        "createdAt",
        "updatedAt",
      ],
      {
        incidentId: objectIdSchema,
        reporterUserId: objectIdSchema,
        incidentType: { bsonType: "string" },
        description: { bsonType: "string" },
        occurredAt: dateSchema,
        location: pointSchema,
        h3Index: { bsonType: "string" },
        sourceUrl: { bsonType: ["string", "null"] },
        evidenceDescription: { bsonType: ["string", "null"] },
        status: { enum: ["active", "merged", "rejected"] },
        createdAt: dateSchema,
        updatedAt: dateSchema,
      },
    ),
  },
  {
    name: "incident_confirmations",
    validator: jsonSchema(
      ["incidentId", "userId", "createdAt"],
      {
        incidentId: objectIdSchema,
        userId: objectIdSchema,
        createdAt: dateSchema,
      },
    ),
  },
  {
    name: "hex_monthly_stats",
    validator: jsonSchema(
      [
        "cityId",
        "month",
        "h3Resolution",
        "h3Index",
        "center",
        "incidentCount",
        "incidentTypes",
        "level",
        "color",
        "lastUpdatedAt",
      ],
      {
        cityId: objectIdSchema,
        month: { bsonType: "string" },
        h3Resolution: { bsonType: "int" },
        h3Index: { bsonType: "string" },
        center: pointSchema,
        incidentCount: { bsonType: "int", minimum: 0 },
        incidentTypes: { bsonType: "object" },
        level: { bsonType: "int", minimum: 0, maximum: 5 },
        color: { bsonType: "string" },
        lastUpdatedAt: dateSchema,
      },
    ),
  },
  {
    name: "posts",
    validator: jsonSchema(
      [
        "authorId",
        "title",
        "content",
        "tags",
        "status",
        "commentCount",
        "reactionCount",
        "createdAt",
        "updatedAt",
      ],
      {
        authorId: objectIdSchema,
        title: { bsonType: "string" },
        content: { bsonType: "string" },
        tags: { bsonType: "array", items: { bsonType: "string" } },
        relatedIncidentId: nullableObjectIdSchema,
        status: { enum: ["active", "hidden", "deleted"] },
        commentCount: { bsonType: "int", minimum: 0 },
        reactionCount: { bsonType: "int", minimum: 0 },
        createdAt: dateSchema,
        updatedAt: dateSchema,
        deletedAt: nullableDateSchema,
      },
    ),
  },
  {
    name: "comments",
    validator: jsonSchema(
      [
        "postId",
        "authorId",
        "content",
        "status",
        "reactionCount",
        "createdAt",
        "updatedAt",
      ],
      {
        postId: objectIdSchema,
        authorId: objectIdSchema,
        parentCommentId: nullableObjectIdSchema,
        content: { bsonType: "string" },
        status: { enum: ["active", "hidden", "deleted"] },
        reactionCount: { bsonType: "int", minimum: 0 },
        createdAt: dateSchema,
        updatedAt: dateSchema,
        deletedAt: nullableDateSchema,
      },
    ),
  },
  {
    name: "reactions",
    validator: jsonSchema(
      ["targetType", "targetId", "userId", "reactionType", "createdAt"],
      {
        targetType: { enum: ["post", "comment"] },
        targetId: objectIdSchema,
        userId: objectIdSchema,
        reactionType: { enum: ["like", "helpful", "concerned"] },
        createdAt: dateSchema,
      },
    ),
  },
  {
    name: "admin_role_requests",
    validator: jsonSchema(
      [
        "candidateUserId",
        "requestedByUserId",
        "requestedByRole",
        "motivation",
        "status",
        "reviewedBy",
        "reviewedAt",
        "resolutionReason",
        "createdAt",
        "updatedAt",
      ],
      {
        candidateUserId: objectIdSchema,
        requestedByUserId: objectIdSchema,
        requestedByRole: { enum: ["user", "admin", "superadmin"] },
        motivation: { bsonType: "string" },
        experience: { bsonType: ["string", "null"] },
        status: {
          enum: ["pending", "approved", "rejected", "cancelled"],
        },
        reviewedBy: nullableObjectIdSchema,
        reviewedAt: nullableDateSchema,
        resolutionReason: { bsonType: ["string", "null"] },
        resolutionEffectsCompletedAt: nullableDateSchema,
        informationRequests: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["requestedBy", "requestedAt", "message"],
            properties: {
              requestedBy: objectIdSchema,
              requestedAt: dateSchema,
              message: { bsonType: "string" },
            },
          },
        },
        createdAt: dateSchema,
        updatedAt: dateSchema,
      },
    ),
  },
  {
    name: "audit_logs",
    validator: jsonSchema(
      [
        "actorId",
        "actorUserId",
        "action",
        "resourceType",
        "resourceId",
        "createdAt",
      ],
      {
        actorId: nullableObjectIdSchema,
        actorUserId: nullableObjectIdSchema,
        actorRole: { bsonType: ["string", "null"] },
        action: { bsonType: "string" },
        resourceType: { bsonType: "string" },
        resourceId: { bsonType: ["objectId", "string", "null"] },
        changes: { bsonType: "object" },
        previousValue: { bsonType: ["object", "null"] },
        newValue: { bsonType: ["object", "null"] },
        reason: { bsonType: ["string", "null"] },
        metadata: { bsonType: "object" },
        requestId: { bsonType: ["string", "null"] },
        operationKey: { bsonType: "string" },
        createdAt: dateSchema,
      },
    ),
  },
  {
    name: "app_settings",
    validator: jsonSchema(
      ["key", "value", "createdAt", "updatedAt"],
      {
        key: { bsonType: "string" },
        value: {},
        createdAt: dateSchema,
        updatedAt: dateSchema,
      },
    ),
  },
];

export function buildIndexDefinitions(config) {
  const incidentH3Indexes = config.h3SupportedResolutions.map((resolution) => ({
    key: {
      cityId: 1,
      [`h3Cells.${resolution}`]: 1,
      occurredAt: -1,
    },
    name: `city_h3_${resolution}_occurred_at`,
  }));

  return {
    users: [
      {
        key: { normalizedEmail: 1 },
        name: "normalized_email_unique",
        unique: true,
      },
      {
        key: { normalizedUsername: 1 },
        name: "normalized_username_unique",
        unique: true,
      },
      {
        key: { googleSubject: 1 },
        name: "google_subject_unique",
        unique: true,
        partialFilterExpression: { googleSubject: { $type: "string" } },
      },
      { key: { status: 1 }, name: "status" },
      { key: { createdAt: -1 }, name: "created_at" },
    ],
    refresh_tokens: [
      { key: { tokenHash: 1 }, name: "token_hash_unique", unique: true },
      { key: { userId: 1, createdAt: -1 }, name: "user_created_at" },
      {
        key: { expiresAt: 1 },
        name: "expires_at_ttl",
        expireAfterSeconds: 0,
      },
    ],
    admin_refresh_tokens: [
      { key: { tokenHash: 1 }, name: "token_hash_unique", unique: true },
      {
        key: { sessionId: 1, revokedAt: 1, expiresAt: 1 },
        name: "active_session",
      },
      { key: { userId: 1, createdAt: -1 }, name: "user_created_at" },
      {
        key: { expiresAt: 1 },
        name: "expires_at_ttl",
        expireAfterSeconds: 0,
      },
    ],
    cities: [
      { key: { slug: 1 }, name: "slug_unique", unique: true },
      { key: { countryCode: 1, active: 1 }, name: "country_active" },
      { key: { boundary: "2dsphere" }, name: "boundary_2dsphere" },
    ],
    incidents: [
      { key: { location: "2dsphere" }, name: "location_2dsphere" },
      { key: { h3Index: 1 }, name: "h3_index" },
      {
        key: { cityId: 1, status: 1, occurredAt: -1 },
        name: "city_status_occurred_at",
      },
      {
        key: { cityId: 1, status: 1, createdAt: 1 },
        name: "city_status_created_at",
      },
      {
        key: { status: 1, createdAt: 1 },
        name: "status_created_at",
      },
      {
        key: { incidentType: 1, occurredAt: -1 },
        name: "type_occurred_at",
      },
      { key: { createdAt: -1 }, name: "created_at" },
      {
        key: { sourceUrls: 1 },
        name: "source_urls",
      },
      ...incidentH3Indexes,
    ],
    incident_reports: [
      {
        key: { incidentId: 1, reporterUserId: 1 },
        name: "incident_reporter_unique",
        unique: true,
      },
      { key: { reporterUserId: 1 }, name: "reporter" },
      {
        key: { sourceUrl: 1 },
        name: "source_url",
        partialFilterExpression: { sourceUrl: { $type: "string" } },
      },
      { key: { createdAt: -1 }, name: "created_at" },
    ],
    incident_confirmations: [
      {
        key: { incidentId: 1, userId: 1 },
        name: "incident_user_unique",
        unique: true,
      },
      { key: { userId: 1 }, name: "user" },
      { key: { createdAt: -1 }, name: "created_at" },
    ],
    hex_monthly_stats: [
      {
        key: { cityId: 1, month: 1, h3Resolution: 1, h3Index: 1 },
        name: "city_month_resolution_h3_unique",
        unique: true,
      },
      {
        key: { cityId: 1, month: 1, h3Resolution: 1, center: "2dsphere" },
        name: "viewport_stats",
      },
    ],
    posts: [
      { key: { authorId: 1, createdAt: -1 }, name: "author_created_at" },
      { key: { status: 1, createdAt: -1 }, name: "status_created_at" },
      {
        key: { relatedIncidentId: 1 },
        name: "related_incident",
        partialFilterExpression: { relatedIncidentId: { $type: "objectId" } },
      },
    ],
    comments: [
      { key: { postId: 1, createdAt: 1 }, name: "post_created_at" },
      { key: { authorId: 1, createdAt: -1 }, name: "author_created_at" },
      {
        key: { parentCommentId: 1 },
        name: "parent_comment",
        partialFilterExpression: { parentCommentId: { $type: "objectId" } },
      },
    ],
    reactions: [
      {
        key: { targetType: 1, targetId: 1, userId: 1, reactionType: 1 },
        name: "target_user_reaction_unique",
        unique: true,
      },
      { key: { userId: 1, createdAt: -1 }, name: "user_created_at" },
    ],
    admin_role_requests: [
      {
        key: { candidateUserId: 1, status: 1 },
        name: "one_pending_request_per_candidate",
        unique: true,
        partialFilterExpression: { status: "pending" },
      },
      { key: { createdAt: -1 }, name: "created_at" },
      {
        key: { status: 1, createdAt: 1 },
        name: "status_created_at",
      },
      {
        key: { requestedByUserId: 1, createdAt: -1 },
        name: "requester_created_at",
      },
    ],
    audit_logs: [
      { key: { actorId: 1, createdAt: -1 }, name: "actor_created_at" },
      {
        key: { actorUserId: 1, createdAt: -1 },
        name: "actor_user_created_at",
      },
      { key: { action: 1, createdAt: -1 }, name: "action_created_at" },
      {
        key: { resourceType: 1, resourceId: 1, createdAt: -1 },
        name: "resource_created_at",
      },
      {
        key: { operationKey: 1 },
        name: "operation_key_unique",
        unique: true,
        partialFilterExpression: { operationKey: { $type: "string" } },
      },
    ],
    app_settings: [
      { key: { key: 1 }, name: "key_unique", unique: true },
    ],
  };
}
