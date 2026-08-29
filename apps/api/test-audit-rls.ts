import { prisma, getTenantPrisma } from "./src/db";

async function runTests() {
  console.log("Setting up test users and organizations...");
  
  const ts = Date.now();
  const user1 = await prisma.user.create({
    data: {
      email: `audit1-${ts}@example.com`,
      passwordHash: "hash",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: `audit2-${ts}@example.com`,
      passwordHash: "hash",
    },
  });

  const org1 = await prisma.organization.create({
    data: {
      name: "Org A",
      members: {
        create: { userId: user1.id, role: "OWNER" },
      },
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      name: "Org B",
      members: {
        create: { userId: user2.id, role: "OWNER" },
      },
    },
  });

  console.log("Testing Audit Log Creation & Immutability...");
  
  const tenant1 = getTenantPrisma(org1.id);

  // 1. Create a log
  const log = await tenant1.auditLog.create({
    data: {
      organizationId: org1.id,
      actorId: user1.id,
      action: "PROJECT_CREATED",
      resourceType: "Project",
      resourceId: "test-resource-1",
      metadata: { actorType: "USER", actorSnapshot: { email: user1.email } },
    },
  });
  console.log("Created log in Org A");

  // 2. Test Immutability
  try {
    await tenant1.auditLog.update({
      where: { id: log.id },
      data: { action: "PROJECT_DELETED" },
    });
    console.error("FAIL: Should not be able to update audit log");
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes("AuditLog records are immutable") || err.message.includes("permission denied")) {
      console.log("PASS: Update rejected by immutability constraint");
    } else {
      console.error("FAIL: Unexpected error on update", err);
      process.exit(1);
    }
  }

  try {
    await tenant1.auditLog.delete({
      where: { id: log.id },
    });
    console.error("FAIL: Should not be able to delete audit log");
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes("AuditLog records are immutable") || err.message.includes("permission denied")) {
      console.log("PASS: Delete rejected by immutability constraint");
    } else {
      console.error("FAIL: Unexpected error on delete", err);
      process.exit(1);
    }
  }

  // 3. Test RLS
  const tenant2 = getTenantPrisma(org2.id);
  const orgBLogs = await tenant2.auditLog.findMany();
  if (orgBLogs.length === 0) {
    console.log("PASS: Tenant B cannot see Tenant A's audit logs");
  } else {
    console.error("FAIL: RLS leakage detected");
    process.exit(1);
  }

  // Cleanup
  console.log("Cleaning up (using raw SQL to bypass trigger)...");
  await prisma.$executeRaw`ALTER TABLE "AuditLog" DISABLE TRIGGER trg_prevent_audit_log_mutation;`;
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: [org1.id, org2.id] } } });
  await prisma.$executeRaw`ALTER TABLE "AuditLog" ENABLE TRIGGER trg_prevent_audit_log_mutation;`;
  await prisma.organization.deleteMany({ where: { id: { in: [org1.id, org2.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });
  
  console.log("All tests passed!");
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
