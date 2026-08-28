import { prisma } from "./src/db";
import Fastify from "fastify";
import { buildApp } from "./src/app";

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
    data: {
      email: "owner@example.com",
      passwordHash: "dummy",
    },
  });

  const member = await prisma.user.create({
    data: {
      email: "member@example.com",
      passwordHash: "dummy",
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Test Org",
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: member.id, role: "MEMBER" },
        ],
      },
    },
  });

  const crypto = require("crypto");
  const ownerPlain = "owner_token_plain";
  const memberPlain = "member_token_plain";

  const ownerSession = await prisma.session.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(ownerPlain).digest("hex"),
      userId: owner.id,
      expiresAt: new Date(Date.now() + 1000000),
    },
  });

  const memberSession = await prisma.session.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(memberPlain).digest("hex"),
      userId: member.id,
      expiresAt: new Date(Date.now() + 1000000),
    },
  });

  console.log("\n--- Testing POST /organizations/:organizationId/invitations ---");

  console.log("1. MEMBER trying to invite (Should fail with 403)...");
  let res = await app.inject({
    method: "POST",
    url: `/organizations/${org.id}/invitations`,
    cookies: {
      session: memberPlain,
    },
    payload: {
      email: "newguy@example.com",
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n2. OWNER trying to invite a new user (Should succeed with 201)...");
  res = await app.inject({
    method: "POST",
    url: `/organizations/${org.id}/invitations`,
    cookies: {
      session: ownerPlain,
    },
    payload: {
      email: "newguy@example.com",
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n3. OWNER trying to invite the same user again (Should fail with 409 PENDING duplicate)...");
  res = await app.inject({
    method: "POST",
    url: `/organizations/${org.id}/invitations`,
    cookies: {
      session: ownerPlain,
    },
    payload: {
      email: "newguy@example.com",
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n4. OWNER trying to invite an existing member (Should fail with 409)...");
  res = await app.inject({
    method: "POST",
    url: `/organizations/${org.id}/invitations`,
    cookies: {
      session: ownerPlain,
    },
    payload: {
      email: "member@example.com",
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n5. OWNER sending invalid email (Should fail with 400)...");
  res = await app.inject({
    method: "POST",
    url: `/organizations/${org.id}/invitations`,
    cookies: {
      session: ownerPlain,
    },
    payload: {
      email: "not-an-email",
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n--- Testing GET /organizations/:organizationId/invitations ---");
  
  console.log("6. MEMBER listing invitations (Should succeed with 200)...");
  res = await app.inject({
    method: "GET",
    url: `/organizations/${org.id}/invitations`,
    cookies: {
      session: memberPlain,
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  let inviteId = "";
  if (res.statusCode === 200) {
    const data = JSON.parse(res.payload);
    if (data.invitations && data.invitations.length > 0) {
      inviteId = data.invitations[0].id;
    }
  }

  console.log("\n--- Testing DELETE /organizations/:organizationId/invitations/:id ---");

  console.log("7. MEMBER trying to revoke invitation (Should fail with 403)...");
  res = await app.inject({
    method: "DELETE",
    url: `/organizations/${org.id}/invitations/${inviteId}`,
    cookies: {
      session: memberPlain,
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n8. OWNER trying to revoke invitation (Should succeed with 200)...");
  res = await app.inject({
    method: "DELETE",
    url: `/organizations/${org.id}/invitations/${inviteId}`,
    cookies: {
      session: ownerPlain,
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n9. OWNER trying to revoke an already CANCELED invitation (Should fail with 409)...");
  res = await app.inject({
    method: "DELETE",
    url: `/organizations/${org.id}/invitations/${inviteId}`,
    cookies: {
      session: ownerPlain,
    },
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n10. Unauthenticated trying to list (Should fail with 401)...");
  res = await app.inject({
    method: "GET",
    url: `/organizations/${org.id}/invitations`,
  });
  console.log(`Status: ${res.statusCode}, Body: ${res.payload}`);

  console.log("\n--- Checking database state ---");
  const invites = await prisma.organizationInvitation.findMany();
  console.log(`Total invites in DB: ${invites.length}`);
  if (invites.length > 0) {
    console.log(`Invite email: ${invites[0].email}, role: ${invites[0].role}, status: ${invites[0].status}`);
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
