import "dotenv/config";
import { prisma } from "../src/db";
import { createHash } from "node:crypto";
import { hashPassword } from "../src/auth/password";

async function main() {
  console.log("Seeding test accounts...");

  // Create owner
  const ownerEmail = "owner@example.com";
  const ownerPassword = "password123";
  const ownerPasswordHash = await hashPassword(ownerPassword);

  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: ownerPasswordHash,
      },
    });
    console.log(`Created owner user: ${ownerEmail}`);
  } else {
    console.log(`Owner user already exists: ${ownerEmail}`);
  }

  // Create member
  const memberEmail = "member@example.com";
  const memberPassword = "password123";
  const memberPasswordHash = await hashPassword(memberPassword);

  let member = await prisma.user.findUnique({ where: { email: memberEmail } });
  if (!member) {
    member = await prisma.user.create({
      data: {
        email: memberEmail,
        passwordHash: memberPasswordHash,
      },
    });
    console.log(`Created member user: ${memberEmail}`);
  } else {
    console.log(`Member user already exists: ${memberEmail}`);
  }

  // Create test organization
  const orgName = "Acme Test Corp";
  let org = await prisma.organization.findFirst({
    where: { name: orgName },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: orgName,
      },
    });
    console.log(`Created organization: ${orgName}`);
  } else {
    console.log(`Organization already exists: ${orgName}`);
  }

  // Assign memberships
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: owner.id,
      },
    },
    update: {
      role: "OWNER",
    },
    create: {
      organizationId: org.id,
      userId: owner.id,
      role: "OWNER",
    },
  });
  console.log(`Assigned ${ownerEmail} as OWNER of ${orgName}`);

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: member.id,
      },
    },
    update: {
      role: "MEMBER",
    },
    create: {
      organizationId: org.id,
      userId: member.id,
      role: "MEMBER",
    },
  });
  console.log(`Assigned ${memberEmail} as MEMBER of ${orgName}`);

  console.log("\nSeeding complete! You can now log in with:");
  console.log(`Owner: ${ownerEmail} / ${ownerPassword}`);
  console.log(`Member: ${memberEmail} / ${memberPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
