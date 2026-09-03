import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { authenticateRequest } from "../auth/authenticate";
import { createOrganizationSchema, updateOrganizationSchema } from "./schema";

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

    const organizations = memberships.map(m => ({
      organization: m.organization,
      role: m.role
    }));

    return reply.status(200).send({ organizations });
  });

  // READ ONE (for the current user)
  app.get("/organizations/:id", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: id,
          userId: auth.user.id,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    return reply.status(200).send({ 
      organization: membership.organization,
      role: membership.role 
    });
  });

  // UPDATE (OWNER only)
  app.patch("/organizations/:id", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    // Check membership and require OWNER role
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: id,
          userId: auth.user.id,
        },
      },
    });

    if (!membership) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    if (membership.role !== "OWNER") {
      return reply.status(403).send({ error: "Forbidden: Requires OWNER role" });
    }

    const result = updateOrganizationSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid organization data" });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: {
        name: result.data.name,
      },
    });

    return reply.status(200).send({ organization: updatedOrg });
  });
}
