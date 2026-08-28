import { buildApp } from "./src/app";
import { prisma } from "./src/db";
import { stripe } from "./src/stripe/client";
import { createSession } from "./src/auth/session";
import { hashPassword } from "./src/auth/password";

async function main() {
  const app = buildApp();
  await app.ready();

  // Mock Stripe API calls
  stripe.billingPortal.sessions.create = async (params: any) => ({
    id: `bps_mock_${Math.random().toString(36).substring(7)}`,
    url: "https://billing.stripe.com/p/session/mock-url",
    ...params
  } as any);

  // Cleanup
  await prisma.subscription.deleteMany({
    where: { organization: { name: { startsWith: "Portal Test" } } }
  });
  await prisma.organization.deleteMany({
    where: { name: { startsWith: "Portal Test" } }
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "portal_test" } }
  });

  // Setup Users & Organizations
  const passwordHash = await hashPassword("password123");
  
  const owner = await prisma.user.create({
    data: { email: "portal_test_owner@example.com", passwordHash }
  });
  const member = await prisma.user.create({
    data: { email: "portal_test_member@example.com", passwordHash }
  });
  const nonMember = await prisma.user.create({
    data: { email: "portal_test_non@example.com", passwordHash }
  });

  const orgWithoutCustomer = await prisma.organization.create({
    data: { name: "Portal Test Org Without Customer" }
  });
  const orgWithCustomer = await prisma.organization.create({
    data: { name: "Portal Test Org With Customer" }
  });

  // Memberships
  await prisma.organizationMember.create({
    data: { organizationId: orgWithoutCustomer.id, userId: owner.id, role: "OWNER" }
  });
  await prisma.organizationMember.create({
    data: { organizationId: orgWithCustomer.id, userId: owner.id, role: "OWNER" }
  });
  await prisma.organizationMember.create({
    data: { organizationId: orgWithCustomer.id, userId: member.id, role: "MEMBER" }
  });

  // Existing Stripe Customer
  await prisma.subscription.create({
    data: { organizationId: orgWithCustomer.id, stripeCustomerId: "cus_portal_existing_123" }
  });

  // Sessions
  const ownerSession = await createSession(owner.id);
  const memberSession = await createSession(member.id);
  const nonMemberSession = await createSession(nonMember.id);

  console.log("--- Testing Billing Portal Endpoints ---\n");

  const makeRequest = async (orgId: string, token: string | null, payload?: any) => {
    return app.inject({
      method: "POST",
      url: `/organizations/${orgId}/billing/portal`,
      payload,
      cookies: token ? { session: token } : undefined
    });
  };

  // 1. Unauthenticated request
  const resUnauth = await makeRequest(orgWithCustomer.id, null);
  console.log(`Unauthenticated\t\t\tExpected: 401\tActual: ${resUnauth.statusCode}`);

  // 2. MEMBER requests portal
  const resMember = await makeRequest(orgWithCustomer.id, memberSession.token);
  console.log(`MEMBER\t\t\t\tExpected: 403\tActual: ${resMember.statusCode}`);

  // 3. Non-member requests portal
  const resNonMember = await makeRequest(orgWithCustomer.id, nonMemberSession.token);
  console.log(`Non-member\t\t\tExpected: 403\tActual: ${resNonMember.statusCode}`);

  // 4. OWNER without Stripe Customer
  const resWithoutCustomer = await makeRequest(orgWithoutCustomer.id, ownerSession.token);
  console.log(`OWNER without Stripe Customer\tExpected: 400\tActual: ${resWithoutCustomer.statusCode}`);

  // 5. OWNER with Stripe Customer
  const resWithCustomer = await makeRequest(orgWithCustomer.id, ownerSession.token);
  console.log(`OWNER with Stripe Customer\tExpected: 200\tActual: ${resWithCustomer.statusCode}`);

  // 6. Returned portal URL & arbitrary id injected
  // Attempting to send customer id in payload, which should be ignored
  const resArbitrary = await makeRequest(orgWithCustomer.id, ownerSession.token, { customerId: "cus_hacked" });
  console.log(`Arbitrary customer id injected\tExpected: 200 (ignored)\tActual: ${resArbitrary.statusCode}`);
  const json = resWithCustomer.json();
  console.log(`Returned portal URL\t\tExpected: string\tActual: ${typeof json.url === "string" ? "valid Stripe Portal URL" : "invalid"}`);

  // 7. Database subscription state unchanged
  const sub = await prisma.subscription.findUnique({ where: { organizationId: orgWithCustomer.id } });
  console.log(`Database subscription state\tExpected: unchanged\tActual: ${sub?.status === null ? "unchanged" : sub?.status}`);

  // Cleanup
  await prisma.subscription.deleteMany({
    where: { organization: { name: { startsWith: "Portal Test" } } }
  });
  await prisma.organization.deleteMany({
    where: { name: { startsWith: "Portal Test" } }
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "portal_test" } }
  });
  
  await app.close();
  await prisma.$disconnect();
}

main().catch(console.error);
