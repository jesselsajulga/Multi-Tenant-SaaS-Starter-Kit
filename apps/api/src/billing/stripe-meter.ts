import { prisma } from "../db";
import { stripe } from "../stripe/client";
import { UsageSyncLog, UsageSyncStatus } from "../generated/prisma/client";
import Stripe from "stripe";

// Server-controlled metric mapping
export const STRIPE_METER_MAPPING: Record<string, string> = {
  "API_CALLS": "api_calls",
  "STORAGE_MB": "storage_mb",
  "AI_TOKENS": "ai_tokens"
};

/**
 * Retrieves a PENDING UsageSyncLog and submits it to Stripe.
 * Transitions to SUCCESS or FAILED based on definitive outcomes.
 * Leaves PENDING on transient errors.
 */
export async function reportPendingUsageToStripe(syncLogId: string): Promise<UsageSyncLog> {
  const log = await prisma.usageSyncLog.findUnique({
    where: { id: syncLogId }
  });

  if (!log) {
    throw new Error(`UsageSyncLog ${syncLogId} not found`);
  }

  if (log.status !== "PENDING") {
    throw new Error(`UsageSyncLog ${syncLogId} is not PENDING (current status: ${log.status})`);
  }

  // Resolve Customer
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: log.organizationId }
  });

  if (!subscription || !subscription.stripeCustomerId) {
    // Missing customer configuration is a definitive failure for this log
    return prisma.usageSyncLog.update({
      where: { id: log.id },
      data: { status: "FAILED" }
    });
  }

  // Map metric
  const stripeEventName = STRIPE_METER_MAPPING[log.metric];
  if (!stripeEventName) {
    // Invalid metric mapping
    return prisma.usageSyncLog.update({
      where: { id: log.id },
      data: { status: "FAILED" }
    });
  }

  // Call Stripe
  let meterEvent: Stripe.Billing.MeterEvent;
  try {
    meterEvent = await stripe.billing.meterEvents.create(
      {
        event_name: stripeEventName,
        payload: {
          value: log.quantity.toString(),
          stripe_customer_id: subscription.stripeCustomerId,
        }
      },
      {
        idempotencyKey: log.idempotencyKey
      }
    );
  } catch (error: any) {
    // Determine if failure is transient or definitive
    if (error instanceof Stripe.errors.StripeError) {
      // Definitive errors (400 Bad Request, Auth error, etc)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        return prisma.usageSyncLog.update({
          where: { id: log.id },
          data: { status: "FAILED" }
        });
      }
    }
    // Transient errors (network, 5xx, rate limits) -> throw and remain PENDING
    throw error;
  }

  // Success
  return prisma.usageSyncLog.update({
    where: { id: log.id },
    data: {
      status: "SUCCESS",
      stripeMeterEventId: meterEvent.identifier || "unknown_id"
    }
  });
}
