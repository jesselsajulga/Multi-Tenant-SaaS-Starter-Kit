import { getOrganizationUsage } from "./src/billing/usage-read";
import { recordUsage } from "./src/billing/usage";
import { prisma } from "./src/db";
import assert from "assert";

async function runTests() {
  console.log("Setting up Usage API Verification...");

  const ts = Date.now();
  const orgA = await prisma.organization.create({ data: { name: `UsageRead-OrgA-${ts}` } });
  const orgB = await prisma.organization.create({ data: { name: `UsageRead-OrgB-${ts}` } });

  const metric = "API_CALLS";

  // Create usage for Org A
  // Event 1: Normal event now
  await recordUsage({ organizationId: orgA.id, metric, quantity: 10 });
  
  // Event 2: Old consumption (e.g. 5 days ago)
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  await recordUsage({ 
    organizationId: orgA.id, 
    metric, 
    quantity: 25, 
    occurredAt: fiveDaysAgo 
  });

  // Create usage for Org B
  await recordUsage({ organizationId: orgB.id, metric, quantity: 1000 });

  // 1. Tenant Isolation
  console.log("1. Tenant isolation");
  const now = new Date();
  const startDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow

  const orgAUsage = await getOrganizationUsage({
    organizationId: orgA.id,
    startDate,
    endDate,
    metric
  });

  assert.strictEqual(orgAUsage.totals.length, 1);
  assert.strictEqual(orgAUsage.totals[0].quantity, 35, "Org A must exactly sum its own usage (10 + 25) and ignore Org B (1000)");

  // 2. Date Boundary (occurredAt vs createdAt)
  console.log("2. Date Boundary");
  // Query only the window for 5 days ago (should pick up Event 2 via occurredAt)
  const windowStart = new Date(fiveDaysAgo.getTime() - 10000);
  const windowEnd = new Date(fiveDaysAgo.getTime() + 10000);
  
  const historicalUsage = await getOrganizationUsage({
    organizationId: orgA.id,
    startDate: windowStart,
    endDate: windowEnd,
    metric
  });

  assert.strictEqual(historicalUsage.totals[0]?.quantity, 25, "Must use occurredAt when present for historical querying");

  // Query only "now" window (should pick up Event 1 via createdAt)
  // We use the time before the script started to now + buffer
  const nowStart = new Date(ts - 5000);
  const nowEnd = new Date(Date.now() + 5000);

  const currentUsage = await getOrganizationUsage({
    organizationId: orgA.id,
    startDate: nowStart,
    endDate: nowEnd,
    metric
  });

  // Event 1 has no occurredAt, so its effective date is createdAt (which is now).
  // Event 2 has occurredAt = 5 days ago, so it should NOT be in the "now" window.
  assert.strictEqual(currentUsage.totals[0]?.quantity, 10, "Must fall back to createdAt when occurredAt is missing, and explicitly exclude old occurredAt events from current windows");

  // 3. History Aggregation
  console.log("3. History Aggregation");
  const history = orgAUsage.history;
  assert.strictEqual(history.length, 2, "Should have 2 distinct days of history");
  
  const historyFiveDaysAgo = history.find(h => h.date === fiveDaysAgo.toISOString().split('T')[0]);
  assert.ok(historyFiveDaysAgo);
  assert.strictEqual(historyFiveDaysAgo.quantity, 25);

  const historyToday = history.find(h => h.date === now.toISOString().split('T')[0]);
  assert.ok(historyToday);
  assert.strictEqual(historyToday.quantity, 10);

  console.log("Cleaning up...");
  await prisma.organization.delete({ where: { id: orgA.id } });
  await prisma.organization.delete({ where: { id: orgB.id } });

  console.log("ALL USAGE READ TESTS PASSED SUCCESSFULLY! ✅");
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
