import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { authenticateRequest } from "../auth/authenticate";
import { authorizeOrganizationAccess } from "../auth/authorize";
import { createAuditLog } from "../audit/logger";
import { addMemberSchema } from "./schema";

export async function memberRoutes(app: FastifyInstance) {
  // GET /organizations/:organizationId/members
  app.get("/organizations/:organizationId/members", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { organizationId } = request.params as { organizationId: string };
    const access = await authorizeOrganizationAccess(organizationId, auth.user.id);
    
    if (access.error) {
      return reply.status(access.status).send({ error: access.error, code: access.code });
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return reply.status(200).send({ members });
  });

  // POST /organizations/:organizationId/members
  app.post("/organizations/:organizationId/members", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { organizationId } = request.params as { organizationId: string };
    // Require OWNER role
    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    
    if (access.error) {
      return reply.status(access.status).send({ error: access.error });
    }

    const result = addMemberSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid request data" });
    }

    // Find the target user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: result.data.email }
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    // Check for duplicate membership
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUser.id
        }
      }
    });

    if (existingMembership) {
      return reply.status(409).send({ error: "User is already a member" });
    }

    const member = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: targetUser.id,
        role: "MEMBER" // Hardcoded, as designed
      }
    });

    return reply.status(201).send({ member });
  });

  // DELETE /organizations/:organizationId/members/:userId
  app.delete("/organizations/:organizationId/members/:userId", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { organizationId, userId: targetUserId } = request.params as { organizationId: string, userId: string };
    // Require OWNER role
    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    
    if (access.error) {
      return reply.status(access.status).send({ error: access.error });
    }

    // Check if the target member exists
    const targetMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId
        }
      },
      include: {
        user: {
          select: {
            email: true
          }
        },
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    if (!targetMembership) {
      return reply.status(404).send({ error: "Member not found" });
    }

    // Prevent deleting the final owner
    if (targetMembership.role === "OWNER") {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: "OWNER"
        }
      });

      if (ownerCount <= 1) {
        return reply.status(409).send({ error: "Cannot remove the final owner of the organization" });
      }
    }

    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId
        }
      }
    });

    // Record audit log for member removal
    await createAuditLog(prisma, {
      organizationId,
      actorId: auth.user.id,
      actorSnapshot: { email: auth.user.email },
      action: "MEMBER_REMOVED",
      resourceType: "OrganizationMember",
      resourceId: targetUserId,
      metadata: {
        removedMemberEmail: targetMembership.user.email,
        removedMemberRole: targetMembership.role,
        organizationName: targetMembership.organization.name,
      }
    });

    // Send transactional email notification informing user that their access was revoked
    app.log.info({
      msg: "Simulated Email: Workspace Access Revoked",
      to: targetMembership.user.email,
      workspaceName: targetMembership.organization.name,
      message: `Your access to ${targetMembership.organization.name} has been revoked.`
    });

    return reply.status(200).send({ message: "Member removed successfully" });
  });
}
