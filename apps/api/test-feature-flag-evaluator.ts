import { prisma } from "./src/db";
import { getTenantPrisma } from "./src/db";
import { isFeatureEnabled } from "./src/feature-flags/evaluator";
import assert from "assert";

async function runTests() {
  console.log("Setting up Feature Flag Evaluator test...");
  const ts = Date.now();

  const orgA = await prisma.organization.create({
    data: { name: `OrgA-${ts}` },
  });

  const orgB = await prisma.organization.create({
    data: { name: `OrgB-${ts}` },
  });

  const tenantA = getTenantPrisma(orgA.id);
  const tenantB = getTenantPrisma(orgB.id);

  console.log("Seeding test data...");

  // Org A has beta-feature enabled
  await tenantA.featureFlag.create({
    data: {
      organizationId: orgA.id,
      key: "beta-feature",
      enabled: true,
    }
  });

  // Org B has beta-feature explicitly disabled
  await tenantB.featureFlag.create({
    data: {
      organizationId: orgB.id,
      key: "beta-feature",
      enabled: false,
    }
  });

  console.log("Testing Evaluation Semantics...");

  // 1. Enabled flag -> true
  const resultA = await isFeatureEnabled(orgA.id, "beta-feature");
  assert.strictEqual(resultA, true, "Org A's enabled flag should return true");

  // 2. Disabled flag -> false
  const resultB = await isFeatureEnabled(orgB.id, "beta-feature");
  assert.strictEqual(resultB, false, "Org B's disabled flag should return false");

  // 3. Missing flag -> false (fail-closed)
  const resultC = await isFeatureEnabled(orgA.id, "unknown-feature");
  assert.strictEqual(resultC, false, "Unknown flag should fail-closed to false");

  // 4. Cross-tenant isolation verification
  // Org B trying to check "beta-feature" should NOT see Org A's enabled flag.
  // It already evaluates to false correctly above, but let's test a flag that exists *only* in Org A.
  
  await tenantA.featureFlag.create({
    data: {
      organizationId: orgA.id,
      key: "org-a-only-feature",
      enabled: true,
    }
  });

  const resultD = await isFeatureEnabled(orgB.id, "org-a-only-feature");
  assert.strictEqual(resultD, false, "Org B should not see Org A's flag (should fail-closed)");

  // Cleanup
  console.log("Cleaning up...");
  await prisma.organization.delete({ where: { id: orgA.id } });
  await prisma.organization.delete({ where: { id: orgB.id } });

  console.log("All Feature Flag Evaluator tests passed!");
}

runTests().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
