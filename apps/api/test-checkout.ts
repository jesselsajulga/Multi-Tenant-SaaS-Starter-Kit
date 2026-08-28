import { buildApp } from "./src/app";
import { prisma } from "./src/db";
import { stripe } from "./src/stripe/client";
import { createSession } from "./src/auth/session";
import { hashPassword } from "./src/auth/password";

async function main() {
  const app = buildApp();
  await app.ready();

  process.env.STRIPE_PRICE_PRO = "price_test_pro";

  // Mock Stripe API calls
  stripe.customers.create = async (params: any) => ({
    id: `cus_mock_${Math.random().toString(36).substring(7)}`,
    ...params
  } as any);

  stripe.checkout.sessions.create = async (params: any) => ({
    id: `cs_mock_${Math.random().toString(36).substring(7)}`,
    url: "https://checkout.stripe.com/mock-url",
    ...params
  } as any);

  // Cleanup
  await prisma.subscription.deleteMany({
    where: { organization: { name: { startsWith: "Checkout Test" } } }
  });
  await prisma.organization.deleteMany({
    where: { name: { startsWith: "Checkout Test" } }
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "checkout_test" } }
  });

  // Setup Users & Organizations
  const passwordHash = await hashPassword("password123");
  
  const owner = await prisma.user.create({
    data: { email: "checkout_test_owner@example.com", passwordHash }
  });
  const member = await prisma.user.create({
    data: { email: "checkout_test_member@example.com", passwordHash }
  });
  const nonMember = await prisma.user.create({
    data: { email: "checkout_test_non@example.com", passwordHash }
  });

  const orgNew = await prisma.organization.create({
    data: { name: "Checkout Test Org New Customer" }
  });
  const orgExisting = await prisma.organization.create({
    data: { name: "Checkout Test Org Existing Customer" }
  });

  // Memberships
  await prisma.organizationMember.create({
    data: { organizationId: orgNew.id, userId: owner.id, role: "OWNER" }
  });
  await prisma.organizationMember.create({
    data: { organizationId: orgNew.id, userId: member.id, role: "MEMBER" }
  });
  await prisma.organizationMember.create({
    data: { organizationId: orgExisting.id, userId: owner.id, role: "OWNER" }
  });

  // Existing Stripe Customer
  await prisma.subscription.create({
    data: { organizationId: orgExisting.id, stripeCustomerId: "cus_existing_123" }
  });

  // Sessions
  const ownerSession = await createSession(owner.id);
  const memberSession = await createSession(member.id);
  const nonMemberSession = await createSession(nonMember.id);

  console.log("--- Testing Checkout Endpoints ---\n");

  const makeRequest = async (orgId: string, token: string | null, payload: any) => {
    return app.inject({
      method: "POST",
      url: `/organizations/${orgId}/billing/checkout`,
      payload,
      cookies: token ? { session: token } : undefined
    });
  };

  // 1. Unauthenticated request
  const resUnauth = await makeRequest(orgNew.id, null, { plan: "pro" });
  console.log(`Unauthenticated request\t\tExpected: 401\tActual: ${resUnauth.statusCode}`);

  // 2. MEMBER requests checkout
  const resMember = await makeRequest(orgNew.id, memberSession.token, { plan: "pro" });
  console.log(`MEMBER requests checkout\tExpected: 403\tActual: ${resMember.statusCode}`);

  // 3. Non-member requests checkout
  const resNonMember = await makeRequest(orgNew.id, nonMemberSession.token, { plan: "pro" });
  console.log(`Non-member requests checkout\tExpected: 403\tActual: ${resNonMember.statusCode}`);

  // 4. Unknown organization
  const resUnknownOrg = await makeRequest("invalid-org-id", ownerSession.token, { plan: "pro" });
  console.log(`Unknown organization\t\tExpected: 400/403\tActual: ${resUnknownOrg.statusCode}`);

  // 5. Invalid plan
  const resInvalidPlan = await makeRequest(orgNew.id, ownerSession.token, { plan: "invalid_plan" });
  console.log(`Invalid plan\t\t\tExpected: 400\tActual: ${resInvalidPlan.statusCode}`);

  // 6. Client attempts arbitrary priceId
  const resArbitraryPrice = await makeRequest(orgNew.id, ownerSession.token, { plan: "pro", priceId: "price_hacked" });
  // Should ignore arbitrary priceId or fail strictly (zod strict). Zod will strip or throw. Currently we just ignore since we only read `plan`. Let's see if it works as pro.
  console.log(`Arbitrary priceId\t\tExpected: 200 (ignored)\tActual: ${resArbitraryPrice.statusCode}`);

  // 7. No existing Customer (New)
  const resNewCustomer = await makeRequest(orgNew.id, ownerSession.token, { plan: "pro" });
  console.log(`No existing Customer\t\tExpected: 200\tActual: ${resNewCustomer.statusCode}`);
  const subNew = await prisma.subscription.findUnique({ where: { organizationId: orgNew.id } });
  console.log(`Stripe Customer created\t\tExpected: exists\tActual: ${!!subNew?.stripeCustomerId}`);
  console.log(`Subscription activated?\t\tExpected: no\tActual: ${subNew?.status === null ? "no" : subNew?.status}`);

  // 8. Existing Stripe Customer
  const resExistingCustomer = await makeRequest(orgExisting.id, ownerSession.token, { plan: "pro" });
  console.log(`Existing Stripe Customer\tExpected: 200\tActual: ${resExistingCustomer.statusCode}`);

  // Cleanup
  await prisma.subscription.deleteMany({
    where: { organization: { name: { startsWith: "Checkout Test" } } }
  });
  await prisma.organization.deleteMany({
    where: { name: { startsWith: "Checkout Test" } }
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "checkout_test" } }
  });
  
  await app.close();
  await prisma.$disconnect();
}

main().catch(console.error);
