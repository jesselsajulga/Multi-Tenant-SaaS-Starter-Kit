import { Prisma } from "../generated/prisma/client";
import type { prisma as rootPrisma } from "../db";

type TransactionClient = Omit<
  typeof rootPrisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type AuditEventInput = {
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any>;
} & (
  | {
      actorId: string;
      actorSnapshot: { email: string; [key: string]: any }; // Enforce snapshot for user actions
    }
  | {
      actorId: null; // Explicitly null for system actions
    }
);

export async function createAuditLog(
  tx: any,
  input: AuditEventInput
) {
  const baseMetadata = input.metadata || {};
  
  let finalMetadata: any;
  if (input.actorId === null) {
    finalMetadata = {
      ...baseMetadata,
      actorType: "SYSTEM",
      actorSnapshot: null,
    };
  } else {
    finalMetadata = {
      ...baseMetadata,
      actorType: "USER",
      actorSnapshot: input.actorSnapshot,
    };
  }

  return tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: finalMetadata,
    },
  });
}
