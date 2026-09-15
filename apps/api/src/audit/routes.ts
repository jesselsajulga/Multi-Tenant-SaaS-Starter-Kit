import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../auth/authenticate";
import { authorizeOrganizationAccess } from "../auth/authorize";
import { getAuditLogsSchema } from "./schema";

export async function auditRoutes(app: FastifyInstance) {
  app.get("/organizations/:organizationId/audit-logs", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { organizationId } = request.params as { organizationId: string };
    
    // Explicitly require OWNER role for audit access
    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (access.error || !access.tenantPrisma) {
      return reply.status(access.status || 403).send({ 
        error: access.error || "Forbidden",
        code: access.code || "PERMISSION_DENIED" 
      });
    }

    const queryParse = getAuditLogsSchema.safeParse(request.query);
    if (!queryParse.success) {
      return reply.status(400).send({ error: "Invalid pagination parameters" });
    }

    const { limit, cursor } = queryParse.data;

    // Use tenantPrisma to securely scope queries
    const auditLogs = await access.tenantPrisma.auditLog.findMany({
      take: limit + 1, // Fetch one extra to determine if there's a next page
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    let nextCursor: string | undefined = undefined;
    if (auditLogs.length > limit) {
      const nextItem = auditLogs.pop(); // Remove the extra item
      nextCursor = nextItem?.id;
    }

    return reply.status(200).send({
      auditLogs,
      nextCursor
    });
  });
}
