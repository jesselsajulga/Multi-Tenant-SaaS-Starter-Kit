import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { authenticateRequest } from "../auth/authenticate";
import { authorizeOrganizationAccess } from "../auth/authorize";
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
        organization: {
          include: {
            _count: {
              select: { projects: true }
            }
          }
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const organizations = memberships.map(m => ({
      organization: {
        id: m.organization.id,
        name: m.organization.name,
        createdAt: m.organization.createdAt,
        updatedAt: m.organization.updatedAt,
        _count: m.organization._count
      },
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

    const access = await authorizeOrganizationAccess(id, auth.user.id);
    if (access.error || !access.membership) {
      return reply.status(access.status || 403).send({ 
        error: access.error || "Forbidden",
        code: access.code || "PERMISSION_DENIED" 
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id },
    });

    return reply.status(200).send({ 
      organization: org,
      role: access.membership.role 
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

  // DELETE /organizations/:id (OWNER only)
  app.delete("/organizations/:id", async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    // Centralized RBAC authorization check requiring OWNER
    const access = await authorizeOrganizationAccess(id, auth.user.id, "OWNER");
    if (access.error) {
      return reply.status(access.status || 403).send({ 
        error: access.error,
        code: access.code 
      });
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { subscription: true }
    });

    if (!org) {
      return reply.status(404).send({ error: "Organization not found" });
    }

    // Stripe active subscription cancellation
    if (org.subscription?.stripeSubscriptionId) {
      const activeStatuses = ["active", "trialing", "past_due", "unpaid"];
      if (!org.subscription.status || activeStatuses.includes(org.subscription.status)) {
        try {
          const { stripe } = await import("../stripe/client.js");
          await stripe.subscriptions.cancel(org.subscription.stripeSubscriptionId);
        } catch (stripeErr: any) {
          // Allow deletion if subscription was already deleted or not found in Stripe
          const isNotFoundOrCanceled = 
            stripeErr?.code === "resource_missing" || 
            stripeErr?.statusCode === 404 ||
            stripeErr?.message?.includes("No such subscription");

          if (!isNotFoundOrCanceled) {
            app.log.error({ err: stripeErr }, "Failed to cancel active Stripe subscription during workspace deletion");
            return reply.status(500).send({ 
              error: "Failed to cancel active Stripe subscription. Workspace deletion aborted to prevent billing errors." 
            });
          }
        }
      }
    }

    // Capture workspace metadata and all active members BEFORE deletion cascade
    const membersBeforeDeletion = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      select: { userId: true },
    });

    const recipientUserIds = membersBeforeDeletion
      .map((m) => m.userId)
      .filter((uid) => uid !== auth.user.id);

    const workspaceName = org.name;
    const ownerEmail = auth.user.email;

    // Atomic transaction for organization destruction
    await prisma.$transaction(async (tx) => {
      // Re-validate in-transaction that user is still OWNER
      const membership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: id,
            userId: auth.user.id,
          },
        },
      });

      if (!membership || membership.role !== "OWNER") {
        throw new Error("UNAUTHORIZED");
      }

      // Set transaction-scoped setting allowing AuditLog deletion
      await tx.$executeRaw`SELECT set_config('app.allow_organization_deletion', 'true', TRUE);`;

      // Cascade delete the Organization
      await tx.organization.delete({
        where: { id },
      });
    });

    // POST-COMMIT: Dispatch WORKSPACE_DELETED notifications with isolated failure boundary
    // Deletion is authoritative and must not be rolled back if notification delivery encounters issues
    try {
      const { dispatchWorkspaceDeletedNotifications } = await import("../notifications/service.js");
      await dispatchWorkspaceDeletedNotifications(
        prisma,
        {
          organizationId: id,
          workspaceName,
          ownerEmail,
          recipientUserIds,
        },
        app.log
      );
    } catch (notifErr) {
      app.log.error(
        { err: notifErr, organizationId: id },
        "Error in post-commit dispatch of workspace deletion notifications"
      );
    }

    return reply.status(204).send();
  });
}
