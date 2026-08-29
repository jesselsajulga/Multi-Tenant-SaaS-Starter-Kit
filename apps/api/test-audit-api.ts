import { FastifyInstance } from "fastify";
import { buildApp } from "./src/app";
import { prisma } from "./src/db";
import { getTenantPrisma } from "./src/db";
import assert from "assert";
import { createHash } from "node:crypto";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function runTests() {
  const app = buildApp();
  await app.ready();

  console.log("Setting up test users and organizations...");
  const ts = Date.now();
  
  const owner1 = await prisma.user.create({
    data: { email: `owner1-${ts}@example.com`, passwordHash: "hash" },
  });

  const member1 = await prisma.user.create({
    data: { email: `member1-${ts}@example.com`, passwordHash: "hash" },
  });

  const owner2 = await prisma.user.create({
    data: { email: `owner2-${ts}@example.com`, passwordHash: "hash" },
  });

  const org1 = await prisma.organization.create({
    data: {
      name: `Org1-${ts}`,
      members: {
        create: [
          { userId: owner1.id, role: "OWNER" },
          { userId: member1.id, role: "MEMBER" },
        ],
      },
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      name: `Org2-${ts}`,
      members: {
        create: [{ userId: owner2.id, role: "OWNER" }],
      },
    },
  });

  const owner1Token = `raw-owner1-${ts}`;
  const member1Token = `raw-member1-${ts}`;
  const owner2Token = `raw-owner2-${ts}`;

  const owner1Session = await prisma.session.create({
    data: { userId: owner1.id, tokenHash: hashToken(owner1Token), expiresAt: new Date(Date.now() + 100000) }
  });
  const member1Session = await prisma.session.create({
    data: { userId: member1.id, tokenHash: hashToken(member1Token), expiresAt: new Date(Date.now() + 100000) }
  });
  const owner2Session = await prisma.session.create({
    data: { userId: owner2.id, tokenHash: hashToken(owner2Token), expiresAt: new Date(Date.now() + 100000) }
  });

  console.log("Testing Audit Logs API...");

  // 1. Unauthenticated -> 401
  let res = await app.inject({
    method: "GET",
    url: `/organizations/${org1.id}/audit-logs`,
  });
  assert.strictEqual(res.statusCode, 401, "Expected 401 Unauthenticated");

  // 2. MEMBER -> 403
  res = await app.inject({
    method: "GET",
    url: `/organizations/${org1.id}/audit-logs`,
    cookies: { session: member1Token },
  });
  assert.strictEqual(res.statusCode, 403, "Expected 403 Forbidden for MEMBER");

  // 3. Non-member (owner2) -> 403
  res = await app.inject({
    method: "GET",
    url: `/organizations/${org1.id}/audit-logs`,
    cookies: { session: owner2Token },
  });
  assert.strictEqual(res.statusCode, 403, "Expected 403 Forbidden for Non-member");

  // 4. OWNER with no records -> 200 + empty array
  res = await app.inject({
    method: "GET",
    url: `/organizations/${org1.id}/audit-logs`,
    cookies: { session: owner1Token },
  });
  assert.strictEqual(res.statusCode, 200, "Expected 200 OK for OWNER");
  assert.strictEqual(JSON.parse(res.payload).auditLogs.length, 0, "Expected empty audit logs");

  // Seed some records directly for org1
  const tenant1 = getTenantPrisma(org1.id);
  const log1 = await tenant1.auditLog.create({
    data: {
      organizationId: org1.id,
      actorId: owner1.id,
      action: "PROJECT_CREATED",
      resourceType: "Project",
      resourceId: "test-resource-1",
      metadata: { actorType: "USER", actorSnapshot: { email: owner1.email } },
    }
  });

  const log2 = await tenant1.auditLog.create({
    data: {
      organizationId: org1.id,
      actorId: null,
      action: "SUBSCRIPTION_CREATED",
      resourceType: "Subscription",
      resourceId: "test-resource-2",
      metadata: { actorType: "SYSTEM" },
    }
  });

  // Seed for org2 to test isolation
  const tenant2 = getTenantPrisma(org2.id);
  await tenant2.auditLog.create({
    data: {
      organizationId: org2.id,
      actorId: owner2.id,
      action: "ORG_CREATED",
      resourceType: "Organization",
      resourceId: org2.id,
      metadata: { actorType: "USER", actorSnapshot: { email: owner2.email } },
    }
  });

  // 5. OWNER sees only their logs
  res = await app.inject({
    method: "GET",
    url: `/organizations/${org1.id}/audit-logs`,
    cookies: { session: owner1Token },
  });
  assert.strictEqual(res.statusCode, 200, "Expected 200 OK for OWNER");
  const payload = JSON.parse(res.payload);
  assert.strictEqual(payload.auditLogs.length, 2, "Expected 2 audit logs");
  
  // They should be sorted DESC by createdAt/id, so log2 comes first
  assert.strictEqual(payload.auditLogs[0].id, log2.id);
  assert.strictEqual(payload.auditLogs[1].id, log1.id);
  
  // Data integrity check
  assert.strictEqual(payload.auditLogs[1].metadata.actorSnapshot.email, owner1.email, "Actor snapshot should be preserved");

  // 6. Pagination check (limit=1)
  res = await app.inject({
    method: "GET",
    url: `/organizations/${org1.id}/audit-logs?limit=1`,
    cookies: { session: owner1Token },
  });
  assert.strictEqual(res.statusCode, 200);
  const page1 = JSON.parse(res.payload);
  assert.strictEqual(page1.auditLogs.length, 1);
  assert.strictEqual(page1.auditLogs[0].id, log2.id);
  assert.ok(page1.nextCursor, "Expected nextCursor");

  // Fetch next page
  res = await app.inject({
    method: "GET",
    url: `/organizations/${org1.id}/audit-logs?limit=1&cursor=${page1.nextCursor}`,
    cookies: { session: owner1Token },
  });
  assert.strictEqual(res.statusCode, 200);
  const page2 = JSON.parse(res.payload);
  assert.strictEqual(page2.auditLogs.length, 1);
  assert.strictEqual(page2.auditLogs[0].id, log1.id);
  assert.ok(!page2.nextCursor, "Expected nextCursor to be undefined/falsy");

  // Cleanup
  console.log("Cleaning up (using raw SQL to bypass trigger)...");
  await prisma.$executeRaw`ALTER TABLE "AuditLog" DISABLE TRIGGER trg_prevent_audit_log_mutation;`;
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: [org1.id, org2.id] } } });
  await prisma.$executeRaw`ALTER TABLE "AuditLog" ENABLE TRIGGER trg_prevent_audit_log_mutation;`;
  await prisma.organization.deleteMany({ where: { id: { in: [org1.id, org2.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner1.id, member1.id, owner2.id] } } });
  
  // Clean up sessions
  await prisma.session.deleteMany({ where: { userId: { in: [owner1.id, member1.id, owner2.id] } } });

  console.log("All API tests passed!");
  await app.close();
}

runTests().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
