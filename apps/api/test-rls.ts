import { getTenantPrisma, prisma } from "./src/db";
import { hashPassword } from "./src/auth/password";

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN 
        CREATE ROLE app_user; 
      END IF; 
    END $$;
  `);
  await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;`);
  await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;`);

  console.log("Setting up test users...");
  
  const userA = await prisma.user.create({
    data: {
      email: "usera@example.com",
      passwordHash: await hashPassword("password123"),
    }
  });

  const userB = await prisma.user.create({
    data: {
      email: "userb@example.com",
      passwordHash: await hashPassword("password123"),
    }
  });

  console.log("Setting up organizations...");
  const orgA = await prisma.organization.create({
    data: {
      name: "Org A",
      members: { create: { userId: userA.id, role: "OWNER" } }
    }
  });

  const orgB = await prisma.organization.create({
    data: {
      name: "Org B",
      members: { create: { userId: userB.id, role: "OWNER" } }
    }
  });

  console.log("Creating projects via tenant Prisma...");
  const tenantA = getTenantPrisma(orgA.id);
  const tenantB = getTenantPrisma(orgB.id);

  const proj1 = await tenantA.project.create({
    data: { name: "Project 1 (Org A)", organizationId: orgA.id }
  });

  const proj2 = await tenantB.project.create({
    data: { name: "Project 2 (Org B)", organizationId: orgB.id }
  });

  console.log("\n--- Testing RLS Isolation ---");
  
  console.log("Tenant A reading projects...");
  const projectsA = await tenantA.project.findMany();
  console.log(`Expected 1 project, got ${projectsA.length}. Names: ${projectsA.map(p => p.name).join(", ")}`);

  console.log("Tenant B reading projects...");
  const projectsB = await tenantB.project.findMany();
  console.log(`Expected 1 project, got ${projectsB.length}. Names: ${projectsB.map(p => p.name).join(", ")}`);

  console.log("\nTesting unauthorized access (Tenant B trying to read Proj 1)...");
  const unauthorizedRead = await tenantB.project.findUnique({ where: { id: proj1.id }});
  console.log(`Expected null, got: ${unauthorizedRead ? "FOUND!" : "null (Blocked by RLS)"}`);

  await prisma.user.deleteMany();
}

main().catch(console.error).finally(() => prisma.$disconnect());
