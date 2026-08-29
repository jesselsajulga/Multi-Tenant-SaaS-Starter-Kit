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

  console.log("Setting up Feature Flag API test data...");
  const ts = Date.now();

  const userA = await prisma.user.create({
    data: { email: `ownerA-${ts}@example.com`, passwordHash: "hash" },
  });
  const userA_Member = await prisma.user.create({
    data: { email: `memberA-${ts}@example.com`, passwordHash: "hash" },
  });
  const userB = await prisma.user.create({
    data: { email: `ownerB-${ts}@example.com`, passwordHash: "hash" },
  });

  const orgA = await prisma.organization.create({
    data: {
      name: `OrgA-${ts}`,
      members: {
        create: [
          { userId: userA.id, role: "OWNER" },
          { userId: userA_Member.id, role: "MEMBER" },
        ],
      },
    },
  });

  const orgB = await prisma.organization.create({
    data: {
      name: `OrgB-${ts}`,
      members: {
        create: [{ userId: userB.id, role: "OWNER" }],
      },
    },
  });

  const ownerAToken = `raw-ownerA-${ts}`;
  const memberAToken = `raw-memberA-${ts}`;
  const ownerBToken = `raw-ownerB-${ts}`;

  await prisma.session.create({
    data: { userId: userA.id, tokenHash: hashToken(ownerAToken), expiresAt: new Date(Date.now() + 100000) }
  });
  await prisma.session.create({
    data: { userId: userA_Member.id, tokenHash: hashToken(memberAToken), expiresAt: new Date(Date.now() + 100000) }
  });
  await prisma.session.create({
    data: { userId: userB.id, tokenHash: hashToken(ownerBToken), expiresAt: new Date(Date.now() + 100000) }
  });
  
  const headersOwnerA = { cookie: `session=${ownerAToken}` };
  const headersMemberA = { cookie: `session=${memberAToken}` };
  const headersOwnerB = { cookie: `session=${ownerBToken}` };

  console.log("Testing API Access Matrix...");

  // 1. Unauthenticated -> 401
  let res = await app.inject({
    method: "GET",
    url: `/organizations/${orgA.id}/feature-flags`,
  });
  assert.strictEqual(res.statusCode, 401, "Unauthenticated GET should be 401");

  res = await app.inject({
    method: "POST",
    url: `/organizations/${orgA.id}/feature-flags`,
    payload: { key: "test-feature", enabled: true }
  });
  assert.strictEqual(res.statusCode, 401, "Unauthenticated POST should be 401");

  // 2. MEMBER -> 403
  res = await app.inject({
    method: "POST",
    url: `/organizations/${orgA.id}/feature-flags`,
    headers: headersMemberA,
    payload: { key: "test-feature", enabled: true }
  });
  assert.strictEqual(res.statusCode, 403, "MEMBER POST should be 403");

  res = await app.inject({
    method: "GET",
    url: `/organizations/${orgA.id}/feature-flags`,
    headers: headersMemberA,
  });
  assert.strictEqual(res.statusCode, 403, "MEMBER GET should be 403");

  // 3. OWNER -> Create (201)
  res = await app.inject({
    method: "POST",
    url: `/organizations/${orgA.id}/feature-flags`,
    headers: headersOwnerA,
    payload: { key: "test-feature", enabled: true }
  });
  assert.strictEqual(res.statusCode, 201, "OWNER POST should be 201");
  const flagA = res.json();
  assert.strictEqual(flagA.key, "test-feature");
  assert.strictEqual(flagA.enabled, true);

  // 4. Duplicate Key -> 409
  res = await app.inject({
    method: "POST",
    url: `/organizations/${orgA.id}/feature-flags`,
    headers: headersOwnerA,
    payload: { key: "test-feature", enabled: false }
  });
  assert.strictEqual(res.statusCode, 409, "OWNER POST duplicate key should be 409");

  // 5. OWNER -> List (200)
  res = await app.inject({
    method: "GET",
    url: `/organizations/${orgA.id}/feature-flags`,
    headers: headersOwnerA,
  });
  assert.strictEqual(res.statusCode, 200, "OWNER GET should be 200");
  assert.strictEqual(res.json().length, 1);

  // 6. Non-member (Owner B) -> Org A's flags (403)
  res = await app.inject({
    method: "GET",
    url: `/organizations/${orgA.id}/feature-flags`,
    headers: headersOwnerB,
  });
  assert.strictEqual(res.statusCode, 403, "Non-member GET should be 403");

  // 7. Org A OWNER -> Org B's flag manually (404/Inaccessible via RLS/Auth)
  // Let's create a flag in Org B first
  res = await app.inject({
    method: "POST",
    url: `/organizations/${orgB.id}/feature-flags`,
    headers: headersOwnerB,
    payload: { key: "test-feature-b", enabled: true }
  });
  assert.strictEqual(res.statusCode, 201);
  const flagB = res.json();

  // Org A OWNER trying to update Org B's flag
  // Auth prevents touching Org B via the URL params anyway:
  res = await app.inject({
    method: "PUT",
    url: `/organizations/${orgB.id}/feature-flags/${flagB.id}`,
    headers: headersOwnerA,
    payload: { enabled: false }
  });
  assert.strictEqual(res.statusCode, 403, "Org A OWNER trying to access Org B URL should be 403");

  // Even if they tried to spoof the URL using their own OrgId but targeting Org B's flagId:
  res = await app.inject({
    method: "PUT",
    url: `/organizations/${orgA.id}/feature-flags/${flagB.id}`,
    headers: headersOwnerA,
    payload: { enabled: false }
  });
  // RLS or P2025 will block it since Org B's flag isn't in Org A's tenant space
  assert.strictEqual(res.statusCode, 404, "Spoofed Flag ID should be 404 due to RLS/Isolation");

  // 8. OWNER -> Update (200)
  res = await app.inject({
    method: "PUT",
    url: `/organizations/${orgA.id}/feature-flags/${flagA.id}`,
    headers: headersOwnerA,
    payload: { enabled: false }
  });
  assert.strictEqual(res.statusCode, 200, "OWNER PUT should be 200");
  assert.strictEqual(res.json().enabled, false);

  // 9. OWNER -> Delete (200)
  res = await app.inject({
    method: "DELETE",
    url: `/organizations/${orgA.id}/feature-flags/${flagA.id}`,
    headers: headersOwnerA,
  });
  assert.strictEqual(res.statusCode, 200, "OWNER DELETE should be 200");

  // Verify deletion
  res = await app.inject({
    method: "GET",
    url: `/organizations/${orgA.id}/feature-flags`,
    headers: headersOwnerA,
  });
  assert.strictEqual(res.json().length, 0, "Flags should be empty after deletion");

  console.log("Cleaning up...");
  await prisma.$executeRaw`DELETE FROM "Organization" WHERE id = ${orgA.id}`;
  await prisma.$executeRaw`DELETE FROM "Organization" WHERE id = ${orgB.id}`;
  await prisma.$executeRaw`DELETE FROM "User" WHERE id IN (${userA.id}, ${userA_Member.id}, ${userB.id})`;
  await prisma.session.deleteMany({ where: { userId: { in: [userA.id, userA_Member.id, userB.id] } } });

  console.log("All API tests passed!");
  await app.close();
}

runTests().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
