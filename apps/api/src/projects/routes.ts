import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticateRequest } from "../auth/authenticate";
import { createProjectSchema, updateProjectSchema } from "./schema";
import { prisma, getTenantPrisma } from "../db";

async function verifyTenantAccess(request: FastifyRequest, userId: string) {
  const orgId = request.headers["x-organization-id"] as string;
  if (!orgId) {
    return { error: "Missing x-organization-id header", status: 400, orgId: undefined, tenantPrisma: undefined };
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: userId,
      }
    }
  });

  if (!membership) {
    return { error: "Forbidden", status: 403, orgId: undefined, tenantPrisma: undefined };
  }

  return { error: undefined, status: undefined, orgId, tenantPrisma: getTenantPrisma(orgId) };
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
      return reply.status(access.status || 400).send({ error: access.error });
    }

    const result = createProjectSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid project data" });
    }

    const project = await access.tenantPrisma.project.create({
      data: {
        name: result.data.name,
        organizationId: access.orgId,
      },
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
      return reply.status(access.status || 400).send({ error: access.error });
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
      return reply.status(access.status || 400).send({ error: access.error });
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
      return reply.status(access.status || 400).send({ error: access.error });
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

    const updatedProject = await access.tenantPrisma.project.update({
      where: { id },
      data: { name: result.data.name },
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
      return reply.status(access.status || 400).send({ error: access.error });
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
