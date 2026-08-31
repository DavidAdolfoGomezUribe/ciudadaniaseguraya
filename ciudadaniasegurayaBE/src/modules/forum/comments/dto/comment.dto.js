export function toCommentDto(comment) {
  return {
    id: comment._id.toHexString(),
    postId: comment.postId.toHexString(),
    authorId: comment.authorId.toHexString(),
    parentCommentId: comment.parentCommentId?.toHexString() ?? null,
    content: comment.content,
    status: comment.status,
    reactionCount: comment.reactionCount,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export function toAdminCommentDto(comment, post = null) {
  return {
    ...toCommentDto(comment),
    deletedAt: comment.deletedAt?.toISOString() ?? null,
    moderation: comment.moderation
      ? {
          ...comment.moderation,
          actorId:
            comment.moderation.actorId?.toHexString?.() ??
            comment.moderation.actorId ??
            null,
          moderatedAt:
            comment.moderation.moderatedAt?.toISOString?.() ??
            comment.moderation.moderatedAt ??
            null,
        }
      : null,
    ...(post
      ? {
          context: {
            post: {
              id: post._id.toHexString(),
              title: post.title,
              status: post.status,
            },
          },
        }
      : {}),
  };
}
