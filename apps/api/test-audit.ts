import { prisma } from "./src/db";

const API_URL = "http://localhost:4000";

async function runTests() {
  console.log("Starting Phase 7 Audit Verification...");

  // 1. Setup Data
  const ownerEmail = `audit_owner_${Date.now()}@example.com`;
  const memberEmail = `audit_member_${Date.now()}@example.com`;
  const otherEmail = `audit_other_${Date.now()}@example.com`;

  // Register Users
  for (const email of [ownerEmail, memberEmail, otherEmail]) {
    await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
  }

  const [owner, member, other] = await Promise.all([
    prisma.user.findUnique({ where: { email: ownerEmail } }),
    prisma.user.findUnique({ where: { email: memberEmail } }),
    prisma.user.findUnique({ where: { email: otherEmail } }),
  ]);
  if (!owner || !member || !other) throw new Error("Users not created");

  // Create Organizations
  const orgA = await prisma.organization.create({
    data: { name: "Audit Org A" }
  });
  const orgB = await prisma.organization.create({
    data: { name: "Audit Org B" }
  });

  // Assign Memberships
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: orgA.id, userId: owner.id, role: "OWNER" },
      { organizationId: orgA.id, userId: member.id, role: "MEMBER" },
      { organizationId: orgB.id, userId: other.id, role: "OWNER" },
    ]
  });

  // Helper to login and get cookie
  async function login(email: string): Promise<string> {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" })
    });
    const cookie = res.headers.get("set-cookie");
    if (!cookie) throw new Error(`Login failed for ${email}`);
    return cookie;
  }

  const ownerCookie = await login(ownerEmail);
  const memberCookie = await login(memberEmail);
  const otherCookie = await login(otherEmail);

  // Trigger an Audit Event (Create Project)
  const projRes = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": ownerCookie, "x-organization-id": orgA.id },
    body: JSON.stringify({ name: "Audit Test Project" })
  });
  if (projRes.status !== 201) throw new Error(`Project creation failed: ${await projRes.text()}`);

  // Security Test 1: OWNER can access
  console.log("Test 1: OWNER access");
  const resOwner = await fetch(`${API_URL}/organizations/${orgA.id}/audit-logs`, {
    headers: { "Cookie": ownerCookie, "x-organization-id": orgA.id }
  });
  if (resOwner.status !== 200) throw new Error(`OWNER should get 200, got ${resOwner.status}`);
  const dataOwner = await resOwner.json();
  if (dataOwner.auditLogs.length === 0) throw new Error("No audit logs found for OWNER");
  
  const projectLog = dataOwner.auditLogs.find((l: any) => l.action === "PROJECT_CREATED");
  if (!projectLog) throw new Error("PROJECT_CREATED event missing");
  console.log("  ✅ OWNER access OK. Event recorded:", projectLog.action);

  // Security Test 2: MEMBER access rejected
  console.log("Test 2: MEMBER access");
  const resMember = await fetch(`${API_URL}/organizations/${orgA.id}/audit-logs`, {
    headers: { "Cookie": memberCookie, "x-organization-id": orgA.id }
  });
  if (resMember.status !== 403) throw new Error(`MEMBER should get 403, got ${resMember.status}`);
  console.log("  ✅ MEMBER access correctly rejected (403)");

  // Security Test 3: Cross-org access rejected
  console.log("Test 3: Cross-organization access");
  const resOther = await fetch(`${API_URL}/organizations/${orgA.id}/audit-logs`, {
    headers: { "Cookie": otherCookie, "x-organization-id": orgA.id }
  });
  if (resOther.status !== 403) throw new Error(`Cross-org should get 403, got ${resOther.status}`);
  console.log("  ✅ Cross-organization access correctly rejected (403)");

  console.log("All security verifications passed!");
}

runTests().catch(e => {
  console.error("Test failed!", e);
  process.exit(1);
});
