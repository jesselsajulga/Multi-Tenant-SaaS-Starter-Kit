import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { authenticateRequest } from "../auth/authenticate";
import { createOrganizationSchema } from "./schema";

export async function organizationRoutes(app: FastifyInstance) {
  // CREATE
  app.post("/organizations", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const result = createOrganizationSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid organization data" });
    }

    // Create the organization and the membership as OWNER in one transaction
    const org = await prisma.organization.create({
      data: {
        name: result.data.name,
        members: {
          create: {
            userId: auth.user.id,
            role: "OWNER",
          }
        }
      },
    });

    return reply.status(201).send({ organization: org });
  });

  // READ ALL (for the current user)
  app.get("/organizations", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId: auth.user.id,
      },
      include: {
        organization: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const organizations = memberships.map(m => m.organization);

    return reply.status(200).send({ organizations });
  });
}
