import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../auth/authenticate.js";
import { getUserPrisma } from "../db.js";

export async function notificationRoutes(app: FastifyInstance) {
  // GET /notifications
  app.get("/notifications", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const userPrisma = getUserPrisma(auth.user.id, auth.user.email);

    const [notifications, unreadCount] = await Promise.all([
      userPrisma.notification.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          invitationId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      userPrisma.notification.count({
        where: {
          userId: auth.user.id,
          readAt: null,
        },
      }),
    ]);

    return reply.status(200).send({
      notifications,
      unreadCount,
    });
  });

  // PATCH /notifications/:id/read
  app.patch("/notifications/:id/read", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const userPrisma = getUserPrisma(auth.user.id, auth.user.email);

    const notification = await userPrisma.notification.findFirst({
      where: {
        id,
        userId: auth.user.id,
      },
    });

    if (!notification) {
      return reply.status(404).send({ error: "Notification not found" });
    }

    const updated = await userPrisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
      select: {
        id: true,
        readAt: true,
      },
    });

    return reply.status(200).send({ notification: updated });
  });

  // POST /notifications/read-all
  app.post("/notifications/read-all", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const userPrisma = getUserPrisma(auth.user.id, auth.user.email);

    await userPrisma.notification.updateMany({
      where: {
        userId: auth.user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return reply.status(200).send({ message: "All notifications marked as read" });
  });
}
