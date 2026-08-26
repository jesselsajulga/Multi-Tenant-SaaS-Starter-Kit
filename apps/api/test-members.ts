import { hashPassword } from "./src/auth/password";
import { createSession } from "./src/auth/session";
import { buildApp } from "./src/app";
import { prisma } from "./src/db";

async function main() {
  const app = buildApp();
  await app.ready();

  // Cleanup past test data
  await prisma.user.deleteMany({
    where: { email: { in: ["owner-a@example.com", "member-b@example.com", "user-c@example.com"] } }
  });

  // Create Users
  const ownerA = await prisma.user.create({ data: { email: "owner-a@example.com", passwordHash: await hashPassword("pass") } });
  const memberB = await prisma.user.create({ data: { email: "member-b@example.com", passwordHash: await hashPassword("pass") } });
  const userC = await prisma.user.create({ data: { email: "user-c@example.com", passwordHash: await hashPassword("pass") } });

  // Sessions
  const sessionOwner = await createSession(ownerA.id);
  const sessionMember = await createSession(memberB.id);
  const sessionUserC = await createSession(userC.id);

  // Organization & initial memberships
  const org = await prisma.organization.create({
    data: {
      name: "Test Org",
      members: {
        create: [
          { userId: ownerA.id, role: "OWNER" },
          { userId: memberB.id, role: "MEMBER" }
        ]
      }
    }
  });
  const orgId = org.id;

  console.log("--- Starting Tests ---\n");

  // 1. Unauthenticated -> GET members (401)
  const res1 = await app.inject({ method: "GET", url: `/organizations/${orgId}/members` });
  console.log("No session -> GET members\t\t\t\tExpected: 401\tActual:", res1.statusCode);

  // 2. Non-member -> GET members (403)
  const res2 = await app.inject({ method: "GET", url: `/organizations/${orgId}/members`, headers: { cookie: `session=${sessionUserC.token}` } });
  console.log("Non-member -> GET members\t\t\t\tExpected: 403\tActual:", res2.statusCode);

  // 3. MEMBER -> POST member (403)
  const res3 = await app.inject({ method: "POST", url: `/organizations/${orgId}/members`, headers: { cookie: `session=${sessionMember.token}` }, payload: { email: userC.email } });
  console.log("MEMBER -> POST member\t\t\t\tExpected: 403\tActual:", res3.statusCode);

  // 4. OWNER -> POST existing user (201)
  const res4 = await app.inject({ method: "POST", url: `/organizations/${orgId}/members`, headers: { cookie: `session=${sessionOwner.token}` }, payload: { email: userC.email } });
  console.log("OWNER -> POST existing user\t\t\t\tExpected: 201\tActual:", res4.statusCode);

  // 5. Add nonexistent email (404)
  const res5 = await app.inject({ method: "POST", url: `/organizations/${orgId}/members`, headers: { cookie: `session=${sessionOwner.token}` }, payload: { email: "nobody@example.com" } });
  console.log("Add nonexistent email\t\t\t\t\tExpected: 404\tActual:", res5.statusCode);

  // 6. Add existing member (409)
  const res6 = await app.inject({ method: "POST", url: `/organizations/${orgId}/members`, headers: { cookie: `session=${sessionOwner.token}` }, payload: { email: userC.email } });
  console.log("Add existing member\t\t\t\t\tExpected: 409\tActual:", res6.statusCode);

  // 7. MEMBER -> DELETE member (403)
  const res7 = await app.inject({ method: "DELETE", url: `/organizations/${orgId}/members/${userC.id}`, headers: { cookie: `session=${sessionMember.token}` } });
  console.log("MEMBER -> DELETE member\t\t\t\tExpected: 403\tActual:", res7.statusCode);

  // 8. OWNER -> DELETE member (200)
  const res8 = await app.inject({ method: "DELETE", url: `/organizations/${orgId}/members/${userC.id}`, headers: { cookie: `session=${sessionOwner.token}` } });
  console.log("OWNER -> DELETE member\t\t\t\tExpected: 200\tActual:", res8.statusCode);

  // 9. Delete nonexistent member (404)
  const res9 = await app.inject({ method: "DELETE", url: `/organizations/${orgId}/members/${userC.id}`, headers: { cookie: `session=${sessionOwner.token}` } });
  console.log("Delete nonexistent member\t\t\t\tExpected: 404\tActual:", res9.statusCode);

  // 10. Delete final OWNER (409)
  const res10 = await app.inject({ method: "DELETE", url: `/organizations/${orgId}/members/${ownerA.id}`, headers: { cookie: `session=${sessionOwner.token}` } });
  console.log("Delete final OWNER\t\t\t\t\tExpected: 409\tActual:", res10.statusCode);

  // Cleanup
  await prisma.user.deleteMany({
    where: { email: { in: ["owner-a@example.com", "member-b@example.com", "user-c@example.com"] } }
  });
  await app.close();
  await prisma.$disconnect();
}

main().catch(console.error);
