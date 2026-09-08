import "dotenv/config";
import { prisma } from "./src/db";
import { reportPendingUsageToStripe } from "./src/billing/stripe-meter";
import { stripe } from "./src/stripe/client";
import assert from "assert";
import crypto from "crypto";

async function runTests() {
  console.log("Setting up Stripe Meter Integration test...");
  
  // Mock Stripe
  let stripeCallCount = 0;
  let lastIdempotencyKey: string | undefined;
  
  (stripe as any).billing = {
    meterEvents: {
      create: async (payload: any, options?: { idempotencyKey?: string }): Promise<any> => {
        stripeCallCount++;
        lastIdempotencyKey = options?.idempotencyKey;
        
        // Simulating Stripe acceptance
        return {
          id: "me_test_123",
          object: "billing.meter_event",
          created: Math.floor(Date.now() / 1000),
          event_name: payload.event_name,
          identifier: `req_${Date.now()}`,
          livemode: false,
          payload: payload.payload,
          timestamp: new Date()
        };
      }
    }
  };

  const ts = Date.now();
  const org = await prisma.organization.create({
    data: { name: `StripeMeterOrg-${ts}` },
  });

  // Create missing subscription configuration test
  const logMissingCust = await prisma.usageSyncLog.create({
    data: {
      organizationId: org.id,
      metric: "API_CALLS",
      quantity: 100,
      syncedThroughTimestamp: new Date(),
      syncedThroughId: "evt_missing_cust",
      idempotencyKey: `idem_missing_${ts}`,
      status: "PENDING"
    }
  });

  console.log("Testing Configuration Failure (Missing Customer)...");
  const failedLog1 = await reportPendingUsageToStripe(logMissingCust.id);
  assert.strictEqual(failedLog1.status, "FAILED", "Should fail if no Stripe Customer exists");

  // Create Subscription for Org
  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      stripeCustomerId: `cus_test_${ts}`,
    }
  });

  // Invalid metric test
  const logInvalidMetric = await prisma.usageSyncLog.create({
    data: {
      organizationId: org.id,
      metric: "UNKNOWN_METRIC",
      quantity: 100,
      syncedThroughTimestamp: new Date(),
      syncedThroughId: "evt_invalid_metric",
      idempotencyKey: `idem_invalid_${ts}`,
      status: "PENDING"
    }
  });
  
  console.log("Testing Configuration Failure (Invalid Metric Mapping)...");
  const failedLog2 = await reportPendingUsageToStripe(logInvalidMetric.id);
  assert.strictEqual(failedLog2.status, "FAILED", "Should fail if metric is unmapped");

  // Happy Path Test
  const logHappy = await prisma.usageSyncLog.create({
    data: {
      organizationId: org.id,
      metric: "API_CALLS",
      quantity: 50,
      syncedThroughTimestamp: new Date(),
      syncedThroughId: "evt_happy",
      idempotencyKey: `idem_happy_${ts}`,
      status: "PENDING"
    }
  });

  console.log("Testing Successful Sync (PENDING -> SUCCESS)...");
  const successLog = await reportPendingUsageToStripe(logHappy.id);
  assert.strictEqual(successLog.status, "SUCCESS", "Should transition to SUCCESS");
  assert.ok(successLog.stripeMeterEventId, "Should persist stripeMeterEventId");
  assert.strictEqual(stripeCallCount, 1, "Stripe should have been called once");
  assert.strictEqual(lastIdempotencyKey, logHappy.idempotencyKey, "Idempotency key must match");

  // The Crash Recovery Test
  console.log("Testing Crash Recovery (Idempotency Key Reuse)...");
  
  const logCrash = await prisma.usageSyncLog.create({
    data: {
      organizationId: org.id,
      metric: "STORAGE_MB",
      quantity: 500,
      syncedThroughTimestamp: new Date(),
      syncedThroughId: "evt_crash",
      idempotencyKey: `idem_crash_${ts}`,
      status: "PENDING"
    }
  });

  // Intercept the database update to simulate a crash
  const originalUpdate = prisma.usageSyncLog.update;
  let updateIntercepted = false;
  // @ts-ignore
  prisma.usageSyncLog.update = async (args: any) => {
    if (args.where.id === logCrash.id && args.data.status === "SUCCESS" && !updateIntercepted) {
      updateIntercepted = true;
      throw new Error("SIMULATED_CRASH");
    }
    return originalUpdate.call(prisma.usageSyncLog, args);
  };

  const initialStripeCount = stripeCallCount;
  
  try {
    await reportPendingUsageToStripe(logCrash.id);
    assert.fail("Should have crashed");
  } catch (err: any) {
    assert.strictEqual(err.message, "SIMULATED_CRASH");
  }

  // Verify Stripe was called but db remains PENDING
  assert.strictEqual(stripeCallCount, initialStripeCount + 1, "Stripe WAS called during crash attempt");
  
  const crashLogCheck = await prisma.usageSyncLog.findUnique({ where: { id: logCrash.id } });
  assert.strictEqual(crashLogCheck?.status, "PENDING", "Database log MUST remain PENDING after crash");

  // The Retry
  const retryLog = await reportPendingUsageToStripe(logCrash.id);
  
  assert.strictEqual(retryLog.status, "SUCCESS", "Retry should successfully transition to SUCCESS");
  assert.strictEqual(stripeCallCount, initialStripeCount + 2, "Stripe called again on retry");
  assert.strictEqual(lastIdempotencyKey, logCrash.idempotencyKey, "CRITICAL: Idempotency key MUST be strictly reused on retry!");

  // Restore update
  // @ts-ignore
  prisma.usageSyncLog.update = originalUpdate;

  console.log("Cleaning up...");
  await prisma.organization.delete({ where: { id: org.id } });

  console.log("All Stripe Meter tests passed!");
}

runTests().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
