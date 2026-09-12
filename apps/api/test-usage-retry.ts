import { prisma } from "./src/db";
import { aggregateAndSyncUsage } from "./src/billing/aggregation";
import { stripe } from "./src/stripe/client";
import assert from "assert";

async function runTests() {
  console.log("Setting up High-Water Mark Integration Test...");

  const ts = Date.now();
  const org = await prisma.organization.create({
    data: { name: `UsageRetryOrg-${ts}` },
  });

  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      stripeCustomerId: `cus_retry_${ts}`,
    }
  });

  // Mock Stripe
  let stripeCallCount = 0;
  let lastIdempotencyKey: string | undefined;
  
  (stripe as any).billing = {
    meterEvents: {
      create: async (payload: any, options?: { idempotencyKey?: string }) => {
        stripeCallCount++;
        lastIdempotencyKey = options?.idempotencyKey;
        
        return {
          id: `me_test_${Date.now()}`,
          object: "billing.meter_event",
          created: Math.floor(Date.now() / 1000),
          event_name: payload.event_name,
          identifier: `req_${Date.now()}`,
          livemode: false,
          payload: payload.payload,
          timestamp: Math.floor(Date.now() / 1000)
        } as any;
      }
    }
  };

  console.log("1. Insert Initial Usage...");
  
  // Create first batch of events
  // We manually set createdAt to guarantee order for testing late usage later
  const baseTime = new Date("2026-08-30T10:00:00Z");
  
  const event1 = await prisma.usageEvent.create({
    data: { organizationId: org.id, metric: "API_CALLS", quantity: 5, createdAt: new Date(baseTime.getTime() + 1000) }
  });
  const event2 = await prisma.usageEvent.create({
    data: { organizationId: org.id, metric: "API_CALLS", quantity: 5, createdAt: new Date(baseTime.getTime() + 2000) }
  });

  console.log("2. Test Successful Initial Synchronization...");
  
  const initialSync = await aggregateAndSyncUsage(org.id, "API_CALLS");
  assert.ok(initialSync);
  assert.strictEqual(initialSync.status, "SUCCESS");
  assert.strictEqual(initialSync.quantity, 10);
  assert.strictEqual(initialSync.syncedThroughId, event2.id);
  assert.strictEqual(initialSync.syncedThroughTimestamp.getTime(), event2.createdAt.getTime());
  
  const initialIdempotencyKey = initialSync.idempotencyKey;

  console.log("3. Test Concurrent Worker Race (P2002 prevention)...");
  
  // Insert new usage
  const event3 = await prisma.usageEvent.create({
    data: { organizationId: org.id, metric: "API_CALLS", quantity: 3, createdAt: new Date(baseTime.getTime() + 3000) }
  });

  // Intercept prisma.usageSyncLog.create to simulate concurrency
  const originalCreate = prisma.usageSyncLog.create;
  let concurrentIntercepted = false;
  // @ts-ignore
  prisma.usageSyncLog.create = async (args: any) => {
    if (!concurrentIntercepted) {
      concurrentIntercepted = true;
      // Simulate another worker beating us to it by inserting it first!
      await originalCreate.call(prisma.usageSyncLog, {
        data: {
          ...args.data,
          status: "SUCCESS" // Another worker finished
        }
      });
      // Now our original creation should throw P2002
    }
    return originalCreate.call(prisma.usageSyncLog, args);
  };

  const concurrentSyncResult = await aggregateAndSyncUsage(org.id, "API_CALLS");
  // Should return null because the P2002 was caught gracefully
  assert.strictEqual(concurrentSyncResult, null, "Concurrent worker should safely return null on P2002");
  
  // Restore
  // @ts-ignore
  prisma.usageSyncLog.create = originalCreate;

  console.log("4. Test PENDING Blocks New Deltas and Demands Recovery...");
  
  // Create a PENDING log manually simulating a crash before Stripe
  const event4 = await prisma.usageEvent.create({
    data: { organizationId: org.id, metric: "API_CALLS", quantity: 7, createdAt: new Date(baseTime.getTime() + 4000) }
  });

  const pendingLog = await prisma.usageSyncLog.create({
    data: {
      organizationId: org.id,
      metric: "API_CALLS",
      syncedThroughTimestamp: event4.createdAt,
      syncedThroughId: event4.id,
      quantity: 7,
      status: "PENDING",
      idempotencyKey: `pending_${ts}`
    }
  });

  const startStripeCount = stripeCallCount;
  
  // Calling aggregateAndSyncUsage should recover the PENDING log, not create a new one!
  const recoveredSync = await aggregateAndSyncUsage(org.id, "API_CALLS");
  assert.ok(recoveredSync);
  assert.strictEqual(recoveredSync.id, pendingLog.id, "Must recover the existing PENDING log");
  assert.strictEqual(recoveredSync.status, "SUCCESS", "Should transition to SUCCESS after recovery");
  assert.strictEqual(stripeCallCount, startStripeCount + 1, "Stripe should be called for the recovery");
  assert.strictEqual(lastIdempotencyKey, pendingLog.idempotencyKey, "Must reuse PENDING idempotency key");

  console.log("5. Test Late-Reported Usage (Occurred earlier, recorded later)...");
  
  // consumption happened at 09:30, but it arrived at 10:05
  const lateEvent = await prisma.usageEvent.create({
    data: { 
      organizationId: org.id, 
      metric: "API_CALLS", 
      quantity: 50, 
      occurredAt: new Date("2026-08-30T09:30:00Z"), // Late!
      createdAt: new Date(baseTime.getTime() + 5000) // Append time is strictly later
    }
  });

  const lateSync = await aggregateAndSyncUsage(org.id, "API_CALLS");
  assert.ok(lateSync);
  assert.strictEqual(lateSync.status, "SUCCESS");
  assert.strictEqual(lateSync.quantity, 50, "Must correctly sum the late usage due to High-Water Mark on createdAt");

  console.log("Cleaning up...");
  await prisma.organization.delete({ where: { id: org.id } });

  console.log("All Retry/Concurrency tests passed successfully!");
}

runTests().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
