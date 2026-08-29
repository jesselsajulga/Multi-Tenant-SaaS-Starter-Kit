import { prisma } from "./src/db";
import Fastify from "fastify";
import { buildApp } from "./src/app";
import crypto from "crypto";

async function main() {
  const app = buildApp();
  await app.ready();

  console.log("Setting up test users and organization...");
  await prisma.organizationInvitation.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const owner = await prisma.user.create({
    data: { email: "owner@example.com", passwordHash: "dummy" },
  });

  const validTarget = await prisma.user.create({
    data: { email: "target@example.com", passwordHash: "dummy" },
  });

  const wrongTarget = await prisma.user.create({
    data: { email: "wrong@example.com", passwordHash: "dummy" },
  });

  const memberTarget = await prisma.user.create({
    data: { email: "member@example.com", passwordHash: "dummy" },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Test Org",
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: memberTarget.id, role: "MEMBER" },
        ],
      },
    },
  });

  const targetSessionPlain = "target_token";
  const wrongSessionPlain = "wrong_token";
  const memberSessionPlain = "member_token";

  await prisma.session.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(targetSessionPlain).digest("hex"),
      userId: validTarget.id,
      expiresAt: new Date(Date.now() + 1000000),
    },
  });

  await prisma.session.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(wrongSessionPlain).digest("hex"),
      userId: wrongTarget.id,
      expiresAt: new Date(Date.now() + 1000000),
    },
  });

  await prisma.session.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(memberSessionPlain).digest("hex"),
      userId: memberTarget.id,
      expiresAt: new Date(Date.now() + 1000000),
    },
  });

  // Helper to create invites
  async function createInvite(email: string, status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED" = "PENDING", expired = false) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date();
    if (expired) {
      expiresAt.setDate(expiresAt.getDate() - 1);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7);
    }
    
    await prisma.organizationInvitation.create({
      data: {
        organizationId: org.id,
        email,
        inviterId: owner.id,
        tokenHash,
        role: "MEMBER",
        status,
        expiresAt,
      }
    });
    return rawToken;
  }

  const validToken = await createInvite("target@example.com");

  console.log("\n--- Testing POST /invitations/accept ---");
  
  console.log("1. Unauthenticated accept (Should fail with 401)...");
  let res = await app.inject({
    method: "POST",
    url: "/invitations/accept",
    payload: { token: validToken },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n2. Invalid token (Should fail with 404)...");
  res = await app.inject({
    method: "POST",
    url: "/invitations/accept",
    cookies: { session: targetSessionPlain },
    payload: { token: "invalid_token_123" },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n3. Wrong user's email (Should fail with 403)...");
  res = await app.inject({
    method: "POST",
    url: "/invitations/accept",
    cookies: { session: wrongSessionPlain },
    payload: { token: validToken },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  // Need an expired token
  const expiredToken = await createInvite("wrong@example.com", "PENDING", true);
  console.log("\n4. Expired invitation (Should fail with 409)...");
  res = await app.inject({
    method: "POST",
    url: "/invitations/accept",
    cookies: { session: wrongSessionPlain },
    payload: { token: expiredToken },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  // Test rollback by causing the transaction to fail. Wait, the only way transaction fails is if OrganizationMember creation fails (e.g., unique constraint on orgId+userId). We check that beforehand, so it shouldn't fail unless there's a race condition or constraint violation. We can test "already a member" first.
  const memberInviteToken = await createInvite("member@example.com");
  console.log("\n5. Already a member (Should fail with 409)...");
  res = await app.inject({
    method: "POST",
    url: "/invitations/accept",
    cookies: { session: memberSessionPlain },
    payload: { token: memberInviteToken },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n6. Valid token + matching user (Should succeed with 200)...");
  res = await app.inject({
    method: "POST",
    url: "/invitations/accept",
    cookies: { session: targetSessionPlain },
    payload: { token: validToken },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n7. Already accepted invitation (Should fail with 409)...");
  res = await app.inject({
    method: "POST",
    url: "/invitations/accept",
    cookies: { session: targetSessionPlain },
    payload: { token: validToken },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  // Test Reject
  const rejectUser = await prisma.user.create({
    data: { email: "rejector@example.com", passwordHash: "dummy" },
  });
  const rejectSessionPlain = "reject_token";
  await prisma.session.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(rejectSessionPlain).digest("hex"),
      userId: rejectUser.id,
      expiresAt: new Date(Date.now() + 1000000),
    },
  });
  const tokenToReject = await createInvite("rejector@example.com");

  console.log("\n8. Valid rejection (Should succeed with 200)...");
  res = await app.inject({
    method: "POST",
    url: "/invitations/reject",
    cookies: { session: rejectSessionPlain },
    payload: { token: tokenToReject },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n9. Rejected invitation cannot subsequently be accepted (Should fail with 409)...");
  res = await app.inject({
    method: "POST",
    url: "/invitations/accept",
    cookies: { session: rejectSessionPlain },
    payload: { token: tokenToReject },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n--- Checking database state ---");
  const members = await prisma.organizationMember.findMany();
  console.log(`Total members in DB: ${members.length} (Expected 3: OWNER, MEMBER, target@example.com)`);
  
  const invites = await prisma.organizationInvitation.findMany({ orderBy: { email: 'asc' } });
  for (const inv of invites) {
    console.log(`Invite email: ${inv.email}, status: ${inv.status}`);
  }

  // Cleanup
  await prisma.organizationInvitation.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await app.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
