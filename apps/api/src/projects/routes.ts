import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticateRequest } from "../auth/authenticate";
import { createProjectSchema, updateProjectSchema } from "./schema";
import { prisma, getTenantPrisma } from "../db";
import { createAuditLog } from "../audit/logger";

import { authorizeRequest } from "../auth/authorize";

async function verifyTenantAccess(request: FastifyRequest, userId: string) {
  return authorizeRequest(request, userId);
}

export async function projectRoutes(app: FastifyInstance) {
  // CREATE
  app.post("/projects", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const access = await verifyTenantAccess(request, auth.user.id);
    if (access.error || !access.tenantPrisma || !access.orgId) {
      return reply.status(access.status || 400).send({ error: access.error, code: access.code });
    }

    const orgId = access.orgId;
    const tenantPrisma = access.tenantPrisma;

    const result = createProjectSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid project data" });
    }

    const project = await tenantPrisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          name: result.data.name,
          organizationId: orgId,
        },
      });

      await createAuditLog(tx, {
        organizationId: orgId,
        actorId: auth.user.id,
        actorSnapshot: { email: auth.user.email },
        action: "PROJECT_CREATED",
        resourceType: "Project",
        resourceId: p.id,
        metadata: { name: p.name }
      });

      return p;
    });

    return reply.status(201).send({ project });
  });

  // READ ALL
  app.get("/projects", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const access = await verifyTenantAccess(request, auth.user.id);
    if (access.error || !access.tenantPrisma) {
      return reply.status(access.status || 400).send({ error: access.error, code: access.code });
    }

    // RLS handles the filtering automatically
    const projects = await access.tenantPrisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });

    return reply.status(200).send({ projects });
  });

  // READ ONE
  app.get("/projects/:id", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const access = await verifyTenantAccess(request, auth.user.id);
    if (access.error || !access.tenantPrisma) {
      return reply.status(access.status || 400).send({ error: access.error, code: access.code });
    }

    const { id } = request.params as { id: string };

    const project = await access.tenantPrisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    return reply.status(200).send({ project });
  });

  // UPDATE
  app.put("/projects/:id", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const access = await verifyTenantAccess(request, auth.user.id);
    if (access.error || !access.tenantPrisma) {
      return reply.status(access.status || 400).send({ error: access.error, code: access.code });
    }

    const { id } = request.params as { id: string };

    const project = await access.tenantPrisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const result = updateProjectSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid project data" });
    }

    const updatedProject = await access.tenantPrisma.$transaction(async (tx) => {
      const p = await tx.project.update({
        where: { id },
        data: result.data,
      });

      // Record audit log for project update
      await createAuditLog(tx, {
        organizationId: access.orgId!,
        actorId: auth.user.id,
        actorSnapshot: { email: auth.user.email },
        action: "PROJECT_UPDATED",
        resourceType: "Project",
        resourceId: id,
        metadata: {
          name: p.name,
        },
      });

      return p;
    });

    return reply.status(200).send({ project: updatedProject });
  });

  // DELETE
  app.delete("/projects/:id", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const access = await verifyTenantAccess(request, auth.user.id);
    if (access.error || !access.tenantPrisma) {
      return reply.status(access.status || 400).send({ error: access.error, code: access.code });
    }

    const { id } = request.params as { id: string };

    const project = await access.tenantPrisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    await access.tenantPrisma.project.delete({
      where: { id },
    });

    return reply.status(200).send({ message: "Project deleted" });
  });
}
