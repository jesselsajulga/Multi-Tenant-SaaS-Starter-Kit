import { prisma } from "./src/db";
import { getTenantPrisma } from "./src/db";
import assert from "assert";

async function runTests() {
  console.log("Setting up UsageEvent RLS test...");
  const ts = Date.now();

  const org1 = await prisma.organization.create({
    data: { name: `UsageOrg1-${ts}` },
  });

  const org2 = await prisma.organization.create({
    data: { name: `UsageOrg2-${ts}` },
  });

  const tenant1 = getTenantPrisma(org1.id);
  const tenant2 = getTenantPrisma(org2.id);

  console.log("Testing UsageEvent Insertion & Reads...");

  // tenant1 inserts an event
  const event1 = await tenant1.usageEvent.create({
    data: {
      organizationId: org1.id,
      metric: "API_CALL",
      quantity: 5,
    }
  });

  // tenant2 inserts an event
  const event2 = await tenant2.usageEvent.create({
    data: {
      organizationId: org2.id,
      metric: "STORAGE_MB",
      quantity: 256,
    }
  });

  // tenant1 reads should only see org1's events
  const tenant1Events = await tenant1.usageEvent.findMany();
  assert.strictEqual(tenant1Events.length, 1);
  assert.strictEqual(tenant1Events[0].id, event1.id);
  assert.strictEqual(tenant1Events[0].metric, "API_CALL");

  // tenant2 reads should only see org2's events
  const tenant2Events = await tenant2.usageEvent.findMany();
  assert.strictEqual(tenant2Events.length, 1);
  assert.strictEqual(tenant2Events[0].id, event2.id);

  console.log("Testing Immutability (UPDATE)...");

  // tenant1 tries to update its own event (should fail due to trigger)
  try {
    await tenant1.usageEvent.update({
      where: { id: event1.id },
      data: { quantity: 10 }
    });
    assert.fail("Should not be able to update an immutable UsageEvent");
  } catch (error: any) {
    assert.strictEqual(
      error.message.includes("UsageEvent is an immutable ledger") || error.message.includes("permission denied for table UsageEvent") || error.code === "P2010",
      true,
      `Expected custom trigger exception or permission denied for UPDATE, got: ${error.message}`
    );
  }

  console.log("Testing Tenant Isolation (Cross-tenant mutate)...");
  
  // tenant1 tries to update tenant2's event (should fail with RecordNotFound before even hitting trigger, due to RLS)
  try {
    await tenant1.usageEvent.update({
      where: { id: event2.id },
      data: { quantity: 10 }
    });
    assert.fail("Tenant 1 should not be able to see/update Tenant 2's event");
  } catch (error: any) {
    assert.strictEqual(
      error.code === "P2025" || error.code === "P2039" || error.code === "P2010" || error.message.includes("permission denied"),
      true,
      `Expected RLS or permission denied error for cross-tenant UPDATE, got: ${error.code} - ${error.message}`
    );
  }

  console.log("Testing ON DELETE CASCADE & DELETE Prevention...");

  // Since we did NOT grant DELETE to app_user, what happens if tenant1 tries to delete manually?
  try {
    await tenant1.usageEvent.delete({
      where: { id: event1.id },
    });
    assert.fail("Should not be able to manually delete UsageEvent due to permissions");
  } catch (error: any) {
    assert.ok(
      error.message.includes("permission denied for table UsageEvent") || error.code === "P2010" || error.code === "P2025",
      "Expected permission denied or record not found for manual DELETE"
    );
  }

  // Verify cascade deletion works (deleting organization deletes usage events).
  // Wait, deleting Organization using tenantPrisma will also run as app_user!
  // Let's test if cascade works when app_user triggers it.
  try {
    await tenant1.organization.delete({
      where: { id: org1.id },
    });
    
    // Check if event1 is gone (via global prisma to bypass RLS)
    const checkEvent = await prisma.usageEvent.findUnique({ where: { id: event1.id } });
    assert.strictEqual(checkEvent, null, "Event should be cascade deleted");
    console.log("ON DELETE CASCADE worked successfully even without explicit DELETE grant on UsageEvent.");
  } catch (error: any) {
    if (error.message.includes("permission denied for table UsageEvent")) {
      console.log("WARNING: ON DELETE CASCADE failed because app_user lacks DELETE permission.");
      console.log("We must grant DELETE to app_user and rely on a trigger to prevent manual deletion, just like UPDATE.");
      process.exit(2);
    } else {
      throw error;
    }
  }

  console.log("Cleaning up...");
  await prisma.organization.deleteMany({ where: { id: { in: [org1.id, org2.id] } } });

  console.log("All UsageEvent RLS tests passed!");
}

runTests().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
