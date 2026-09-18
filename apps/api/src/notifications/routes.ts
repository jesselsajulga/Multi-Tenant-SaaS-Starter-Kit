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

    const { cursor, limit = "20" } = request.query as { cursor?: string; limit?: string };
    const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const userPrisma = getUserPrisma(auth.user.id, auth.user.email);

    const whereClause: any = { userId: auth.user.id };

    const findManyArgs: any = {
      where: whereClause,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: take + 1, // fetch one extra to determine nextCursor
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        invitationId: true,
        readAt: true,
        createdAt: true,
        invitation: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    };

    if (cursor) {
      findManyArgs.cursor = { id: cursor };
      findManyArgs.skip = 1; // skip the cursor record itself
    }

    const [items, unreadCount] = await Promise.all([
      userPrisma.notification.findMany(findManyArgs),
      userPrisma.notification.count({
        where: {
          userId: auth.user.id,
          readAt: null,
        },
      }),
    ]);

    let nextCursor: string | null = null;
    let notifications = items;

    if (items.length > take) {
      const nextItem = items[take];
      nextCursor = nextItem.id;
      notifications = items.slice(0, take);
    }

    return reply.status(200).send({
      notifications,
      unreadCount,
      nextCursor,
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
