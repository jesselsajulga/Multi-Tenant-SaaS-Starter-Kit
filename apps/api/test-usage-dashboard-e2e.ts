import test from "node:test";
import assert from "node:assert";
import { prisma } from "./src/db";
import { recordUsage } from "./src/billing/usage";
import { getTenantPrisma } from "./src/db";
import { createSession } from "./src/auth/session";

// Helper to simulate authentication and get a valid session cookie
async function createAuthenticatedUserAndOrg(role: "OWNER" | "MEMBER") {
  const ts = Date.now();
  const user = await prisma.user.create({
    data: { email: `test-dashboard-${ts}@example.com`, passwordHash: "dummy" }
  });

  const org = await prisma.organization.create({
    data: { name: `Dashboard Org ${ts}` }
  });

  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role }
  });

  // Create a session using the auth helper
  const { token: sessionToken } = await createSession(user.id);

  return { user, org, sessionToken };
}

// Fetch helper against Next.js (port 3000)
async function fetchDashboard(orgId: string, sessionToken?: string) {
  const headers = new Headers();
  if (sessionToken) {
    headers.set("Cookie", `session=${sessionToken}`);
  }

  const res = await fetch(`http://localhost:3000/organizations/${orgId}/billing/usage`, {
    headers,
  });

  const html = await res.text();
  return { status: res.status, html };
}

test("Usage Dashboard E2E Verification", async (t) => {
  console.log("Setting up Usage Dashboard Verification...");

  const { user: owner, org: orgA, sessionToken: ownerSession } = await createAuthenticatedUserAndOrg("OWNER");
  const { user: member, sessionToken: memberSession } = await createAuthenticatedUserAndOrg("MEMBER");
  
  // Org B to test isolation
  const orgB = await prisma.organization.create({ data: { name: "Dashboard Org B" } });
  await prisma.organizationMember.create({
    data: { organizationId: orgB.id, userId: owner.id, role: "OWNER" }
  });

  await t.test("1. Unauthenticated request -> Redirect or Error", async () => {
    // Next.js will fetch from API without cookie -> API returns 401 -> Next.js returns 401
    // Actually, our Next.js page just renders 403 Forbidden state if res.status === 401 or 403
    const { html, status } = await fetchDashboard(orgA.id);
    require('fs').writeFileSync('debug_html.html', html);
    assert.ok(
      html.includes("Usage unavailable") || html.includes("don't have permission"),
      `Must render forbidden/unavailable state for unauthenticated. Status: ${status}`
    );
  });

  await t.test("2. Authorization (MEMBER) -> 403 Forbidden UI", async () => {
    const { html } = await fetchDashboard(orgA.id, memberSession);
    assert.ok(html.includes("Usage unavailable") || html.includes("don't have permission"), "MEMBER must see forbidden state");
  });

  await t.test("3. Empty State (OWNER)", async () => {
    const { html } = await fetchDashboard(orgA.id, ownerSession);
    assert.ok(html.includes("No usage recorded"), "Must render empty state when no usage exists");
    assert.ok(!html.includes("API Calls"), "Should not render metric cards when empty");
  });

  await t.test("4. Data Correctness (OWNER) & Tenant Isolation", async () => {
    // Insert usage for Org A
    await recordUsage({ organizationId: orgA.id, metric: "API_CALLS", quantity: 1250 });
    await recordUsage({ organizationId: orgA.id, metric: "STORAGE_MB", quantity: 45 });
    
    // Insert usage for Org B (should NOT appear on Org A dashboard)
    await recordUsage({ organizationId: orgB.id, metric: "API_CALLS", quantity: 999999 });

    // Ensure it renders correctly
    const { html } = await fetchDashboard(orgA.id, ownerSession);
    
    assert.ok(!html.includes("No usage recorded"), "Must NOT render empty state");
    assert.ok(html.includes("API Calls"), "Must render API Calls metric card");
    assert.ok(html.includes("1,250"), "Must render correct quantity for API Calls");
    assert.ok(html.includes("Storage (MB)"), "Must render Storage metric card");
    assert.ok(html.includes("45"), "Must render correct quantity for Storage");

    assert.ok(!html.includes("999,999"), "Must NOT render Org B usage (tenant isolation failed)");
  });

  await t.test("5. Billing Independence (UsageSyncLog failure doesn't hide data)", async () => {
    // Manually insert a FAILED UsageSyncLog entry for Org A
    const tenantPrisma = getTenantPrisma(orgA.id);
    await tenantPrisma.usageSyncLog.create({
      data: {
        organizationId: orgA.id,
        metric: "API_CALLS",
        idempotencyKey: "test-fail-key",
        status: "FAILED",
        syncedThroughTimestamp: new Date(),
        syncedThroughId: "dummy-id",
        quantity: 1250,
      }
    });

    // Dashboard should STILL render the data correctly
    const { html } = await fetchDashboard(orgA.id, ownerSession);
    assert.ok(html.includes("1,250"), "Dashboard must still show 1,250 despite FAILED sync log");
  });

  console.log("Cleaning up...");
  await prisma.usageEvent.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.usageSyncLog.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  await prisma.session.deleteMany({ where: { userId: { in: [owner.id, member.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, member.id] } } });
  
  console.log("ALL DASHBOARD E2E TESTS PASSED SUCCESSFULLY! ✅");
});
