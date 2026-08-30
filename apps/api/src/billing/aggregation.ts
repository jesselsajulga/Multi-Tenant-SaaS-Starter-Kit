import { prisma } from "../db";
import { UsageSyncLog } from "../generated/prisma/client";
import { UsageMetric } from "./usage";
import crypto from "crypto";
import { Prisma } from "../generated/prisma/client";
import { reportPendingUsageToStripe } from "./stripe-meter";

export async function aggregateAndSyncUsage(
  organizationId: string,
  metric: UsageMetric
): Promise<UsageSyncLog | null> {
  // 1. Check for existing PENDING log
  const pendingLog = await prisma.usageSyncLog.findFirst({
    where: {
      organizationId,
      metric,
      status: "PENDING"
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (pendingLog) {
    // A PENDING log exists. We must recover it before advancing the cursor.
    // Call Stripe directly with the existing log.
    return reportPendingUsageToStripe(pendingLog.id);
  }

  // 2. Find authoritative SUCCESS cursor
  const lastSuccessLog = await prisma.usageSyncLog.findFirst({
    where: {
      organizationId,
      metric,
      status: "SUCCESS"
    },
    orderBy: [
      { syncedThroughTimestamp: "desc" },
      { syncedThroughId: "desc" }
    ]
  });

  const cursorTimestamp = lastSuccessLog?.syncedThroughTimestamp || new Date(0);
  const cursorId = lastSuccessLog?.syncedThroughId || "";

  // 3. Fetch new UsageEvents after the cursor
  const newEvents = await prisma.usageEvent.findMany({
    where: {
      organizationId,
      metric,
      OR: [
        { createdAt: { gt: cursorTimestamp } },
        {
          createdAt: cursorTimestamp,
          id: { gt: cursorId }
        }
      ]
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" }
    ]
  });

  if (newEvents.length === 0) {
    return null; // Nothing to sync
  }

  // 4. Calculate delta and new cursor
  const deltaQuantity = newEvents.reduce((sum, e) => sum + e.quantity, 0);
  const lastEvent = newEvents[newEvents.length - 1];
  const newCursorTimestamp = lastEvent.createdAt;
  const newCursorId = lastEvent.id;

  // 5. Generate deterministic idempotency key
  const hashInput = `${organizationId}_${metric}_${newCursorTimestamp.toISOString()}_${newCursorId}`;
  const idempotencyKey = crypto.createHash("sha256").update(hashInput).digest("hex");

  // 6. Attempt to acquire the sync lock by inserting PENDING log
  let newPendingLog: UsageSyncLog;
  try {
    newPendingLog = await prisma.usageSyncLog.create({
      data: {
        organizationId,
        metric,
        syncedThroughTimestamp: newCursorTimestamp,
        syncedThroughId: newCursorId,
        quantity: deltaQuantity,
        status: "PENDING",
        idempotencyKey
      }
    });
  } catch (error: any) {
    // Check if it's a Prisma unique constraint violation on idempotencyKey
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Concurrent worker beat us to creating this exact batch.
      // We safely abort our synchronization attempt.
      return null;
    }
    throw error;
  }

  // 7. Fire to Stripe
  return reportPendingUsageToStripe(newPendingLog.id);
}
