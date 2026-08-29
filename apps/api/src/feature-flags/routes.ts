import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authenticateRequest } from "../auth/authenticate";
import { authorizeOrganizationAccess } from "../auth/authorize";
import { 
  createFeatureFlagSchema, 
  updateFeatureFlagSchema, 
  featureFlagParamsSchema, 
  featureFlagOrgParamsSchema 
} from "./schema";

export async function featureFlagsRoutes(app: FastifyInstance) {
  // POST /organizations/:organizationId/feature-flags
  app.post("/organizations/:organizationId/feature-flags", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await authenticateRequest(req);
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });

    const { organizationId } = featureFlagOrgParamsSchema.parse(req.params);
    const data = createFeatureFlagSchema.parse(req.body);

    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (access.error || !access.tenantPrisma) return reply.status(access.status || 400).send({ error: access.error });

    try {
      const flag = await access.tenantPrisma.featureFlag.create({
        data: {
          organizationId,
          key: data.key,
          enabled: data.enabled,
        },
      });
      return reply.status(201).send(flag);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply.status(409).send({ error: "Feature flag with this key already exists." });
      }
      throw error;
    }
  });

  // GET /organizations/:organizationId/feature-flags
  app.get("/organizations/:organizationId/feature-flags", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await authenticateRequest(req);
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });

    const { organizationId } = featureFlagOrgParamsSchema.parse(req.params);
    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (access.error || !access.tenantPrisma) return reply.status(access.status || 400).send({ error: access.error });

    const flags = await access.tenantPrisma.featureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return reply.status(200).send(flags);
  });

  // PUT /organizations/:organizationId/feature-flags/:flagId
  app.put("/organizations/:organizationId/feature-flags/:flagId", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await authenticateRequest(req);
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });

    const { organizationId, flagId } = featureFlagParamsSchema.parse(req.params);
    const data = updateFeatureFlagSchema.parse(req.body);

    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (access.error || !access.tenantPrisma) return reply.status(access.status || 400).send({ error: access.error });

    try {
      const flag = await access.tenantPrisma.featureFlag.update({
        where: { id: flagId },
        data: { enabled: data.enabled },
      });
      return reply.status(200).send(flag);
    } catch (error: any) {
      if (error.code === "P2025") {
        return reply.status(404).send({ error: "Feature flag not found." });
      }
      throw error;
    }
  });

  // DELETE /organizations/:organizationId/feature-flags/:flagId
  app.delete("/organizations/:organizationId/feature-flags/:flagId", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await authenticateRequest(req);
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });

    const { organizationId, flagId } = featureFlagParamsSchema.parse(req.params);

    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (access.error || !access.tenantPrisma) return reply.status(access.status || 400).send({ error: access.error });

    try {
      await access.tenantPrisma.featureFlag.delete({
        where: { id: flagId },
      });
      return reply.status(200).send({ success: true });
    } catch (error: any) {
      if (error.code === "P2025") {
        return reply.status(404).send({ error: "Feature flag not found." });
      }
      throw error;
    }
  });
}
