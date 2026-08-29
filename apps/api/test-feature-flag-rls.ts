import { prisma } from "./src/db";
import { getTenantPrisma } from "./src/db";
import assert from "assert";

async function runTests() {
  console.log("Setting up Feature Flag RLS test...");
  const ts = Date.now();

  const org1 = await prisma.organization.create({
    data: { name: `Org1-${ts}` },
  });

  const org2 = await prisma.organization.create({
    data: { name: `Org2-${ts}` },
  });

  const tenant1 = getTenantPrisma(org1.id);
  const tenant2 = getTenantPrisma(org2.id);

  console.log("Testing FeatureFlag RLS Isolation...");

  // 1. Create flags for Org 1 and Org 2 via app_user (tenantPrisma)
  const flag1 = await tenant1.featureFlag.create({
    data: {
      organizationId: org1.id,
      key: "beta-ui",
      enabled: true,
    }
  });

  const flag2 = await tenant2.featureFlag.create({
    data: {
      organizationId: org2.id,
      key: "beta-ui",
      enabled: false,
    }
  });

  // 2. tenant1 should only see flag1
  const tenant1Flags = await tenant1.featureFlag.findMany();
  assert.strictEqual(tenant1Flags.length, 1, "Tenant 1 should only see 1 flag");
  assert.strictEqual(tenant1Flags[0].id, flag1.id, "Tenant 1 should see flag1");

  // 3. tenant2 should only see flag2
  const tenant2Flags = await tenant2.featureFlag.findMany();
  assert.strictEqual(tenant2Flags.length, 1, "Tenant 2 should only see 1 flag");
  assert.strictEqual(tenant2Flags[0].id, flag2.id, "Tenant 2 should see flag2");

  // 4. Updating another tenant's flag should fail
  try {
    await tenant1.featureFlag.update({
      where: { id: flag2.id },
      data: { enabled: true }
    });
    assert.fail("Tenant 1 should not be able to update Tenant 2's flag");
  } catch (error: any) {
    assert.strictEqual(error.code, "P2025", "Should be record not found (hidden by RLS)");
  }

  // 5. Unique constraint check
  try {
    await tenant1.featureFlag.create({
      data: {
        organizationId: org1.id,
        key: "beta-ui",
        enabled: true,
      }
    });
    assert.fail("Should not be able to create duplicate flag key for same org");
  } catch (error: any) {
    assert.strictEqual(error.code, "P2002", "Should throw unique constraint violation");
  }

  // 6. Delete Cascade check
  console.log("Testing Delete Cascade...");
  await prisma.organization.delete({
    where: { id: org1.id }
  });

  // Verify flag1 is gone via superuser client
  const flag1After = await prisma.featureFlag.findUnique({ where: { id: flag1.id } });
  assert.strictEqual(flag1After, null, "Flag 1 should be deleted when Org 1 is deleted");

  // Cleanup
  await prisma.organization.delete({
    where: { id: org2.id }
  });

  console.log("All Feature Flag RLS tests passed!");
}

runTests().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
