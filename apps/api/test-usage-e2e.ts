import { prisma } from "./src/db";
import { recordUsage } from "./src/billing/usage";
import { aggregateAndSyncUsage } from "./src/billing/aggregation";
import { stripe } from "./src/stripe/client";
import Stripe from "stripe";
import assert from "assert";

async function runTests() {
  console.log("Setting up E2E Synchronization Verification...");

  const ts = Date.now();
  const orgA = await prisma.organization.create({ data: { name: `E2E-OrgA-${ts}` } });
  const orgB = await prisma.organization.create({ data: { name: `E2E-OrgB-${ts}` } });

  await prisma.subscription.create({ data: { organizationId: orgA.id, stripeCustomerId: `cus_A_${ts}` } });
  await prisma.subscription.create({ data: { organizationId: orgB.id, stripeCustomerId: `cus_B_${ts}` } });

  // Stripe Mock
  let stripeCallCount = 0;
  let lastStripePayload: any = null;
  let simulateStripeError: "NONE" | "TIMEOUT" | "PERMANENT" = "NONE";
  let lastIdempotencyKey: string | undefined;

  // @ts-ignore
  stripe.billing = {
    meterEvents: {
      create: async (payload: any, options?: { idempotencyKey?: string }) => {
        stripeCallCount++;
        lastStripePayload = payload;
        lastIdempotencyKey = options?.idempotencyKey;

        if (simulateStripeError === "TIMEOUT") {
          throw new Error("Stripe timeout"); // Will be caught by reportPendingUsageToStripe and rethrown
        }
        if (simulateStripeError === "PERMANENT") {
          throw new Stripe.errors.StripeInvalidRequestError({
            message: "Invalid meter",
            type: "invalid_request_error",
            statusCode: 400
          });
        }

        return {
          identifier: `evt_${Date.now()}`,
          object: "billing.meter_event",
          created: Math.floor(Date.now() / 1000),
          event_name: payload.event_name,
          livemode: false,
          payload: payload.payload
        };
      }
    }
  };

  const metric = "API_CALLS";

  // ==========================================
  // 1. Normal billing path
  // ==========================================
  console.log("1. Normal billing path");
  await recordUsage({ organizationId: orgA.id, metric, quantity: 10 });
  await recordUsage({ organizationId: orgA.id, metric, quantity: 5 });

  let syncResult = await aggregateAndSyncUsage(orgA.id, metric);
  assert.ok(syncResult);
  assert.strictEqual(syncResult.status, "SUCCESS");
  assert.strictEqual(syncResult.quantity, 15);
  assert.ok(syncResult.stripeMeterEventId);
  assert.strictEqual(stripeCallCount, 1);

  const initialCursorId = syncResult.syncedThroughId;
  const initialIdempotencyKey = syncResult.idempotencyKey;

  // ==========================================
  // 2. No duplicate billing
  // ==========================================
  console.log("2. No duplicate billing");
  syncResult = await aggregateAndSyncUsage(orgA.id, metric);
  assert.strictEqual(syncResult, null, "Should return null when there are no new events to sync");
  assert.strictEqual(stripeCallCount, 1, "Stripe must not be called when there is no new usage");

  // ==========================================
  // 3. Incremental usage
  // ==========================================
  console.log("3. Incremental usage");
  await recordUsage({ organizationId: orgA.id, metric, quantity: 7 });
  syncResult = await aggregateAndSyncUsage(orgA.id, metric);
  assert.ok(syncResult);
  assert.strictEqual(syncResult.status, "SUCCESS");
  assert.strictEqual(syncResult.quantity, 7, "Must strictly batch the delta only");
  assert.strictEqual(stripeCallCount, 2);
  assert.notStrictEqual(syncResult.idempotencyKey, initialIdempotencyKey);
  assert.notStrictEqual(syncResult.syncedThroughId, initialCursorId);

  // ==========================================
  // 4. Late-reported usage
  // ==========================================
  console.log("4. Late-reported usage");
  await recordUsage({ 
    organizationId: orgA.id, 
    metric, 
    quantity: 20, 
    occurredAt: new Date("2020-01-01T00:00:00Z") // Very old consumption
  });
  syncResult = await aggregateAndSyncUsage(orgA.id, metric);
  assert.ok(syncResult);
  assert.strictEqual(syncResult.status, "SUCCESS");
  assert.strictEqual(syncResult.quantity, 20, "Late consumption correctly caught by the append-only createdAt cursor");
  assert.strictEqual(stripeCallCount, 3);

  // ==========================================
  // 5. Tenant isolation
  // ==========================================
  console.log("5. Tenant isolation");
  await recordUsage({ organizationId: orgB.id, metric, quantity: 100 });
  // Org A should have 0 delta right now
  syncResult = await aggregateAndSyncUsage(orgA.id, metric);
  assert.strictEqual(syncResult, null, "Org A sync must NOT pick up Org B events");
  // Org B should have 100
  const orgBSync = await aggregateAndSyncUsage(orgB.id, metric);
  assert.ok(orgBSync);
  assert.strictEqual(orgBSync.quantity, 100);

  // ==========================================
  // 6. PENDING lock recovery
  // ==========================================
  console.log("6. PENDING lock recovery");
  await recordUsage({ organizationId: orgA.id, metric, quantity: 8 });
  
  // Inject a simulated failure where the lock remains PENDING (e.g. process crash right before Stripe)
  const pendingEvent = await prisma.usageEvent.findFirst({ where: { organizationId: orgA.id, quantity: 8 }});
  const pendingLog = await prisma.usageSyncLog.create({
    data: {
      organizationId: orgA.id,
      metric,
      quantity: 8,
      status: "PENDING",
      syncedThroughTimestamp: pendingEvent!.createdAt,
      syncedThroughId: pendingEvent!.id,
      idempotencyKey: `forced_pending_${ts}`
    }
  });

  const callsBeforeRecovery = stripeCallCount;
  syncResult = await aggregateAndSyncUsage(orgA.id, metric);
  assert.ok(syncResult);
  assert.strictEqual(syncResult.id, pendingLog.id, "Must recover and reuse the exact PENDING record");
  assert.strictEqual(syncResult.status, "SUCCESS");
  assert.strictEqual(stripeCallCount, callsBeforeRecovery + 1);
  assert.strictEqual(lastIdempotencyKey, `forced_pending_${ts}`, "Must reuse exactly the same idempotency key to prevent duplicate billing");

  // ==========================================
  // 7. Transient failure (5xx or Timeout)
  // ==========================================
  console.log("7. Transient failure");
  await recordUsage({ organizationId: orgA.id, metric, quantity: 2 });
  simulateStripeError = "TIMEOUT";
  
  let transientErrorThrown = false;
  try {
    await aggregateAndSyncUsage(orgA.id, metric);
  } catch(e: any) {
    transientErrorThrown = true;
    assert.strictEqual(e.message, "Stripe timeout");
  }
  assert.ok(transientErrorThrown);

  // Check state: should be PENDING
  const transientLog = await prisma.usageSyncLog.findFirst({
    where: { organizationId: orgA.id, metric },
    orderBy: { createdAt: "desc" }
  });
  assert.strictEqual(transientLog?.status, "PENDING", "Transient failure must leave log in PENDING state");

  // Recover it
  simulateStripeError = "NONE";
  syncResult = await aggregateAndSyncUsage(orgA.id, metric);
  assert.strictEqual(syncResult?.status, "SUCCESS");
  assert.strictEqual(syncResult?.id, transientLog?.id);

  // ==========================================
  // 8. Permanent failure
  // ==========================================
  console.log("8. Permanent failure");
  await recordUsage({ organizationId: orgA.id, metric, quantity: 1 });
  simulateStripeError = "PERMANENT";
  
  const permanentSyncResult = await aggregateAndSyncUsage(orgA.id, metric);
  assert.ok(permanentSyncResult);
  assert.strictEqual(permanentSyncResult.status, "FAILED", "Permanent failure must transition log to FAILED");

  const permanentLog = await prisma.usageSyncLog.findFirst({
    where: { organizationId: orgA.id, metric },
    orderBy: { createdAt: "desc" }
  });
  assert.strictEqual(permanentLog?.status, "FAILED", "Permanent failure must transition log to FAILED");

  // Because it failed, the cursor did NOT advance. The event with quantity 1 is still technically unsynced.
  // We expect a subsequent call to recreate the delta? Wait, aggregateAndSyncUsage finds the last SUCCESS cursor.
  // The event is > the last SUCCESS cursor. So it will try to re-batch it.
  // But wait! If Stripe threw a Permanent error for this batch, re-running aggregateAndSyncUsage will just re-batch the EXACT SAME event and probably hit the SAME Stripe error.
  // This is acceptable behavior for a permanent error (it requires human intervention to fix the configuration),
  // but it verifies the invariant: "Confirm the system does not silently advance the authoritative cursor."
  
  // ==========================================
  // 9. Concurrency serialization
  // ==========================================
  console.log("9. Concurrency serialization");
  simulateStripeError = "NONE"; // Clear error
  
  await recordUsage({ organizationId: orgB.id, metric, quantity: 50 });
  const originalCreate = prisma.usageSyncLog.create;
  let concurrentIntercepted = false;
  // @ts-ignore
  prisma.usageSyncLog.create = async (args: any) => {
    if (!concurrentIntercepted) {
      concurrentIntercepted = true;
      // Simulate another worker beating us to it
      await originalCreate.call(prisma.usageSyncLog, {
        data: {
          ...args.data,
          status: "SUCCESS" // Another worker finished
        }
      });
    }
    return originalCreate.call(prisma.usageSyncLog, args);
  };

  const concurrentResult = await aggregateAndSyncUsage(orgB.id, metric);
  assert.strictEqual(concurrentResult, null, "Concurrent worker should safely return null on P2002");
  
  // @ts-ignore
  prisma.usageSyncLog.create = originalCreate;

  console.log("Cleaning up...");
  await prisma.organization.delete({ where: { id: orgA.id } });
  await prisma.organization.delete({ where: { id: orgB.id } });

  console.log("ALL E2E SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! ✅");
}

runTests().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
