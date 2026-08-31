import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createCommentsService } from "../services/comments.service.js";

function commentDocument(overrides = {}) {
  const now = new Date("2026-07-29T12:00:00.000Z");
  return {
    _id: new ObjectId(),
    postId: new ObjectId(),
    authorId: new ObjectId(),
    parentCommentId: null,
    content: "Contenido original del comentario.",
    status: "active",
    reactionCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("moderacion administrativa de comentarios", () => {
  it("oculta, ajusta el contador y audita el motivo", async () => {
    const current = commentDocument();
    const now = new Date("2026-07-29T12:05:00.000Z");
    const moderated = {
      ...current,
      status: "hidden",
      updatedAt: now,
      moderation: {
        action: "hidden",
        actorId: new ObjectId(),
        reason: "El contenido incumple las reglas de convivencia.",
        moderatedAt: now,
      },
    };
    const commentsRepository = {
      findById: vi.fn().mockResolvedValue(current),
      moderate: vi.fn().mockResolvedValue(moderated),
    };
    const postsRepository = {
      adjustCommentCount: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const auditRepository = { record: vi.fn().mockResolvedValue(undefined) };
    const eventBus = { publish: vi.fn() };
    const service = createCommentsService({
      commentsRepository,
      postsRepository,
      auditRepository,
      eventBus,
      clock: () => now,
    });
    const actor = {
      id: moderated.moderation.actorId,
      role: "admin",
    };
    const reason = moderated.moderation.reason;

    const result = await service.moderate(
      current._id,
      "hidden",
      actor,
      reason,
      "request-1",
    );

    expect(result.status).toBe("hidden");
    expect(postsRepository.adjustCommentCount).toHaveBeenCalledWith(
      current.postId,
      -1,
      now,
    );
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actor.id,
        actorRole: "admin",
        action: "comment.hidden",
        previousValue: { status: "active" },
        newValue: { status: "hidden" },
        reason,
        requestId: "request-1",
      }),
    );
  });

  it("guarda contenido anterior y nuevo al editar", async () => {
    const current = commentDocument();
    const now = new Date("2026-07-29T12:05:00.000Z");
    const edited = {
      ...current,
      content: "Contenido corregido por moderacion.",
      updatedAt: now,
    };
    const commentsRepository = {
      findById: vi.fn().mockResolvedValue(current),
      updateAdmin: vi.fn().mockResolvedValue(edited),
    };
    const auditRepository = { record: vi.fn().mockResolvedValue(undefined) };
    const service = createCommentsService({
      commentsRepository,
      postsRepository: {},
      auditRepository,
      eventBus: { publish: vi.fn() },
      clock: () => now,
    });
    const actor = { id: new ObjectId(), role: "admin" };

    await service.updateAdmin(
      current._id,
      {
        content: edited.content,
        reason: "Se elimina informacion personal expuesta por el usuario.",
      },
      actor,
      "request-2",
    );

    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "comment.edited",
        previousValue: { content: current.content },
        newValue: { content: edited.content },
        requestId: "request-2",
      }),
    );
  });
});
