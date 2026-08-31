import { forbidden, notFound } from "../../../../shared/errors/app-error.js";
import { toObjectId } from "../../../../shared/utils/object-id.js";
import { toAdminCommentDto, toCommentDto } from "../dto/comment.dto.js";

function escapedSearch(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createCommentsService({
  commentsRepository,
  postsRepository,
  auditRepository,
  eventBus,
  clock = () => new Date(),
}) {
  async function create(postId, input, authorId) {
    const post = await postsRepository.findActiveById(postId);
    if (!post) {
      throw notFound("Publicacion");
    }

    let parentCommentId = null;
    if (input.parentCommentId) {
      const parent = await commentsRepository.findActiveById(
        input.parentCommentId,
      );
      if (!parent || !parent.postId.equals(post._id)) {
        throw notFound("Comentario padre");
      }
      parentCommentId = parent._id;
    }

    const now = clock();
    const comment = await commentsRepository.create({
      postId: post._id,
      authorId: toObjectId(authorId),
      parentCommentId,
      content: input.content.trim(),
      status: "active",
      reactionCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    const countUpdate = await postsRepository.adjustCommentCount(
      post._id,
      1,
      now,
    );
    if (countUpdate.modifiedCount !== 1) {
      await commentsRepository.deleteHard(comment._id);
      throw notFound("Publicacion");
    }

    eventBus.publish("comment.created", {
      commentId: comment._id.toHexString(),
      postId: post._id.toHexString(),
      authorId: comment.authorId.toHexString(),
    });
    return toCommentDto(comment);
  }

  async function list(postId, { page, pageSize }) {
    if (!(await postsRepository.findActiveById(postId))) {
      throw notFound("Publicacion");
    }

    const [comments, total] = await Promise.all([
      commentsRepository.listByPost({
        postId,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
      commentsRepository.countByPost(postId),
    ]);
    return {
      comments: comments.map(toCommentDto),
      total,
    };
  }

  async function listAdmin({
    page,
    pageSize,
    search,
    status,
    authorId,
    postId,
    sortBy,
    sortOrder,
  }) {
    const filter = {};
    if (search) {
      filter.content = new RegExp(escapedSearch(search), "i");
    }
    if (status) {
      filter.status = status;
    }
    if (authorId) {
      filter.authorId = toObjectId(authorId);
    }
    if (postId) {
      filter.postId = toObjectId(postId);
    }
    const [comments, total] = await Promise.all([
      commentsRepository.listAdmin({
        filter,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        sortBy,
        sortOrder,
      }),
      commentsRepository.countAdmin(filter),
    ]);
    return {
      comments: comments.map((comment) => toAdminCommentDto(comment)),
      total,
    };
  }

  async function getAdmin(commentId) {
    const comment = await commentsRepository.findById(commentId);
    if (!comment) {
      throw notFound("Comentario");
    }
    const post = await postsRepository.findById(comment.postId);
    return toAdminCommentDto(comment, post);
  }

  async function update(commentId, authorId, content) {
    const comment = await commentsRepository.updateOwned(
      commentId,
      authorId,
      content.trim(),
      clock(),
    );
    if (!comment) {
      throw forbidden("Solo el autor puede editar este comentario");
    }
    eventBus.publish("comment.updated", {
      commentId: comment._id.toHexString(),
      postId: comment.postId.toHexString(),
    });
    return toCommentDto(comment);
  }

  async function remove(commentId, authorId) {
    const now = clock();
    const comment = await commentsRepository.deleteOwned(
      commentId,
      authorId,
      now,
    );
    if (!comment) {
      throw forbidden("Solo el autor puede eliminar este comentario");
    }
    await postsRepository.adjustCommentCount(comment.postId, -1, now);
    eventBus.publish("comment.updated", {
      commentId: comment._id.toHexString(),
      postId: comment.postId.toHexString(),
      status: "deleted",
    });
  }

  async function updateAdmin(commentId, input, actor, requestId) {
    const current = await commentsRepository.findById(commentId);
    if (!current) {
      throw notFound("Comentario");
    }
    const now = clock();
    const comment = await commentsRepository.updateAdmin(
      commentId,
      input.content.trim(),
      {
        action: "edited",
        actorId: toObjectId(actor.id),
        reason: input.reason,
        moderatedAt: now,
      },
      now,
    );
    if (!comment) {
      throw notFound("Comentario");
    }
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: "comment.edited",
      resourceType: "comment",
      resourceId: commentId,
      previousValue: { content: current.content },
      newValue: { content: comment.content },
      reason: input.reason,
      metadata: { postId: comment.postId },
      requestId,
      changes: { content: comment.content },
      createdAt: now,
    });
    eventBus.publish("comment.updated", {
      commentId: comment._id.toHexString(),
      postId: comment.postId.toHexString(),
      status: comment.status,
    });
    eventBus.publish("admin.content.moderated", {
      resourceType: "comment",
      resourceId: comment._id.toHexString(),
      action: "edited",
    });
    return toAdminCommentDto(comment);
  }

  async function moderate(commentId, status, actor, reason, requestId) {
    const current = await commentsRepository.findById(commentId);
    if (!current) {
      throw notFound("Comentario");
    }
    const now = clock();
    const action = status === "hidden" ? "hidden" : "restored";
    const comment = await commentsRepository.moderate(
      commentId,
      status,
      {
        action,
        actorId: toObjectId(actor.id),
        reason,
        moderatedAt: now,
      },
      now,
    );
    if (!comment) {
      throw notFound("Comentario");
    }
    if (current.status === "active" && status === "hidden") {
      await postsRepository.adjustCommentCount(comment.postId, -1, now);
    } else if (current.status === "hidden" && status === "active") {
      await postsRepository.adjustCommentCount(comment.postId, 1, now);
    }
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: status === "hidden" ? "comment.hidden" : "comment.restored",
      resourceType: "comment",
      resourceId: commentId,
      previousValue: { status: current.status },
      newValue: { status },
      reason,
      metadata: { postId: comment.postId },
      requestId,
      changes: { status },
      createdAt: now,
    });
    eventBus.publish("comment.updated", {
      commentId: comment._id.toHexString(),
      postId: comment.postId.toHexString(),
      status,
    });
    eventBus.publish("admin.content.moderated", {
      resourceType: "comment",
      resourceId: comment._id.toHexString(),
      action,
    });
    return toAdminCommentDto(comment);
  }

  async function deleteAdmin(commentId, actor, reason, requestId) {
    const current = await commentsRepository.findById(commentId);
    if (!current) {
      throw notFound("Comentario");
    }
    const now = clock();
    const comment = await commentsRepository.deleteAdmin(
      commentId,
      {
        action: "deleted",
        actorId: toObjectId(actor.id),
        reason,
        moderatedAt: now,
      },
      now,
    );
    if (!comment) {
      throw notFound("Comentario");
    }
    if (current.status === "active") {
      await postsRepository.adjustCommentCount(comment.postId, -1, now);
    }
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: "comment.deleted",
      resourceType: "comment",
      resourceId: commentId,
      previousValue: {
        status: current.status,
        deletedAt: current.deletedAt,
      },
      newValue: { status: "deleted", deletedAt: now },
      reason,
      metadata: { postId: comment.postId },
      requestId,
      changes: { status: "deleted" },
      createdAt: now,
    });
    eventBus.publish("comment.updated", {
      commentId: comment._id.toHexString(),
      postId: comment.postId.toHexString(),
      status: "deleted",
    });
    eventBus.publish("admin.content.moderated", {
      resourceType: "comment",
      resourceId: comment._id.toHexString(),
      action: "deleted",
    });
  }

  return Object.freeze({
    create,
    list,
    listAdmin,
    getAdmin,
    update,
    remove,
    updateAdmin,
    moderate,
    deleteAdmin,
  });
}
