import { hashPassword } from "./src/auth/password";
import { createSession } from "./src/auth/session";
import { buildApp } from "./src/app";
import { prisma, getTenantPrisma } from "./src/db";

async function main() {
  const app = buildApp();
  await app.ready();

  // Cleanup
  await prisma.user.deleteMany({
    where: { email: { in: ["a@example.com", "b@example.com", "c@example.com"] } }
  });

  // Setup Users
  const userA = await prisma.user.create({ data: { email: "a@example.com", passwordHash: await hashPassword("pass") } });
  const userB = await prisma.user.create({ data: { email: "b@example.com", passwordHash: await hashPassword("pass") } });
  const userC = await prisma.user.create({ data: { email: "c@example.com", passwordHash: await hashPassword("pass") } });

  const sessionA = await createSession(userA.id);
  const sessionB = await createSession(userB.id);
  const sessionC = await createSession(userC.id);

  // Setup Orgs
  const orgA = await prisma.organization.create({
    data: {
      name: "Org A",
      members: {
        create: [
          { userId: userA.id, role: "OWNER" },
          { userId: userB.id, role: "MEMBER" }
        ]
      }
    }
  });

  const orgB = await prisma.organization.create({
    data: {
      name: "Org B",
      members: {
        create: [
          { userId: userC.id, role: "OWNER" }
        ]
      }
    }
  });

  // Setup distinct resources in each organization using tenantPrisma
  const tenantA = getTenantPrisma(orgA.id);
  const tenantB = getTenantPrisma(orgB.id);

  await tenantA.project.create({ data: { name: "Project A1", organizationId: orgA.id } });
  await tenantB.project.create({ data: { name: "Project B1", organizationId: orgB.id } });

  console.log("--- Starting Combined RBAC + RLS Tests ---\n");

  const runTest = async (name: string, session: string, orgId: string, expectedStatus: number) => {
    const res = await app.inject({
      method: "GET",
      url: "/projects",
      headers: {
        cookie: `session=${session}`,
        "x-organization-id": orgId
      }
    });
    console.log(`${name.padEnd(30)}\tExpected: ${expectedStatus}\tActual: ${res.statusCode}`);
    if (res.statusCode === 200) {
      const payload = JSON.parse(res.payload);
      console.log(`  -> Retrieved ${payload.projects.length} project(s): ${payload.projects.map((p: any) => p.name).join(", ")}`);
    }
  };

  // Test matrix
  await runTest("User A (Org A OWNER) -> Org A", sessionA.token, orgA.id, 200);
  await runTest("User B (Org A MEMBER) -> Org A", sessionB.token, orgA.id, 200);
  await runTest("User C (Org B OWNER) -> Org B", sessionC.token, orgB.id, 200);

  // Cross-tenant attempts
  await runTest("User A -> Org B", sessionA.token, orgB.id, 403);
  await runTest("User B -> Org B", sessionB.token, orgB.id, 403);
  await runTest("User C -> Org A", sessionC.token, orgA.id, 403);

  // Cleanup
  await prisma.user.deleteMany({
    where: { email: { in: ["a@example.com", "b@example.com", "c@example.com"] } }
  });
  await app.close();
  await prisma.$disconnect();
}

main().catch(console.error);
