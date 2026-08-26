import type { FastifyRequest } from "fastify";
import { prisma, getTenantPrisma } from "../db";

export type Role = "OWNER" | "MEMBER";

export async function authorizeOrganizationAccess(
  orgId: string | undefined | null,
  userId: string,
  requiredRole?: Role
) {
  if (!orgId) {
    return { error: "Missing organization identifier", status: 400 };
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
    return { error: "Forbidden", status: 403 };
  }

  if (requiredRole) {
    // OWNER can do everything a MEMBER can do, but MEMBER cannot do OWNER things
    if (requiredRole === "OWNER" && membership.role !== "OWNER") {
      return { error: "Forbidden: Requires OWNER role", status: 403 };
    }
  }

  return { orgId, membership, tenantPrisma: getTenantPrisma(orgId) };
}

export async function authorizeRequest(
  request: FastifyRequest,
  userId: string,
  requiredRole?: Role
) {
  const orgId = request.headers["x-organization-id"] as string;
  if (!orgId) {
    return { error: "Missing x-organization-id header", status: 400 };
  }
  return authorizeOrganizationAccess(orgId, userId, requiredRole);
}
