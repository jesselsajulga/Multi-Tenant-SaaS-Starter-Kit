import { PrismaClient } from "./src/generated/prisma/client";
import { hashPassword } from "./src/auth/password";
import { createSession } from "./src/auth/session";
import { FastifyInstance } from "fastify";
import { buildApp } from "./src/app";
import { prisma } from "./src/db";

async function main() {
  console.log("Setting up test users...");
  const app = buildApp();
  await app.ready();

  await prisma.user.deleteMany({ where: { email: "user-a-orgs@example.com" } });
  
  const userA = await prisma.user.create({
    data: {
      email: "user-a-orgs@example.com",
      passwordHash: await hashPassword("password123"),
    }
  });

  const sessionA = await createSession(userA.id);
  const cookieA = `session=${sessionA.token}`;

  console.log("\n--- Testing POST /organizations ---");
  
  // Unauthenticated
  const resUnauth = await app.inject({
    method: "POST",
    url: "/organizations",
    payload: { name: "Unauth Org" }
  });
  console.log("Unauthenticated POST /organizations status:", resUnauth.statusCode);

  // Authenticated
  const resAuth = await app.inject({
    method: "POST",
    url: "/organizations",
    headers: {
      cookie: cookieA
    },
    payload: { name: "User A Org" }
  });
  console.log("Authenticated POST /organizations status:", resAuth.statusCode);

  console.log("\n--- Testing GET /organizations ---");
  const resGet = await app.inject({
    method: "GET",
    url: "/organizations",
    headers: {
      cookie: cookieA
    }
  });
  console.log("GET /organizations status:", resGet.statusCode);
  const getPayload = JSON.parse(resGet.payload);
  console.log(`User A belongs to ${getPayload.organizations.length} organization(s)`);
  if (getPayload.organizations.length > 0) {
    console.log("First organization name:", getPayload.organizations[0].name);
  }

  // Cleanup
  await prisma.user.deleteMany();
  await app.close();
  await prisma.$disconnect();
}

main().catch(console.error);
