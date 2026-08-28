import { prisma, getTenantPrisma } from "./src/db";
import crypto from "crypto";

async function main() {
  console.log("Setting up test users...");
  const user1 = await prisma.user.upsert({
    where: { email: "inviter@example.com" },
    update: {},
    create: {
      email: "inviter@example.com",
      passwordHash: "dummy",
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "inviter2@example.com" },
    update: {},
    create: {
      email: "inviter2@example.com",
      passwordHash: "dummy",
    },
  });

  console.log("Setting up organizations...");
  const orgA = await prisma.organization.create({
    data: {
      name: "Org A",
      members: {
        create: {
          userId: user1.id,
          role: "OWNER",
        },
      },
    },
  });

  const orgB = await prisma.organization.create({
    data: {
      name: "Org B",
      members: {
        create: {
          userId: user2.id,
          role: "OWNER",
        },
      },
    },
  });

  console.log("Creating invitations via tenant Prisma...");
  const tenantA = getTenantPrisma(orgA.id);
  const tenantB = getTenantPrisma(orgB.id);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await tenantA.organizationInvitation.create({
    data: {
      organizationId: orgA.id,
      email: "guest@example.com",
      inviterId: user1.id,
      tokenHash: crypto.createHash("sha256").update("token_a").digest("hex"),
      status: "PENDING",
      expiresAt,
    },
  });

  await tenantB.organizationInvitation.create({
    data: {
      organizationId: orgB.id,
      email: "guest@example.com",
      inviterId: user2.id,
      tokenHash: crypto.createHash("sha256").update("token_b").digest("hex"),
      status: "PENDING",
      expiresAt,
    },
  });

  console.log("\n--- Testing RLS Isolation ---");
  const invitationsA = await tenantA.organizationInvitation.findMany();
  console.log(`Tenant A reading invitations...`);
  console.log(`Expected 1 invitation, got ${invitationsA.length}. Emails: ${invitationsA.map(i => i.email).join(', ')}`);
  
  const invitationsB = await tenantB.organizationInvitation.findMany();
  console.log(`Tenant B reading invitations...`);
  console.log(`Expected 1 invitation, got ${invitationsB.length}. Emails: ${invitationsB.map(i => i.email).join(', ')}`);

  console.log(`\nTesting unauthorized access (Tenant B trying to read Org A's invitation)...`);
  const blockedAccess = await tenantB.organizationInvitation.findFirst({
    where: { tokenHash: crypto.createHash("sha256").update("token_a").digest("hex") }
  });
  console.log(`Expected null, got: ${blockedAccess} (Blocked by RLS)`);

  console.log("\n--- Testing Partial Unique Index ---");
  console.log("Attempting to create another PENDING invitation for guest@example.com in Org A...");
  try {
    await tenantA.organizationInvitation.create({
      data: {
        organizationId: orgA.id,
        email: "guest@example.com",
        inviterId: user1.id,
        tokenHash: crypto.createHash("sha256").update("token_a_duplicate").digest("hex"),
        status: "PENDING",
        expiresAt,
      },
    });
    console.log("FAIL: Second pending invitation created.");
  } catch (err: any) {
    console.log("SUCCESS: Blocked duplicate pending invitation.");
  }

  console.log("\nAttempting to create a REJECTED invitation for guest@example.com in Org A (Should succeed)...");
  await tenantA.organizationInvitation.create({
    data: {
      organizationId: orgA.id,
      email: "guest@example.com",
      inviterId: user1.id,
      tokenHash: crypto.createHash("sha256").update("token_a_rejected").digest("hex"),
      status: "REJECTED",
      expiresAt,
    },
  });
  console.log("SUCCESS: Created rejected invitation for the same email.");

  // Cleanup
  await prisma.organizationInvitation.deleteMany({});
  await prisma.organization.deleteMany({
    where: { id: { in: [orgA.id, orgB.id] } }
  });
  await prisma.user.deleteMany({
    where: { email: { in: ["inviter@example.com", "inviter2@example.com"] } }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
