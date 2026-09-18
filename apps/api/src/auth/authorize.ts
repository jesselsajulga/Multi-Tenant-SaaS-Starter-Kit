import type { FastifyRequest } from "fastify";
import { prisma, getTenantPrisma } from "../db";

export type Role = "OWNER" | "MEMBER";

export type AuthorizeSuccess = {
  orgId: string;
  membership: NonNullable<Awaited<ReturnType<typeof prisma.organizationMember.findUnique>>>;
  tenantPrisma: ReturnType<typeof getTenantPrisma>;
  error?: undefined;
  code?: undefined;
  status?: undefined;
};

export type AuthorizeFailure = {
  error: string;
  code?: string;
  status: number;
  orgId?: undefined;
  membership?: undefined;
  tenantPrisma?: undefined;
};

export type AuthorizeResult = AuthorizeSuccess | AuthorizeFailure;

export async function authorizeOrganizationAccess(
  orgId: string | undefined | null,
  userId: string,
  requiredRole?: Role
): Promise<AuthorizeResult> {
  if (!orgId) {
    return { error: "Missing organization identifier", code: "BAD_REQUEST", status: 400 };
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
    // Check if the organization itself still exists
    const organizationExists = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!organizationExists) {
      return {
        error: "Workspace no longer exists",
        code: "WORKSPACE_DELETED",
        status: 404,
      };
    }

    // Organization exists: check if the user previously had membership that was revoked
    const removalAudit = await prisma.auditLog.findFirst({
      where: {
        organizationId: orgId,
        action: "MEMBER_REMOVED",
        resourceId: userId,
      },
      orderBy: { createdAt: "desc" },
    });

    if (removalAudit) {
      return { 
        error: "Workspace access revoked", 
        code: "WORKSPACE_ACCESS_REVOKED", 
        status: 403 
      };
    }

    return { error: "Forbidden", code: "PERMISSION_DENIED", status: 403 };
  }

  if (requiredRole) {
    // OWNER can do everything a MEMBER can do, but MEMBER cannot do OWNER things
    if (requiredRole === "OWNER" && membership.role !== "OWNER") {
      return { error: "Forbidden: Requires OWNER role", code: "OWNER_REQUIRED", status: 403 };
    }
  }

  return { orgId, membership, tenantPrisma: getTenantPrisma(orgId) };
}

export async function authorizeRequest(
  request: FastifyRequest,
  userId: string,
  requiredRole?: Role
): Promise<AuthorizeResult> {
  const orgId = request.headers["x-organization-id"] as string;
  if (!orgId) {
    return { error: "Missing x-organization-id header", code: "BAD_REQUEST", status: 400 };
  }
  return authorizeOrganizationAccess(orgId, userId, requiredRole);
}
