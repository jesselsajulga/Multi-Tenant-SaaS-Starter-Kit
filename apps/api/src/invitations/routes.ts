import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { authenticateRequest } from "../auth/authenticate";
import { authorizeOrganizationAccess } from "../auth/authorize";
import { createInvitationSchema, processInvitationSchema } from "./schema";
import crypto from "crypto";

export async function invitationRoutes(app: FastifyInstance) {
  // POST /organizations/:organizationId/invitations
  app.post("/organizations/:organizationId/invitations", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { organizationId } = request.params as { organizationId: string };
    
    // Require OWNER role to invite
    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (access.error || !access.tenantPrisma) {
      return reply.status(access.status).send({ error: access.error });
    }

    const result = createInvitationSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid request data", details: result.error.flatten() });
    }

    const { email } = result.data;

    // Check if the user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id,
          }
        }
      });
      if (existingMembership) {
        return reply.status(409).send({ error: "User is already a member of this organization" });
      }
    }

    // Generate cryptographic token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Set expiration to 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      // Create PENDING invitation via tenantPrisma (RLS enforced)
      const invitation = await access.tenantPrisma.organizationInvitation.create({
        data: {
          organizationId,
          email,
          inviterId: auth.user.id,
          tokenHash,
          role: "MEMBER", // Hardcoded as per decision
          status: "PENDING",
          expiresAt,
        }
      });

      // Simulate email
      app.log.info({
        msg: "Simulated Email: Organization Invitation",
        to: email,
        inviteUrl: `http://localhost:3000/invitations/accept?token=${rawToken}`
      });

      return reply.status(201).send({
        message: "Invitation sent successfully",
        invitationId: invitation.id
      });
    } catch (error: any) {
      // Handle the partial unique constraint P2002 explicitly
      if (error.code === "P2002") {
        return reply.status(409).send({ error: "A pending invitation already exists for this email" });
      }
      throw error;
    }
  });
  // GET /organizations/:organizationId/invitations
  app.get("/organizations/:organizationId/invitations", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { organizationId } = request.params as { organizationId: string };
    
    // Both MEMBER and OWNER can view invitations
    const access = await authorizeOrganizationAccess(organizationId, auth.user.id);
    if (access.error || !access.tenantPrisma) {
      return reply.status(access.status).send({ error: access.error });
    }

    const invitations = await access.tenantPrisma.organizationInvitation.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        inviter: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return reply.status(200).send({ invitations });
  });

  // DELETE /organizations/:organizationId/invitations/:id
  app.delete("/organizations/:organizationId/invitations/:id", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { organizationId, id } = request.params as { organizationId: string; id: string };
    
    // Require OWNER role to revoke
    const access = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (access.error || !access.tenantPrisma) {
      return reply.status(access.status).send({ error: access.error });
    }

    // Verify it exists in this tenant's scope
    const invitation = await access.tenantPrisma.organizationInvitation.findUnique({
      where: { id }
    });

    if (!invitation) {
      return reply.status(404).send({ error: "Invitation not found" });
    }

    if (invitation.status !== "PENDING") {
      return reply.status(409).send({ error: "Only PENDING invitations can be revoked" });
    }

    const updated = await access.tenantPrisma.organizationInvitation.update({
      where: { id },
      data: { status: "CANCELED" },
      select: {
        id: true,
        email: true,
        status: true
      }
    });

    return reply.status(200).send({ message: "Invitation revoked", invitation: updated });
  });

  // POST /invitations/accept
  app.post("/invitations/accept", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const result = processInvitationSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid request data", details: result.error.flatten() });
    }

    const { token } = result.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash }
    });

    if (!invitation) {
      return reply.status(404).send({ error: "Invitation not found or invalid" });
    }

    if (invitation.status !== "PENDING") {
      return reply.status(409).send({ error: "Invitation is no longer pending" });
    }

    if (invitation.expiresAt < new Date()) {
      return reply.status(409).send({ error: "Invitation has expired" });
    }

    if (invitation.email !== auth.user.email) {
      return reply.status(403).send({ error: "Invitation email does not match authenticated user" });
    }

    // Check if already a member
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: auth.user.id,
        }
      }
    });

    if (existingMembership) {
      return reply.status(409).send({ error: "You are already a member of this organization" });
    }

    // Atomic transaction
    try {
      await prisma.$transaction(async (tx) => {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" }
        });

        await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: auth.user.id,
            role: "MEMBER" // as per phase 4.2.1 hardcoding, invitations grant MEMBER
          }
        });
      });

      return reply.status(200).send({ message: "Invitation accepted successfully" });
    } catch (error) {
      return reply.status(500).send({ error: "Failed to accept invitation" });
    }
  });

  // POST /invitations/reject
  app.post("/invitations/reject", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const result = processInvitationSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid request data", details: result.error.flatten() });
    }

    const { token } = result.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash }
    });

    if (!invitation) {
      return reply.status(404).send({ error: "Invitation not found or invalid" });
    }

    if (invitation.status !== "PENDING") {
      return reply.status(409).send({ error: "Invitation is no longer pending" });
    }

    if (invitation.expiresAt < new Date()) {
      return reply.status(409).send({ error: "Invitation has expired" });
    }

    if (invitation.email !== auth.user.email) {
      return reply.status(403).send({ error: "Invitation email does not match authenticated user" });
    }

    const updated = await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: "REJECTED" },
      select: { id: true, status: true }
    });

    return reply.status(200).send({ message: "Invitation rejected", invitation: updated });
  });
}
