import type { FastifyInstance } from "fastify";
import { prisma, getUserPrisma } from "../db.js";
import { authenticateRequest } from "../auth/authenticate.js";
import { authorizeOrganizationAccess } from "../auth/authorize";
import { createInvitationSchema, processInvitationSchema, verifyInvitationQuerySchema } from "./schema";
import crypto from "crypto";
import { createAuditLog } from "../audit/logger";

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

    // Fetch organization name for notification copy
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true }
    });

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
      const invitation = await access.tenantPrisma.$transaction(async (tx) => {
        const inv = await tx.organizationInvitation.create({
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

        await createAuditLog(tx, {
          organizationId,
          actorId: auth.user.id,
          actorSnapshot: { email: auth.user.email },
          action: "MEMBER_INVITED",
          resourceType: "OrganizationInvitation",
          resourceId: inv.id,
          metadata: { invitedEmail: email, role: "MEMBER" }
        });

        // If the invited user already exists, create in-app notification for the recipient
        if (existingUser) {
          await prisma.notification.create({
            data: {
              userId: existingUser.id,
              type: "MEMBER_INVITATION",
              title: "Workspace Invitation",
              message: `You have been invited to join ${org?.name || "the workspace"}`,
              invitationId: inv.id,
            }
          });
        }

        return inv;
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

    const updated = await access.tenantPrisma.$transaction(async (tx) => {
      const canceled = await tx.organizationInvitation.update({
        where: { id },
        data: { status: "CANCELED" },
        select: {
          id: true,
          email: true,
          status: true
        }
      });

      await createAuditLog(tx, {
        organizationId,
        actorId: auth.user.id,
        actorSnapshot: { email: auth.user.email },
        action: "MEMBER_INVITATION_REVOKED",
        resourceType: "OrganizationInvitation",
        resourceId: id,
        metadata: { invitedEmail: invitation.email }
      });

      // Mark associated notifications as read using trusted prisma so tenant revoker is not blocked by user-scoped RLS
      await prisma.notification.updateMany({
        where: { invitationId: id, readAt: null },
        data: { readAt: new Date() }
      });

      return canceled;
    });

    return reply.status(200).send({ message: "Invitation revoked", invitation: updated });
  });

  // GET /invitations/received (Recipient inbox query, user-scoped RLS)
  app.get("/invitations/received", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const userPrisma = getUserPrisma(auth.user.id, auth.user.email);

    const invitations = await userPrisma.organizationInvitation.findMany({
      where: {
        email: auth.user.email,
        status: "PENDING",
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          }
        },
        inviter: {
          select: {
            email: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return reply.status(200).send({ invitations });
  });

  // POST /invitations/:id/accept (Authenticated recipient in-app acceptance with atomic concurrency lock)
  app.post("/invitations/:id/accept", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id }
    });

    if (!invitation || invitation.email !== auth.user.email) {
      return reply.status(404).send({ error: "Invitation not found" });
    }

    if (invitation.status !== "PENDING") {
      return reply.status(409).send({ error: "Invitation is no longer pending" });
    }

    if (invitation.expiresAt < new Date()) {
      return reply.status(409).send({ error: "Invitation has expired" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Atomic conditional update to prevent double-accept race conditions
        const result = await tx.organizationInvitation.updateMany({
          where: {
            id,
            email: auth.user.email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          data: { status: "ACCEPTED" }
        });

        if (result.count === 0) {
          throw new Error("ALREADY_PROCESSED");
        }

        await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: auth.user.id,
            role: invitation.role,
          }
        });

        await createAuditLog(tx, {
          organizationId: invitation.organizationId,
          actorId: auth.user.id,
          actorSnapshot: { email: auth.user.email },
          action: "MEMBER_JOINED",
          resourceType: "OrganizationMember",
          resourceId: auth.user.id,
          metadata: { invitationId: id }
        });

        // Mark associated notifications as read
        await tx.notification.updateMany({
          where: { userId: auth.user.id, invitationId: id, readAt: null },
          data: { readAt: new Date() }
        });
      });

      return reply.status(200).send({ message: "Invitation accepted successfully" });
    } catch (error: any) {
      if (error.message === "ALREADY_PROCESSED") {
        return reply.status(409).send({ error: "Invitation is no longer pending or has expired" });
      }
      if (error.code === "P2002") {
        return reply.status(409).send({ error: "You are already a member of this organization" });
      }
      return reply.status(500).send({ error: "Failed to accept invitation" });
    }
  });

  // POST /invitations/:id/decline (Authenticated recipient in-app decline)
  app.post("/invitations/:id/decline", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id }
    });

    if (!invitation || invitation.email !== auth.user.email) {
      return reply.status(404).send({ error: "Invitation not found" });
    }

    if (invitation.status !== "PENDING") {
      return reply.status(409).send({ error: "Invitation is no longer pending" });
    }

    if (invitation.expiresAt < new Date()) {
      return reply.status(409).send({ error: "Invitation has expired" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const result = await tx.organizationInvitation.updateMany({
          where: {
            id,
            email: auth.user.email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          data: { status: "REJECTED" }
        });

        if (result.count === 0) {
          throw new Error("ALREADY_PROCESSED");
        }

        await createAuditLog(tx, {
          organizationId: invitation.organizationId,
          actorId: auth.user.id,
          actorSnapshot: { email: auth.user.email },
          action: "MEMBER_INVITATION_DECLINED",
          resourceType: "OrganizationInvitation",
          resourceId: id,
          metadata: { invitedEmail: auth.user.email }
        });

        await tx.notification.updateMany({
          where: { userId: auth.user.id, invitationId: id, readAt: null },
          data: { readAt: new Date() }
        });
      });

      return reply.status(200).send({ message: "Invitation declined" });
    } catch (error: any) {
      if (error.message === "ALREADY_PROCESSED") {
        return reply.status(409).send({ error: "Invitation is no longer pending or has expired" });
      }
      return reply.status(500).send({ error: "Failed to decline invitation" });
    }
  });

  // POST /invitations/accept (Legacy / email-token based endpoint)
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

        await createAuditLog(tx, {
          organizationId: invitation.organizationId,
          actorId: auth.user.id,
          actorSnapshot: { email: auth.user.email },
          action: "MEMBER_JOINED",
          resourceType: "OrganizationMember",
          resourceId: auth.user.id,
          metadata: { invitationId: invitation.id }
        });

        await tx.notification.updateMany({
          where: { userId: auth.user.id, invitationId: invitation.id, readAt: null },
          data: { readAt: new Date() }
        });
      });

      return reply.status(200).send({ message: "Invitation accepted successfully" });
    } catch (error) {
      return reply.status(500).send({ error: "Failed to accept invitation" });
    }
  });

  // POST /invitations/reject (Legacy / email-token based endpoint)
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

    const updated = await prisma.$transaction(async (tx) => {
      const rej = await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: "REJECTED" },
        select: { id: true, status: true }
      });

      await createAuditLog(tx, {
        organizationId: invitation.organizationId,
        actorId: auth.user.id,
        actorSnapshot: { email: auth.user.email },
        action: "MEMBER_INVITATION_DECLINED",
        resourceType: "OrganizationInvitation",
        resourceId: invitation.id,
        metadata: { invitedEmail: auth.user.email }
      });

      await tx.notification.updateMany({
        where: { userId: auth.user.id, invitationId: invitation.id, readAt: null },
        data: { readAt: new Date() }
      });

      return rej;
    });

    return reply.status(200).send({ message: "Invitation rejected", invitation: updated });
  });

  // GET /invitations/verify (Public endpoint to verify invitation status before acceptance)
  app.get("/invitations/verify", async (request, reply) => {
    const parseResult = verifyInvitationQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Invalid or missing invitation token",
        details: parseResult.error.flatten(),
      });
    }

    const { token } = parseResult.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      select: {
        status: true,
        expiresAt: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return reply.status(404).send({
        status: "INVALID",
        error: "Invitation not found or invalid",
      });
    }

    const organizationName = invitation.organization?.name || "Workspace";

    // Check expiration if it was still pending
    if (invitation.status === "PENDING" && invitation.expiresAt < new Date()) {
      return reply.status(200).send({
        status: "EXPIRED",
        organizationName,
      });
    }

    // Map internal CANCELED status to external REVOKED
    if (invitation.status === "CANCELED") {
      return reply.status(200).send({
        status: "REVOKED",
        organizationName,
      });
    }

    // Return status: PENDING, ACCEPTED, or REJECTED
    return reply.status(200).send({
      status: invitation.status,
      organizationName,
    });
  });
}

