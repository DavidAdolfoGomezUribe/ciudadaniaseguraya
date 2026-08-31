import { forbidden, notFound } from "../../../../shared/errors/app-error.js";
import { toObjectId } from "../../../../shared/utils/object-id.js";
import { toAdminPostDto, toPostDto } from "../dto/post.dto.js";

function normalizeTags(tags = []) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()))];
}

function escapedSearch(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createPostsService({
  postsRepository,
  incidentsRepository,
  auditRepository,
  eventBus,
  clock = () => new Date(),
}) {
  async function create(input, authorId) {
    if (
      input.relatedIncidentId &&
      !(await incidentsRepository.findPublicById(input.relatedIncidentId))
    ) {
      throw notFound("Incidente relacionado");
    }

    const now = clock();
    const post = await postsRepository.create({
      authorId: toObjectId(authorId),
      title: input.title.trim(),
      content: input.content.trim(),
      tags: normalizeTags(input.tags),
      relatedIncidentId: input.relatedIncidentId
        ? toObjectId(input.relatedIncidentId)
        : null,
      status: "active",
      commentCount: 0,
      reactionCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    eventBus.publish("post.created", {
      postId: post._id.toHexString(),
      authorId: post.authorId.toHexString(),
    });
    return toPostDto(post);
  }

  async function list({ page, pageSize, tag, relatedIncidentId }) {
    const filter = {};
    if (tag) {
      filter.tags = tag.toLowerCase();
    }
    if (relatedIncidentId) {
      filter.relatedIncidentId = toObjectId(relatedIncidentId);
    }

    const [posts, total] = await Promise.all([
      postsRepository.list({
        filter,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
      postsRepository.count(filter),
    ]);

    return {
      posts: posts.map(toPostDto),
      total,
    };
  }

  async function get(postId) {
    const post = await postsRepository.findActiveById(postId);
    if (!post) {
      throw notFound("Publicacion");
    }
    return toPostDto(post);
  }

  async function listAdmin({
    page,
    pageSize,
    search,
    status,
    authorId,
    relatedIncidentId,
    sortBy,
    sortOrder,
  }) {
    const filter = {};
    if (search) {
      const expression = new RegExp(escapedSearch(search), "i");
      filter.$or = [{ title: expression }, { content: expression }];
    }
    if (status) {
      filter.status = status;
    }
    if (authorId) {
      filter.authorId = toObjectId(authorId);
    }
    if (relatedIncidentId) {
      filter.relatedIncidentId = toObjectId(relatedIncidentId);
    }
    const [posts, total] = await Promise.all([
      postsRepository.listAdmin({
        filter,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        sortBy,
        sortOrder,
      }),
      postsRepository.countAdmin(filter),
    ]);
    return {
      posts: posts.map(toAdminPostDto),
      total,
    };
  }

  async function getAdmin(postId) {
    const post = await postsRepository.findById(postId);
    if (!post) {
      throw notFound("Publicacion");
    }
    return toAdminPostDto(post);
  }

  async function update(postId, authorId, input) {
    if (
      input.relatedIncidentId &&
      !(await incidentsRepository.findPublicById(input.relatedIncidentId))
    ) {
      throw notFound("Incidente relacionado");
    }

    const changes = {};
    if (input.title !== undefined) {
      changes.title = input.title.trim();
    }
    if (input.content !== undefined) {
      changes.content = input.content.trim();
    }
    if (input.tags !== undefined) {
      changes.tags = normalizeTags(input.tags);
    }
    if (input.relatedIncidentId !== undefined) {
      changes.relatedIncidentId = input.relatedIncidentId
        ? toObjectId(input.relatedIncidentId)
        : null;
    }

    const post = await postsRepository.updateOwned(
      postId,
      authorId,
      changes,
      clock(),
    );
    if (!post) {
      throw forbidden("Solo el autor puede editar esta publicacion");
    }
    eventBus.publish("post.updated", {
      postId: post._id.toHexString(),
      authorId: post.authorId.toHexString(),
    });
    return toPostDto(post);
  }

  async function remove(postId, authorId) {
    const post = await postsRepository.deleteOwned(
      postId,
      authorId,
      clock(),
    );
    if (!post) {
      throw forbidden("Solo el autor puede eliminar esta publicacion");
    }
    eventBus.publish("post.updated", {
      postId: post._id.toHexString(),
      status: "deleted",
    });
  }

  async function updateAdmin(postId, input, actor, requestId) {
    const current = await postsRepository.findById(postId);
    if (!current) {
      throw notFound("Publicacion");
    }
    if (
      input.relatedIncidentId &&
      !(await incidentsRepository.findPublicById(input.relatedIncidentId))
    ) {
      throw notFound("Incidente relacionado");
    }
    const changes = {};
    for (const field of ["title", "content"]) {
      if (input[field] !== undefined) {
        changes[field] = input[field].trim();
      }
    }
    if (input.tags !== undefined) {
      changes.tags = normalizeTags(input.tags);
    }
    if (input.relatedIncidentId !== undefined) {
      changes.relatedIncidentId = input.relatedIncidentId
        ? toObjectId(input.relatedIncidentId)
        : null;
    }
    const now = clock();
    const moderation = {
      action: "edited",
      actorId: toObjectId(actor.id),
      reason: input.reason,
      moderatedAt: now,
    };
    const post = await postsRepository.updateAdmin(
      postId,
      changes,
      moderation,
      now,
    );
    if (!post) {
      throw notFound("Publicacion");
    }
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: "post.edited",
      resourceType: "post",
      resourceId: postId,
      previousValue: Object.fromEntries(
        Object.keys(changes).map((key) => [key, current[key]]),
      ),
      newValue: changes,
      reason: input.reason,
      metadata: {},
      requestId,
      changes,
      createdAt: now,
    });
    eventBus.publish("post.updated", {
      postId: post._id.toHexString(),
      status: post.status,
    });
    eventBus.publish("admin.content.moderated", {
      resourceType: "post",
      resourceId: post._id.toHexString(),
      action: "edited",
    });
    return toAdminPostDto(post);
  }

  async function moderate(postId, status, actor, reason, requestId) {
    const current = await postsRepository.findById(postId);
    if (!current) {
      throw notFound("Publicacion");
    }
    const now = clock();
    const action = status === "hidden" ? "hidden" : "restored";
    const post = await postsRepository.moderate(
      postId,
      status,
      {
        action,
        actorId: toObjectId(actor.id),
        reason,
        moderatedAt: now,
      },
      now,
    );
    if (!post) {
      throw notFound("Publicacion");
    }
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: status === "hidden" ? "post.hidden" : "post.restored",
      resourceType: "post",
      resourceId: postId,
      previousValue: { status: current.status },
      newValue: { status },
      reason,
      metadata: {},
      requestId,
      changes: { status },
      createdAt: now,
    });
    eventBus.publish("post.updated", {
      postId: post._id.toHexString(),
      status,
    });
    eventBus.publish("admin.content.moderated", {
      resourceType: "post",
      resourceId: post._id.toHexString(),
      action,
    });
    return toAdminPostDto(post);
  }

  async function deleteAdmin(postId, actor, reason, requestId) {
    const current = await postsRepository.findById(postId);
    if (!current) {
      throw notFound("Publicacion");
    }
    const now = clock();
    const post = await postsRepository.deleteAdmin(
      postId,
      {
        action: "deleted",
        actorId: toObjectId(actor.id),
        reason,
        moderatedAt: now,
      },
      now,
    );
    if (!post) {
      throw notFound("Publicacion");
    }
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: "post.deleted",
      resourceType: "post",
      resourceId: postId,
      previousValue: { status: current.status, deletedAt: current.deletedAt },
      newValue: { status: "deleted", deletedAt: now },
      reason,
      metadata: {},
      requestId,
      changes: { status: "deleted" },
      createdAt: now,
    });
    eventBus.publish("post.updated", {
      postId: post._id.toHexString(),
      status: "deleted",
    });
    eventBus.publish("admin.content.moderated", {
      resourceType: "post",
      resourceId: post._id.toHexString(),
      action: "deleted",
    });
  }

  return Object.freeze({
    create,
    list,
    get,
    listAdmin,
    getAdmin,
    update,
    remove,
    updateAdmin,
    moderate,
    deleteAdmin,
  });
}
