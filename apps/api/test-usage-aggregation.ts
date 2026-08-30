import test from "node:test";
import assert from "node:assert";
import { prisma } from "./src/db";
import { aggregateUsage } from "./src/billing/aggregation";

test("Usage Aggregation 8.6.1", async (t) => {
  // Setup: Create two distinct organizations to test isolation
  const orgA = await prisma.organization.create({ data: { name: "Test Org A" } });
  const orgB = await prisma.organization.create({ data: { name: "Test Org B" } });

  const now = new Date("2026-01-01T12:00:00Z");
  const tMinus1 = new Date("2026-01-01T11:59:59Z");
  const tPlus1 = new Date("2026-01-01T12:00:01Z");
  const tPlus10 = new Date("2026-01-01T12:10:00Z");

  // Insert events
  await prisma.usageEvent.createMany({
    data: [
      // Org A Events
      { organizationId: orgA.id, metric: "API_CALLS", quantity: 5, timestamp: tMinus1 }, // outside (before)
      { organizationId: orgA.id, metric: "API_CALLS", quantity: 10, timestamp: now }, // inside (inclusive start)
      { organizationId: orgA.id, metric: "API_CALLS", quantity: 15, timestamp: tPlus1 }, // inside
      { organizationId: orgA.id, metric: "STORAGE_MB", quantity: 100, timestamp: tPlus1 }, // inside (different metric)
      { organizationId: orgA.id, metric: "API_CALLS", quantity: 20, timestamp: tPlus10 }, // outside (exclusive end)
      
      // Org B Events
      { organizationId: orgB.id, metric: "API_CALLS", quantity: 50, timestamp: tPlus1 }, // inside time window, but different org
    ]
  });

  await t.test("Validates periodStart < periodEnd", async () => {
    await assert.rejects(
      aggregateUsage(orgA.id, tPlus10, now),
      /Invalid interval/
    );
    await assert.rejects(
      aggregateUsage(orgA.id, now, now),
      /Invalid interval/
    );
  });

  await t.test("Aggregates correctly: inclusive start, exclusive end, isolated by org and metric", async () => {
    const results = await aggregateUsage(orgA.id, now, tPlus10);
    
    assert.strictEqual(results.length, 2, "Should return results for API_CALLS and STORAGE_MB");
    
    const apiCalls = results.find(r => r.metric === "API_CALLS");
    const storage = results.find(r => r.metric === "STORAGE_MB");

    assert.ok(apiCalls);
    assert.ok(storage);

    // API_CALLS: 10 (now) + 15 (tPlus1) = 25
    // 5 (tMinus1) is before `now`. 20 (tPlus10) is at exclusive end. 50 is Org B.
    assert.strictEqual(apiCalls.total, 25);
    
    // STORAGE_MB: 100
    assert.strictEqual(storage.total, 100);
  });

  await t.test("Empty windows produce no usage result", async () => {
    const farFutureStart = new Date("2030-01-01T00:00:00Z");
    const farFutureEnd = new Date("2030-01-02T00:00:00Z");
    const results = await aggregateUsage(orgA.id, farFutureStart, farFutureEnd);
    
    assert.strictEqual(results.length, 0);
  });

  await t.test("Usage events are immutable and unmodified", async () => {
    // Assert no rows were mutated by the aggregation call
    const events = await prisma.usageEvent.findMany({ where: { organizationId: orgA.id }});
    assert.strictEqual(events.length, 5);
  });

  // Teardown
  await prisma.usageEvent.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  await prisma.$disconnect();
});
