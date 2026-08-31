export function toPostDto(post) {
  return {
    id: post._id.toHexString(),
    authorId: post.authorId.toHexString(),
    title: post.title,
    content: post.content,
    tags: post.tags,
    relatedIncidentId: post.relatedIncidentId?.toHexString() ?? null,
    status: post.status,
    commentCount: post.commentCount,
    reactionCount: post.reactionCount,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function toAdminPostDto(post) {
  return {
    ...toPostDto(post),
    deletedAt: post.deletedAt?.toISOString() ?? null,
    moderation: post.moderation
      ? {
          ...post.moderation,
          actorId:
            post.moderation.actorId?.toHexString?.() ??
            post.moderation.actorId ??
            null,
          moderatedAt:
            post.moderation.moderatedAt?.toISOString?.() ??
            post.moderation.moderatedAt ??
            null,
        }
      : null,
  };
}
